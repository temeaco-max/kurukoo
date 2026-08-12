import { getDb, saveDb } from '../database.js';
import { getProfile, updateProfile } from './memoryProfile.js';
import { recalculateTrustScore } from './trustScore.js';

export async function submitRating(providerPhone: string, skill: string, rating: number): Promise<void> {
    const db = await getDb();

    // 1. Update skill rating and jobs completed
    db.run(`UPDATE skills SET
        rating = ((rating * jobs_completed) + ?) / (jobs_completed + 1),
        jobs_completed = jobs_completed + 1
        WHERE phone = ? AND skill = ?`,
        [rating, providerPhone, skill]);

    // 2. Recalculate the backend-only composite Trust Score immediately after
    // the completion/rating event. The public UI should use human signals only.
    await recalculateTrustScore(providerPhone);

    // 3. Add badge check
    await checkAndAwardBadges(providerPhone);

    saveDb();
}

export async function checkAndAwardBadges(phone: string): Promise<void> {
    const db = await getDb();

    // Fetch profile and details
    const profile = await getProfile(phone);
    if (!profile) return;

    // Get aggregated stats
    const stmtStats = db.prepare(`SELECT SUM(jobs_completed) as total_jobs, AVG(rating) as avg_rating FROM skills WHERE phone = ?`);
    stmtStats.bind([phone]);
    const rowStats = stmtStats.getAsObject();
    stmtStats.free();

    const totalJobs = (rowStats.total_jobs as number) || 0;
    const avgRating = (rowStats.avg_rating as number) || 0;

    const awardedBadges: string[] = [];

    // 1. Verified badge: KYC completed (verified_provider = 1) + 5+ jobs + rating >= 4.0
    const kycCompleted = profile.verified_provider === 1 || !!profile.nin;
    if (kycCompleted && totalJobs >= 5 && avgRating >= 4.0) {
        awardedBadges.push('Verified');
        db.run(`INSERT OR IGNORE INTO badges (phone, badge_type) VALUES (?, 'Verified')`, [phone]);
    }

    // 2. Contributor badge: is_contributor = 1, or completed 10+ micro-tasks
    const stmtTasks = db.prepare(`SELECT COUNT(*) as count FROM micro_tasks WHERE assigned_to = ? AND status = 'completed'`);
    stmtTasks.bind([phone]);
    let completedTasks = 0;
    if (stmtTasks.step()) completedTasks = stmtTasks.getAsObject().count as number;
    stmtTasks.free();

    if (profile.is_contributor === 1 || completedTasks >= 10) {
        awardedBadges.push('Contributor');
        db.run(`INSERT OR IGNORE INTO badges (phone, badge_type) VALUES (?, 'Contributor')`, [phone]);
    }

    // 3. Top Rated badge: Rating in the top 10% of providers in the same LGA/location for their primary skill
    // Let's find the primary skill for this provider
    const stmtPrimarySkill = db.prepare(`SELECT skill, rating FROM skills WHERE phone = ? ORDER BY jobs_completed DESC LIMIT 1`);
    stmtPrimarySkill.bind([phone]);
    let primarySkill = '';
    let primaryRating = 0.0;
    if (stmtPrimarySkill.step()) {
        const obj = stmtPrimarySkill.getAsObject();
        primarySkill = obj.skill as string;
        primaryRating = obj.rating as number;
    }
    stmtPrimarySkill.free();

    if (primarySkill) {
        // Fetch all providers in the same location with this skill
        const stmtLga = db.prepare(`
            SELECT s.phone, s.rating
            FROM skills s
            JOIN memory_profiles p ON s.phone = p.phone
            WHERE s.skill = ? AND p.location = ?
            ORDER BY s.rating DESC
        `);
        stmtLga.bind([primarySkill, profile.location || 'Ibadan']);
        const peerRatings: number[] = [];
        while (stmtLga.step()) {
            peerRatings.push(stmtLga.getAsObject().rating as number);
        }
        stmtLga.free();

        if (peerRatings.length > 0) {
            // Find threshold for top 10%
            const sorted = peerRatings.sort((a, b) => b - a);
            const topTenIndex = Math.max(0, Math.ceil(sorted.length * 0.1) - 1);
            const threshold = sorted[topTenIndex];

            if (primaryRating >= threshold && primaryRating >= 4.0) {
                awardedBadges.push('Top Rated');
                db.run(`INSERT OR IGNORE INTO badges (phone, badge_type) VALUES (?, 'Top Rated')`, [phone]);
            }
        }
    }

    // Read existing badges from table to make sure we include any others
    const stmtAllBadges = db.prepare(`SELECT badge_type FROM badges WHERE phone = ?`);
    stmtAllBadges.bind([phone]);
    const finalBadgesSet = new Set(awardedBadges);
    while (stmtAllBadges.step()) {
        finalBadgesSet.add(stmtAllBadges.getAsObject().badge_type as string);
    }
    stmtAllBadges.free();

    const finalBadges = Array.from(finalBadgesSet);

    // Update preferences JSON with the badges array
    const prefs = profile.preferences || {};
    prefs.badges = finalBadges;
    await updateProfile(phone, 'system', { preferences: prefs });

    saveDb();
}
