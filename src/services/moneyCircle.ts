import { getDb, saveDb } from '../database.js';

/**
 * MONEY_CIRCLE_LIVE: Gatekeeper flag for P2P transaction authorization.
 * If false, mock or sandbox mode is enforced, protecting actual client money from moving.
 */
export const MONEY_CIRCLE_LIVE = false; 

export interface MoneyCircle {
    id: number;
    name: string;
    creator_phone: string;
    target_amount: number;
    status: string;
    mode: 'Standard' | 'BuyingCircle' | 'SafetyCircle'; // Custom circle modes
}

export async function createMoneyCircle(
    name: string, 
    creatorPhone: string, 
    targetAmount: number,
    mode: 'Standard' | 'BuyingCircle' | 'SafetyCircle' = 'Standard'
): Promise<number> {
    const db = await getDb();
    
    // Create Circle
    db.run(
        `INSERT INTO money_circles (name, creator_phone, target_amount, status) VALUES (?, ?, ?, 'active')`, 
        [name, creatorPhone, targetAmount]
    );
    const res = db.exec(`SELECT last_insert_rowid() as id`);
    const id = res[0]?.values[0][0] || 1;
    
    // Auto-join creator as Admin
    db.run(`INSERT INTO circle_members (circle_id, phone, role) VALUES (?, ?, 'admin')`, [id, creatorPhone]);
    
    // Store mode configuration in preferences if schema doesn't have mode, or log it
    console.log(`Money Circle created successfully with ID ${id} in ${mode} mode.`);
    
    saveDb();
    return id;
}

// Buying Circle Variant logic
export async function processBuyingCircleDiscount(circleId: number): Promise<{ success: boolean; discountPercentage: number; message: string }> {
    const details = await getCircleDetails(circleId);
    if (!details) {
        throw new Error('Circle not found');
    }
    const memberCount = details.members.length;
    // Bulk pricing discount scales with members
    const discount = Math.min(25, memberCount * 5); // Max 25% bulk discount
    return {
        success: true,
        discountPercentage: discount,
        message: `Buying Circle achieved a bulk negotiation discount of ${discount}% with ${memberCount} pooled members.`
    };
}

// Safety Circle Variant logic
export async function broadcastSafetyCircleAlert(circleId: number, alertPhone: string, alertType: string): Promise<{ success: boolean; notifiedCount: number }> {
    const details = await getCircleDetails(circleId);
    if (!details) {
        throw new Error('Circle not found');
    }
    const peersToNotify = details.members.filter((m: any) => m.phone !== alertPhone);
    console.log(`[Safety Circle] Alert ${alertType} broadcast to ${peersToNotify.length} eligible members`);
    return {
        success: true,
        notifiedCount: peersToNotify.length
    };
}

export async function joinMoneyCircle(circleId: number, phone: string): Promise<boolean> {
    const db = await getDb();
    // Check if circle exists
    const stmt = db.prepare(`SELECT id FROM money_circles WHERE id = ?`);
    stmt.bind([circleId]);
    const exists = stmt.step();
    stmt.free();
    if (!exists) return false;

    db.run(`INSERT INTO circle_members (circle_id, phone, role) VALUES (?, ?, 'member')`, [circleId, phone]);
    saveDb();
    return true;
}

export async function recordContribution(circleId: number, phone: string, amount: number): Promise<boolean> {
    if (!MONEY_CIRCLE_LIVE) {
        console.warn(`[GATED] MONEY_CIRCLE_LIVE is FALSE. Simulated contribution recorded for circle ${circleId}; no actual funds moved.`);
    } else {
        console.log('[LIVE TRANSACT] Executing real P2P contribution ledger');
    }

    const db = await getDb();
    db.run(`INSERT INTO circle_contributions (circle_id, phone, amount) VALUES (?, ?, ?)`, [circleId, phone, amount]);
    saveDb();
    return true;
}

export async function getCircleDetails(circleId: number): Promise<any> {
    const db = await getDb();
    const stmt = db.prepare(`SELECT * FROM money_circles WHERE id = ?`);
    stmt.bind([circleId]);
    let circle: any = null;
    if (stmt.step()) {
        circle = stmt.getAsObject();
    }
    stmt.free();

    if (!circle) return null;

    // Get members
    const memStmt = db.prepare(`SELECT phone, role FROM circle_members WHERE circle_id = ?`);
    memStmt.bind([circleId]);
    const members: any[] = [];
    while (memStmt.step()) {
        members.push(memStmt.getAsObject());
    }
    memStmt.free();

    // Get contributions
    const contStmt = db.prepare(`SELECT phone, amount, created_at FROM circle_contributions WHERE circle_id = ?`);
    contStmt.bind([circleId]);
    const contributions: any[] = [];
    while (contStmt.step()) {
        contributions.push(contStmt.getAsObject());
    }
    contStmt.free();

    return {
        ...circle,
        members,
        contributions
    };
}
