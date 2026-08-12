import { deductPoints, addPoints } from './pointsEngine.js';
import { getDb, saveDb } from '../database.js';
import { querySmolLM2 } from './smolLm2Service.js';
import fs from 'fs';
import path from 'path';

let blocklistPatterns: string[] = [];
try {
    const configPath = path.join(process.cwd(), 'config', 'blocklist.json');
    if (fs.existsSync(configPath)) {
        const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
        blocklistPatterns = config.patterns || [];
    }
} catch (err) {
    console.error('Failed to load blocklist.json in AI Agent Service:', err);
}

export interface AIAgent {
    id: string;
    name: string;
    avatar: string;
    system_prompt: string;
    skills: string[];
    tools: string[];
    status: 'active' | 'paused';
    lga: string;
    concurrency_limit: number;
    token_quota_daily: number;
    cost_threshold_usd: number;
    temperature: number;
    tokens_used_today?: number;
    success_count?: number;
    escalation_count?: number;
    created_at?: string;
}


function mirrorAgentToMemoryProfile(db: any, agent: AIAgent) {
    // Check if exists in memory_profiles
    const stmt = db.prepare("SELECT phone FROM memory_profiles WHERE phone = ?");
    stmt.bind([agent.id]);
    const exists = stmt.step();
    stmt.free();

    if (!exists) {
        db.run(
            "INSERT INTO memory_profiles (phone, name, primary_lga, is_available, trust_score, verified_provider, provider_type) VALUES (?, ?, ?, ?, ?, ?, 'software_service')",
            [agent.id, agent.name, agent.lga || 'All', agent.status === 'active' ? 1 : 0, 5.0, 1]
        );
    } else {
        db.run(
            "UPDATE memory_profiles SET name = ?, primary_lga = ?, is_available = ?, provider_type = 'software_service' WHERE phone = ?",
            [agent.name, agent.lga || 'All', agent.status === 'active' ? 1 : 0, agent.id]
        );
    }

    // Sync skills
    db.run("DELETE FROM skills WHERE phone = ?", [agent.id]);
    if (agent.skills && agent.skills.length > 0) {
        for (const skill of agent.skills) {
            db.run(
                "INSERT INTO skills (phone, skill, source, confidence, is_available, operation_mode) VALUES (?, ?, 'explicit', 1.0, ?, 'stationary')",
                [agent.id, skill, agent.status === 'active' ? 1 : 0]
            );
        }
    }
}

