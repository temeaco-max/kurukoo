import { getDb, saveDb } from '../database.js';
import { encryptData, getProfile } from './memoryProfile.js';

/**
 * Onboarding is progressive guidance, not a hard conversational gate.
 * A new user should understand Kurukoo in one sentence and get to useful work
 * immediately. Profile enrichment is optional and can continue from normal Chat.
 */
function isExplicitTaskRequest(text: string): boolean {
    return /\b(?:find|arrange|repair|fix|book|hire|need|order|buy|source|schedule|remind|help\s+with|someone\s+to)\b/i.test(String(text || ''));
}

function isLikelyNameOnly(text: string): boolean {
    return /^[a-z][a-z'’-]{1,39}(?:\s+[a-z][a-z'’-]{1,39}){0,2}$/i.test(String(text || '').trim());
}

export async function isOnboarding(phone: string, initialMessage = ''): Promise<boolean> {
    const db = await getDb();
    const profile = await getProfile(phone, 'progressive_onboarding');
    let onboarding = false;
    const name = profile?.name ? String(profile.name).trim() : null;
    if (profile) {
        const prefs = profile.preferences && typeof profile.preferences === 'object' ? profile.preferences : {};
        onboarding = prefs.onboarding_complete !== true;
    }
    if (!onboarding) return false;

    // Optional profile enrichment must never consume an explicit user task.
    if (isExplicitTaskRequest(initialMessage)) return false;

    // A supplied identity is enough to let the conversational system continue.
    // Remaining profile enrichment can happen progressively instead of blocking.
    if (name) return false;

    // Never let onboarding capture a live economic workflow. The request owner
    // must remain available for requirement collection and continuation.
    try {
        const active = db.prepare(`SELECT id FROM economic_requests WHERE phone = ? AND status IN ('requested','awaiting_match','partially_matched','matched','quoting','quoted','awaiting_confirmation','reserved','payment_pending','paid','in_fulfillment') ORDER BY updated_at DESC LIMIT 1`);
        active.bind([phone]);
        const hasActiveRequest = active.step();
        active.free();
        if (hasActiveRequest && !isLikelyNameOnly(initialMessage)) return false;
    } catch {
        // If the optional request table is unavailable during early bootstrap,
        // preserve the original onboarding behaviour rather than crashing Chat.
    }

    return true;
}