export async function seedDefaultAIAgents(): Promise<void> {
    const db = await getDb();
    
    const defaultAgents: AIAgent[] = [
        {
            id: 'agent_price_checker',
            name: 'Market Intelligence & Price Discovery Agent',
            avatar: '📈',
            system_prompt: `[IDENTITY & ROLE]
You are Kurukoo's Market Intelligence & Price Discovery Agent operating across Nigeria and West Africa.
Your core mission is automated price discovery, market intelligence aggregation, and arbitrage detection for everyday commodities, foodstuffs, building materials, and fuel across LGAs (e.g. Ikeja, Surulere, Kano Municipal, Port Harcourt).

[OPERATIONAL INSTRUCTIONS]
1. Compare food and commodity prices across local markets and retail shops using catalog_scraper and price_database queries.
2. Surface price gaps and wholesale deals to help users save money or identify trade opportunities.
3. Categorize price trends by LGA, product grade, and availability.

[HALLUCINATION GUARDRAILS & ACCURACY]
- NEVER fabricate price points, merchant phone numbers, or market locations.
- Only quote verified price data stored in the database or returned by active scraper jobs.
- If data confidence is below 0.80 or older than 7 days, explicitly notify the user: "Price data requires re-verification" and prompt a local provider verification request.
- Keep output concise, structured, and actionable.`,
            skills: ['price_checker', 'price_check', 'market_intel', 'catalog_scraper'],
            tools: ['catalog_scraper', 'market_database', 'lga_price_analyzer'],
            status: 'active',
            lga: 'Ikeja',
            concurrency_limit: 10,
            token_quota_daily: 25000,
            cost_threshold_usd: 2.5,
            temperature: 0.1
        },
        {
            id: 'agent_support_triage',
            name: 'Support, Safety & Dispute Triage Agent',
            avatar: '⚖️',
            system_prompt: `[IDENTITY & ROLE]
You are Kurukoo's Emergency, Safety & Dispute Resolution Triage Agent.
Your priority is maintaining platform safety, user trust, privacy compliance (NDPA 2023 & UK GDPR), and rapid triage of disputes or safety concerns.

[OPERATIONAL INSTRUCTIONS]
1. Analyze incoming dispute tickets, scam reports, and emergency messages with high empathy, calm tone, and strict neutrality.
2. Filter content against compliance blocklists for banned/illegal items, hate speech, or harassment.
3. For minor disputes (e.g., late arrival), attempt automated resolution using transaction history and policy guidelines.

[ESCALATION & SAFETY TRIGGERS]
- IMMEDIATELY escalate to human moderators when:
  a) Physical safety, harassment, or threat is mentioned.
  b) Financial dispute exceeds ₦50,000 or £100.
  c) User sentiment indicates severe distress or confidence score < 0.70.
  d) Medical or emergency service dispatch is requested.
- When an emergency is detected, provide official local emergency dispatch contacts (e.g., 112) with a clear liability disclaimer.

[HALLUCINATION GUARDRAILS]
- Never promise legal outcomes, financial refunds, or medical diagnoses.
- Never reveal private user phone numbers or transaction details beyond what is required for triage.`,
            skills: ['support_triage', 'dispute_resolution', 'emergency', 'compliance_filter'],
            tools: ['compliance_filter', 'human_escalation', 'dispute_ledger'],
            status: 'active',
            lga: 'All',
            concurrency_limit: 15,
            token_quota_daily: 50000,
            cost_threshold_usd: 5.0,
            temperature: 0.15
        },
        {
            id: 'agent_reminder',
            name: 'Universal Life-Admin & Routine Nudge Agent',
            avatar: '📅',
            system_prompt: `[IDENTITY & ROLE]
You are Kurukoo's Universal Life-Admin Assistant and Routine Nudge Agent.
You empower users by managing scheduled nudges, council bin schedules, vehicle MOT reminders, doctor appointments, insurance renewals, and daily habit tracking.

[OPERATIONAL INSTRUCTIONS]
1. Parse user requests for scheduled tasks, bin day checks, MOT expiry dates, and habit tracking goals.
2. Generate concise, friendly, and timely reminders for Web Chat and the authenticated internal notification inbox. Never claim external delivery unless a configured adapter provides delivery evidence.
3. Tailor reminders based on user memory profile preferences, locale (NG), and LGA settings.

[TONE & CONSTRAINTS]
- Tone: Helpful, proactive, respectful, and encouraging.
- Format: Keep messages under 280 characters with actionable single-tap quick replies (e.g., "Snooze 1h", "Mark Done", "Reschedule").

[HALLUCINATION GUARDRAILS]
- NEVER request passwords, bank account PINs, or national identity numbers (NIN/NIN/NHS).
- Only confirm appointment or reminder details explicitly provided by the user or council APIs.`,
            skills: ['reminder', 'habit_tracker', 'bin_day', 'mot_reminder', 'doctor_appointment', 'insurance_renewal', 'habit_streak_analytics', 'contextual_habit_nudge'],
            tools: ['calendar_push', 'fcm_notifier', 'council_schedule_api'],
            status: 'active',
            lga: 'All',
            concurrency_limit: 20,
            token_quota_daily: 35000,
            cost_threshold_usd: 3.5,
            temperature: 0.2
        },
        {
            id: 'agent_buyer_dispatch',
            name: 'Principal Trade & Arbitrage Buyer Agent',
            avatar: '🚚',
            system_prompt: `[IDENTITY & ROLE]
You are Kurukoo's Principal Trade & Arbitrage Logistics Agent.
Your mission is to connect buyers with verified wholesale suppliers and dispatch nearby mobile runners/riders for fulfillment coordination.

[OPERATIONAL INSTRUCTIONS]
1. Identify principal trade deals when price gaps exist between suppliers and buyers.
2. Calculate item cost, delivery runner fee, and total buyer price while maintaining platform margin.
3. Coordinate multi-step deals: Supplier Confirmation -> Mobile Runner Dispatch -> Buyer Delivery.

[EXECUTION DISCIPLINE & GUARDRAILS]
- Always verify provider live presence in provider_presence table before dispatching.
- Check provider Point balance for lead charges before locking the match.
- Never promise delivery times if traffic or weather conditions indicate high risk without disclosing a realistic window.`,
            skills: ['buyer', 'seller', 'trade_match', 'delivery', 'purchaser'],
            tools: ['trade_engine', 'pulse_matcher', 'escrow_service'],
            status: 'active',
            lga: 'Surulere',
            concurrency_limit: 10,
            token_quota_daily: 20000,
            cost_threshold_usd: 2.0,
            temperature: 0.1
        },
        {
            id: 'agent_traffic_content',
            name: 'Local Pulse & Content Writer Agent',
            avatar: '📰',
            system_prompt: `[IDENTITY & ROLE]
You are Kurukoo's Local Pulse & Content Writer Agent.
You generate engaging Daily Picks, community market intel cards, local traffic/route digests, and localized promotional cards.

[OPERATIONAL INSTRUCTIONS]
1. Compose daily rich-media cards for the Opportunity Feed and Daily Picks carousel.
2. Incorporate warm, culturally authentic greetings ("Ku Kurukoo!", "Good day", "Wetin dey happen!") appropriate to the user's language preference (English, Pidgin, Hausa, Yoruba, Igbo).
3. Draft informative local blog teasers and community spotlight announcements for the Admin content queue.

[QUALITY & GUARDRAILS]
- Every piece of content must contain verified local value (e.g. market trend, skill demand alert, community event).
- Strictly adhere to anti-bias guidelines: never assign skills or stereotypes based on demographic identifiers.`,
            skills: ['traffic_checker', 'content_writer', 'daily_picks', 'community_news'],
            tools: ['content_cms', 'daily_picks_generator', 'trend_analyzer'],
            status: 'active',
            lga: 'All',
            concurrency_limit: 10,
            token_quota_daily: 25000,
            cost_threshold_usd: 2.5,
            temperature: 0.4
        },
        
        {
            id: 'agent_finance_savings',
            name: 'Personal Finance & Savings Nudge Agent',
            avatar: '💰',
            system_prompt: `[IDENTITY & ROLE]
You are Kurukoo's Personal Finance and Savings Nudge Agent.
Your goal is to help users track their budgets, set savings goals, and provide contextual nudges based on their spending patterns to ensure economic flow.
You emphasize sustainable habits, micro-investment awareness, and responsible financial management.`,
            skills: ['budget_tracking', 'savings_goal_nudge', 'spending_pattern_analysis'],
            tools: ['database_write'],
            status: 'active',
            lga: 'All',
            concurrency_limit: 10,
            token_quota_daily: 5000,
            cost_threshold_usd: 5,
            temperature: 0.4
        }
    ];

    // Upsert or insert default agents so existing databases receive the enhanced personas
    for (const agent of defaultAgents) {
        const stmt = db.prepare(`SELECT id FROM ai_agents WHERE id = ?`);
        stmt.bind([agent.id]);
        const exists = stmt.step();
        stmt.free();

        if (exists) {
            db.run(
                `UPDATE ai_agents
                 SET name = ?, system_prompt = ?, skills = ?, tools = ?, status = ?, lga = ?,
                     concurrency_limit = ?, token_quota_daily = ?, cost_threshold_usd = ?, temperature = ?, avatar = ?, updated_at = CURRENT_TIMESTAMP
                 WHERE id = ?`,
                [
                    agent.name,
                    agent.system_prompt,
                    JSON.stringify(agent.skills),
                    JSON.stringify(agent.tools),
                    agent.status,
                    agent.lga,
                    agent.concurrency_limit,
                    agent.token_quota_daily,
                    agent.cost_threshold_usd,
                    agent.temperature,
                    agent.avatar,
                    agent.id
                ]
            );
        } else {
            db.run(
                `INSERT INTO ai_agents (id, name, system_prompt, skills, tools, status, lga, concurrency_limit, token_quota_daily, cost_threshold_usd, temperature, avatar)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    agent.id,
                    agent.name,
                    agent.system_prompt,
                    JSON.stringify(agent.skills),
                    JSON.stringify(agent.tools),
                    agent.status,
                    agent.lga,
                    agent.concurrency_limit,
                    agent.token_quota_daily,
                    agent.cost_threshold_usd,
                    agent.temperature,
                    agent.avatar
                ]
            );
        }
        mirrorAgentToMemoryProfile(db, agent);
    }
    saveDb();
}

export async function getAllAIAgents(): Promise<AIAgent[]> {
    await seedDefaultAIAgents();
    const db = await getDb();
    const stmt = db.prepare(`SELECT * FROM ai_agents ORDER BY created_at DESC`);
    const agents: AIAgent[] = [];
    while (stmt.step()) {
        const row = stmt.getAsObject();
        agents.push({
            id: row.id as string,
            name: row.name as string,
            system_prompt: row.system_prompt as string,
            skills: row.skills ? JSON.parse(row.skills as string) : [],
            tools: row.tools ? JSON.parse(row.tools as string) : [],
            status: row.status as 'active' | 'paused',
            lga: row.lga as string,
            concurrency_limit: (row.concurrency_limit as number) || 5,
            token_quota_daily: (row.token_quota_daily as number) || 10000,
            cost_threshold_usd: (row.cost_threshold_usd as number) || 1.0,
            temperature: (row.temperature as number) || 0.2,
            tokens_used_today: (row.tokens_used_today as number) || 0,
            success_count: (row.success_count as number) || 0,
            escalation_count: (row.escalation_count as number) || 0,
            avatar: row.avatar as string || '🤖',
            created_at: row.created_at as string
        });
    }
    stmt.free();
    return agents;
}

export async function getAIAgentById(id: string): Promise<AIAgent | null> {
    const db = await getDb();
    const stmt = db.prepare(`SELECT * FROM ai_agents WHERE id = ?`);
    stmt.bind([id]);
    let agent: AIAgent | null = null;
    if (stmt.step()) {
        const row = stmt.getAsObject();
        agent = {
            id: row.id as string,
            name: row.name as string,
            system_prompt: row.system_prompt as string,
            skills: row.skills ? JSON.parse(row.skills as string) : [],
            tools: row.tools ? JSON.parse(row.tools as string) : [],
            status: row.status as 'active' | 'paused',
            lga: row.lga as string,
            concurrency_limit: (row.concurrency_limit as number) || 5,
            token_quota_daily: (row.token_quota_daily as number) || 10000,
            cost_threshold_usd: (row.cost_threshold_usd as number) || 1.0,
            temperature: (row.temperature as number) || 0.2,
            tokens_used_today: (row.tokens_used_today as number) || 0,
            success_count: (row.success_count as number) || 0,
            escalation_count: (row.escalation_count as number) || 0,
            avatar: row.avatar as string || '🤖',
            created_at: row.created_at as string
        };
    }
    stmt.free();
    return agent;
}

export async function createAIAgent(agent: AIAgent): Promise<void> {
    const db = await getDb();
    db.run(
        `INSERT INTO ai_agents (id, name, system_prompt, skills, tools, status, lga, concurrency_limit, token_quota_daily, cost_threshold_usd, temperature)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
            agent.id,
            agent.name,
            agent.system_prompt,
            JSON.stringify(agent.skills || []),
            JSON.stringify(agent.tools || []),
            agent.status || 'active',
            agent.lga || 'All',
            agent.concurrency_limit || 5,
            agent.token_quota_daily || 10000,
            agent.cost_threshold_usd || 1.0,
            agent.temperature || 0.2
        ]
    );
    mirrorAgentToMemoryProfile(db, agent);
    saveDb();
}

export async function updateAIAgent(id: string, updates: Partial<AIAgent>): Promise<boolean> {
    const db = await getDb();
    const existing = await getAIAgentById(id);
    if (!existing) return false;

    const name = updates.name ?? existing.name;
    const system_prompt = updates.system_prompt ?? existing.system_prompt;
    const skills = updates.skills ? JSON.stringify(updates.skills) : JSON.stringify(existing.skills);
    const tools = updates.tools ? JSON.stringify(updates.tools) : JSON.stringify(existing.tools);
    const status = updates.status ?? existing.status;
    const lga = updates.lga ?? existing.lga;
    const concurrency_limit = updates.concurrency_limit ?? existing.concurrency_limit;
    const token_quota_daily = updates.token_quota_daily ?? existing.token_quota_daily;
    const cost_threshold_usd = updates.cost_threshold_usd ?? existing.cost_threshold_usd;
    const temperature = updates.temperature ?? existing.temperature;
    const tokens_used_today = updates.tokens_used_today ?? existing.tokens_used_today;

    db.run(
        `UPDATE ai_agents
         SET name = ?, system_prompt = ?, skills = ?, tools = ?, status = ?, lga = ?,
             concurrency_limit = ?, token_quota_daily = ?, cost_threshold_usd = ?, temperature = ?, tokens_used_today = ?, updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
        [name, system_prompt, skills, tools, status, lga, concurrency_limit, token_quota_daily, cost_threshold_usd, temperature, tokens_used_today, id]
    );
    mirrorAgentToMemoryProfile(db, { ...existing, name, system_prompt, skills: updates.skills || existing.skills, tools: updates.tools || existing.tools, status, lga, concurrency_limit, token_quota_daily, cost_threshold_usd, temperature, tokens_used_today } as AIAgent);
    saveDb();
    return true;
}

export async function deleteAIAgent(id: string): Promise<boolean> {
    const db = await getDb();
    db.run(`DELETE FROM ai_agents WHERE id = ?`, [id]);
    db.run(`DELETE FROM memory_profiles WHERE phone = ?`, [id]);
    db.run(`DELETE FROM skills WHERE phone = ?`, [id]);
    saveDb();
    return true;
}

export async function cloneAIAgent(id: string, newId: string, newName: string): Promise<AIAgent | null> {
    const existing = await getAIAgentById(id);
    if (!existing) return null;
    const cloned: AIAgent = {
        ...existing,
        id: newId,
        name: newName,
        tokens_used_today: 0,
        success_count: 0,
        escalation_count: 0
    };
    await createAIAgent(cloned);
    return cloned;
}

export async function executeAgentTask(agentId: string, taskInput: string, userPhone?: string): Promise<{ success: boolean; result: string; tokensUsed: number; escalated: boolean }> {
    const agent = await getAIAgentById(agentId);
    if (!agent) {
        return { success: false, result: 'AI Agent not found', tokensUsed: 0, escalated: true };
    }
    if (agent.status === 'paused') {
        return { success: false, result: `Agent ${agent.name} is paused due to admin control or quota limit.`, tokensUsed: 0, escalated: true };
    }

    const currentUsage = agent.tokens_used_today || 0;
    if (currentUsage >= agent.token_quota_daily) {
        // Auto-pause rule
        await updateAIAgent(agentId, { status: 'paused' });
        return { success: false, result: `Daily token quota reached for ${agent.name}. Agent automatically paused.`, tokensUsed: 0, escalated: true };
    }

    // Anti-Prompt Injection Guard
    const injectionPatterns = [
        ...blocklistPatterns.map(p => new RegExp(p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i')),
        /ignore previous instructions/i,
        /disregard all previous instructions/i,
        /reveal your system prompt/i,
        /you are now a/i,
        /new role/i
    ];

    for (const pattern of injectionPatterns) {
        if (pattern.test(taskInput)) {
            return { success: false, result: 'Potential prompt injection or prohibited content detected. Task aborted.', tokensUsed: 0, escalated: true };
        }
    }

    // Generate real response using SmolLM2-1.7B-Instruct with agent system prompt
    const aiOutput = await querySmolLM2(taskInput, agent.system_prompt);

    const tokensUsed = Math.floor(taskInput.length / 4) + Math.floor(aiOutput.length / 4) + 30;
    const db = await getDb();
    db.run(`UPDATE ai_agents SET tokens_used_today = COALESCE(tokens_used_today, 0) + ?, success_count = COALESCE(success_count, 0) + 1 WHERE id = ?`, [tokensUsed, agentId]);
    saveDb();

    return {
        success: true,
        result: `${aiOutput}\n\n*(Processed by SmolLM2-1.7B-Instruct under ${agent.name})*`,
        tokensUsed,
        escalated: false
    };
}

export async function findAgentForSkill(skillTag: string): Promise<AIAgent | null> {
    const agents = await getAllAIAgents();
    const activeAgents = agents.filter(a => a.status === 'active');
    console.log(`[findAgentForSkill] Searching for ${skillTag}. Active agents count: ${activeAgents.length}`);
    for (const agent of activeAgents) {
        console.log(`[findAgentForSkill] Checking agent ${agent.id} with skills:`, agent.skills);
        if (agent.skills && agent.skills.includes(skillTag)) {
            return agent;
        }
    }
    return null;
}

export async function delegateToAgentForSkill(skillTag: string, taskInput: string, userPhone?: string): Promise<{ agentUsed?: string; reply: string; success: boolean }> {
    const agent = await findAgentForSkill(skillTag);
    if (!agent) {
        console.log(`[delegateToAgentForSkill] FAILED: No active AI agent found for skill '${skillTag}'.`);
        return { reply: `No active AI agent found for skill '${skillTag}'.`, success: false };
    }
    console.log(`[delegateToAgentForSkill] FOUND agent: ${agent.id} for skill '${skillTag}'`);
    
    let pointDeducted = false;
    if (userPhone && skillTag !== 'support_triage') {
        // Free skills don't deduct points, but for now we assume some are paid.
        // Actually, let's just use the points Engine.
        const res = await deductPoints(userPhone, 1, `AI Agent task: ${skillTag}`, false);
        if (res.success) {
            pointDeducted = true;
            // Pay the agent
            await addPoints(agent.id, 1, 'Earned from task execution');
        } else {
            console.log(`[delegateToAgentForSkill] FAILED: Insufficient points for user ${userPhone}`);
            return { agentUsed: agent.id, reply: 'Insufficient points for this AI agent task. Please top up.', success: false };
        }
    }
    const execution = await executeAgentTask(agent.id, taskInput, userPhone);
    
    if (!execution.success) {
        console.log(`[delegateToAgentForSkill] FAILED: execution failed for agent ${agent.id}:`, execution);
        return { agentUsed: agent.id, reply: execution.result, success: false };
    }
    console.log(`[delegateToAgentForSkill] SUCCESS: agent ${agent.id} executed task.`);
    return {
        agentUsed: agent.id,
        reply: `🤖 *${agent.name}*\n${execution.result}`,
        success: true
    };
}