export async function handleOnboardingInput(phone: string, text: string): Promise<{ reply: string, cardData?: any }> {
    const db = await getDb();
    const profile = await getProfile(phone, 'progressive_onboarding');
    const prefs: any = profile?.preferences && typeof profile.preferences === 'object' ? { ...profile.preferences } : {};
    const step = prefs.onboarding_step || 'start';

    if (step === 'start') {
        // Keep the first-run experience to one small identity step, then return
        // control to normal Chat. Never make a new user complete a role survey
        // before asking Kurukoo to actually do something.
        const name = text.trim();
        prefs.onboarding_complete = true;
        prefs.onboarding_step = 'done';
        db.run(`UPDATE memory_profiles SET name = ?, preferences = ? WHERE phone = ?`, [name, encryptData(JSON.stringify(prefs)), phone]);
        saveDb();
        return {
            reply: name
                ? `Nice to meet you, ${name}. I’m Kurukoo. Tell me what you need done — I’ll help you work it out, coordinate it, and ask you only when your input or approval is needed.`
                : `I’m Kurukoo. Tell me what you need done — I’ll help you work it out, coordinate it, and ask you only when your input or approval is needed.`,
            cardData: {
                type: 'welcome',
                title: 'What would you like to get done?',
                prompt: 'Start with a request, a problem, a plan, or something you want to find.',
                options: ['Find a service', 'Fix something', 'Plan something', 'Ask Kurukoo']
            }
        };
    }

    // These branches are retained for users who were already mid-onboarding
    // before the progressive experience was simplified.
    if (step === 'ask_intent') {
        prefs.onboarding_step = 'ask_skills';
        prefs.primary_intent = text;
        db.run(`UPDATE memory_profiles SET preferences = ? WHERE phone = ?`, [encryptData(JSON.stringify(prefs)), phone]);
        saveDb();
        return {
            reply: `You can tell me what you want to accomplish first; I’ll help you decide what matters next. If earning from a skill is part of that, tell me the skill when it is useful.`,
            cardData: { type: 'quick_replies', options: ['Find services', 'Earn from skills', 'Both'] }
        };
    }

    if (step === 'ask_skills') {
        const cleanSkill = text.toLowerCase().trim();
        if (cleanSkill.includes('find') || cleanSkill.includes('help') || cleanSkill.includes('support') || cleanSkill === 'none') {
            prefs.onboarding_complete = true;
            prefs.onboarding_step = 'done';
            db.run(`UPDATE memory_profiles SET preferences = ? WHERE phone = ?`, [encryptData(JSON.stringify(prefs)), phone]);
            saveDb();
            return {
                reply: `Got it. Tell me what you need done and I’ll take it from there.`,
                cardData: { type: 'welcome', title: 'What would you like to get done?', options: ['Find a service', 'Fix something', 'Plan something', 'Ask Kurukoo'] }
            };
        }
        prefs.onboarding_step = 'confirm_code';
        if (cleanSkill && cleanSkill !== 'none') {
            prefs.skills = [cleanSkill];
            db.run(`INSERT OR IGNORE INTO skills (phone, skill, source, confidence, is_available) VALUES (?, ?, 'explicit', 1.0, 1)`, [phone, cleanSkill]);
        }
        db.run(`UPDATE memory_profiles SET preferences = ? WHERE phone = ?`, [encryptData(JSON.stringify(prefs)), phone]);
        saveDb();
        return {
            reply: `Thanks — I’ll remember that. You can start with any request now; you do not need to finish a profile survey first.`,
            cardData: { type: 'welcome', title: 'You can start working with Kurukoo now.', options: ['Find a service', 'Fix something', 'Plan something', 'Ask Kurukoo'] }
        };
    }

    if (step === 'confirm_code') {
        prefs.onboarding_complete = true;
        prefs.onboarding_step = 'done';
        db.run(`UPDATE memory_profiles SET preferences = ? WHERE phone = ?`, [encryptData(JSON.stringify(prefs)), phone]);
        saveDb();
        return {
            reply: `You’re all set. Tell me what you need done and I’ll help from there.`,
            cardData: { type: 'welcome', title: 'What would you like to get done?', options: ['Find a service', 'Fix something', 'Plan something', 'Ask Kurukoo'] }
        };
    }

    return { reply: `Tell me what you need done and I’ll help from there.` };
}

export async function onboardNewUser(phone: string): Promise<string> {
    const db = await getDb();
    db.run(`INSERT OR IGNORE INTO memory_profiles (phone, name) VALUES (?, ?)`, [phone, null]);
    const prefs = { onboarding_step: 'start', onboarding_complete: false };
    db.run(`UPDATE memory_profiles SET name = NULL, preferences = ? WHERE phone = ?`, [encryptData(JSON.stringify(prefs)), phone]);
    saveDb();
    return `Welcome to Kurukoo. I’m here to help you get things done — from finding a service or fixing a problem to coordinating something more involved. You can just start by telling me what you need.`;
}

export function getDailyPersonalizedQuestion(day: number): { q: string, options: string[] } {
    const questions: Record<number, { q: string, options: string[] }> = {
        1: { q: 'Do you usually work from a stationary shop or move around as a mobile provider?', options: ['Stationary Shop', 'Mobile / Delivery', 'Both'] },
        2: { q: 'Would you like reminders to appear in Web Chat and your private notification inbox?', options: ['Yes, remind me', 'No reminders'] },
        3: { q: 'Do you have your own transport (motorcycle, bicycle, car) for dispatch work?', options: ['Yes, Motorbike/Car', 'Yes, Bicycle', 'No vehicle'] },
        4: { q: 'Do you save money in group circles with family or friends?', options: ['Yes, actively', 'Sometimes', 'No, never'] },
        5: { q: 'Would you like to use personal safety check-ins for selected journeys or routines?', options: ['Yes, explain check-ins', 'Maybe later', 'No'] },
        6: { q: 'Do you want to receive daily news and market price intelligence updates?', options: ['Yes, please', 'No, thanks'] },
        7: { q: 'Would you like verified product information when you ask what is available nearby?', options: ['Yes, show verified options', 'No, thanks'] }
    };
    return questions[day] || { q: 'How is your experience with Kurukoo so far?', options: ['Excellent', 'Good', 'Could be better'] };
}
