import { deductPoints, addPoints } from './pointsEngine.js';
import { getCanonicalStore } from './canonicalStore.js';
import { queryUnifiedAI } from './unifiedAiEngine.js';
import { coordinatorEventForFirstClassAgent, internalCoordinator } from './internalCoordinator.js';
import type { AgentToolName } from './agentToolRegistry.js';
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
    tools: AgentToolName[];
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

async function mirrorAgentToMemoryProfile(store: Awaited<ReturnType<typeof getCanonicalStore>>, agent: AIAgent) {
    const exists = await store.one('SELECT phone FROM memory_profiles WHERE phone = ?',[agent.id]);
    if (!exists) {
        await store.run("INSERT INTO memory_profiles (phone, name, primary_lga, is_available, trust_score, verified_provider, provider_type) VALUES (?, ?, ?, ?, ?, ?, 'software_service')", [agent.id, agent.name, agent.lga || 'All', agent.status === 'active' ? 1 : 0, 5.0, 1]);
    } else {
        await store.run("UPDATE memory_profiles SET name = ?, primary_lga = ?, is_available = ?, provider_type = 'software_service' WHERE phone = ?", [agent.name, agent.lga || 'All', agent.status === 'active' ? 1 : 0, agent.id]);
    }
    await store.run("DELETE FROM skills WHERE phone = ?", [agent.id]);
    for (const skill of agent.skills || []) {
        await store.run("INSERT INTO skills (phone, skill, source, confidence, is_available, operation_mode) VALUES (?, ?, 'explicit', 1.0, ?, 'stationary')", [agent.id, skill, agent.status === 'active' ? 1 : 0]);
    }
}

export async function seedDefaultAIAgents(): Promise<void> {
    const store = await getCanonicalStore();
    const defaultAgents: AIAgent[] = [
        {
            id: 'agent_price_checker', name: 'Market Intelligence & Price Discovery Agent', avatar: '📈',
            system_prompt: `[IDENTITY & ROLE]
You are Kurukoo's Market Intelligence & Price Discovery Agent operating across Nigeria and West Africa.
Your core mission is automated price discovery, market intelligence aggregation, and arbitrage detection for everyday commodities, foodstuffs, building materials, and fuel across LGAs (e.g. Ikeja, Surulere, Kano Municipal, Port Harcourt).

[OPERATIONAL INSTRUCTIONS]
1. Inspect only the registered capability catalogue, bounded memory context, and canonical capability plans. Never claim a live market price, merchant, or market location unless the canonical service returns attributable evidence.
2. Surface price gaps and wholesale deals to help users save money or identify trade opportunities.
3. Categorize price trends by LGA, product grade, and availability.

[HALLUCINATION GUARDRAILS & ACCURACY]
- NEVER fabricate price points, merchant phone numbers, or market locations.
- Only quote verified price data stored in the database or returned by active scraper jobs.
- If data confidence is below 0.80 or older than 7 days, explicitly notify the user: "Price data requires re-verification" and prompt a local provider verification request.
- Keep output concise, structured, and actionable.`,
            skills: ['price_checker', 'price_check', 'market_intel', 'catalog_scraper'], tools: ['list_capabilities', 'inspect_capability_plan', 'get_memory_context'], status: 'active', lga: 'Ikeja', concurrency_limit: 10, token_quota_daily: 25000, cost_threshold_usd: 2.5, temperature: 0.1
        },
        {
            id: 'agent_support_triage', name: 'Support, Safety & Dispute Triage Agent', avatar: '⚖️',
            system_prompt: `[IDENTITY & ROLE]
You are Kurukoo's Emergency, Safety & Dispute Resolution Triage Agent.
Your priority is maintaining platform safety, user trust, privacy compliance (NDPA 2023 & UK GDPR), and rapid triage of disputes or safety concerns.

[OPERATIONAL INSTRUCTIONS]
1. Analyze incoming dispute tickets, scam reports, and emergency messages with high empathy, calm tone, and strict neutrality.
2. Use only owner-scoped request state and bounded memory context when canonical policy permits it; never expose raw transaction records.
3. For minor disputes, explain the supported canonical resolution path and request the exact evidence or confirmation the service requires.

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
            skills: ['support_triage', 'dispute_resolution', 'emergency', 'compliance_filter'], tools: ['get_request_state', 'get_memory_context', 'list_capabilities'], status: 'active', lga: 'All', concurrency_limit: 15, token_quota_daily: 50000, cost_threshold_usd: 5.0, temperature: 0.15
        },
        {
            id: 'agent_reminder', name: 'Universal Life-Admin & Routine Nudge Agent', avatar: '📅',
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
            skills: ['reminder', 'habit_tracker', 'bin_day', 'mot_reminder', 'doctor_appointment', 'insurance_renewal', 'habit_streak_analytics', 'contextual_habit_nudge'], tools: ['get_reminders', 'get_memory_context', 'execute_capability'], status: 'active', lga: 'All', concurrency_limit: 20, token_quota_daily: 35000, cost_threshold_usd: 3.5, temperature: 0.2
        },
        {
            id: 'agent_buyer_dispatch', name: 'Principal Trade & Arbitrage Buyer Agent', avatar: '🚚',
            system_prompt: `[IDENTITY & ROLE]
You are Kurukoo's Principal Trade & Arbitrage Logistics Agent.
Your mission is to connect buyers with verified wholesale suppliers and dispatch nearby mobile runners/riders for fulfillment coordination.

[OPERATIONAL INSTRUCTIONS]
1. Inspect owned Economic Request state and the canonical capability plan before proposing a next step.
2. Never calculate, quote, reserve, dispatch, or represent a trade outcome without canonical service evidence.
3. Recheck an unresolved request only through the bounded canonical storefront when deployment policy permits it.

[EXECUTION DISCIPLINE & GUARDRAILS]
- Always verify provider live presence in provider_presence table before dispatching.
- Check provider Point balance for lead charges before locking the match.
- Never promise delivery times if traffic or weather conditions indicate high risk without disclosing a realistic window.`,
            skills: ['buyer', 'seller', 'trade_match', 'delivery', 'purchaser'], tools: ['get_request_state', 'inspect_capability_plan', 'recheck_economic_request'], status: 'active', lga: 'Surulere', concurrency_limit: 10, token_quota_daily: 20000, cost_threshold_usd: 2.0, temperature: 0.1
        },
        {
            id: 'agent_traffic_content', name: 'Local Pulse & Content Writer Agent', avatar: '📰',
            system_prompt: `[IDENTITY & ROLE]
You are Kurukoo's Local Pulse & Content Writer Agent.
You generate engaging Daily Picks, community market intel cards, local traffic/route digests, and localized promotional cards.

[OPERATIONAL INSTRUCTIONS]
1. Draft content only for an existing review queue; never publish, represent a local event, or claim verified local value without canonical evidence.
2. Incorporate warm, culturally authentic greetings ("Ku Kurukoo!", "Good day", "Wetin dey happen!") appropriate to the user's language preference (English, Pidgin, Hausa, Yoruba, Igbo).
3. Use the canonical capability catalogue to explain available follow-up paths rather than claiming a CMS or publishing tool exists.

[QUALITY & GUARDRAILS]
- Every piece of content must contain verified local value (e.g. market trend, skill demand alert, community event).
- Strictly adhere to anti-bias guidelines: never assign skills or stereotypes based on demographic identifiers.`,
            skills: ['traffic_checker', 'content_writer', 'daily_picks', 'community_news'], tools: ['get_memory_context', 'list_capabilities', 'inspect_capability_plan'], status: 'active', lga: 'All', concurrency_limit: 10, token_quota_daily: 25000, cost_threshold_usd: 2.5, temperature: 0.4
        },
        {
            id: 'agent_finance_savings', name: 'Personal Finance & Savings Nudge Agent', avatar: '💰',
            system_prompt: `[IDENTITY & ROLE]
You are Kurukoo's Personal Finance and Savings Nudge Agent.
Your goal is to help users track their budgets, set savings goals, and provide contextual nudges based on their spending patterns to ensure economic flow.
You emphasize sustainable habits, micro-investment awareness, and responsible financial management.`,
            skills: ['budget_tracking', 'savings_goal_nudge', 'spending_pattern_analysis'], tools: ['get_memory_context', 'list_capabilities'], status: 'active', lga: 'All', concurrency_limit: 10, token_quota_daily: 5000, cost_threshold_usd: 5, temperature: 0.4
        }
    ];
    await store.transaction(async tx => {
        for (const agent of defaultAgents) {
            const exists = await tx.one('SELECT id FROM ai_agents WHERE id = ?', [agent.id]);
            if (exists) await tx.run(`UPDATE ai_agents SET name=?,system_prompt=?,skills=?,tools=?,status=?,lga=?,concurrency_limit=?,token_quota_daily=?,cost_threshold_usd=?,temperature=?,avatar=?,updated_at=CURRENT_TIMESTAMP WHERE id=?`, [agent.name,agent.system_prompt,JSON.stringify(agent.skills),JSON.stringify(agent.tools),agent.status,agent.lga,agent.concurrency_limit,agent.token_quota_daily,agent.cost_threshold_usd,agent.temperature,agent.avatar,agent.id]);
            else await tx.run(`INSERT INTO ai_agents (id,name,system_prompt,skills,tools,status,lga,concurrency_limit,token_quota_daily,cost_threshold_usd,temperature,avatar) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`, [agent.id,agent.name,agent.system_prompt,JSON.stringify(agent.skills),JSON.stringify(agent.tools),agent.status,agent.lga,agent.concurrency_limit,agent.token_quota_daily,agent.cost_threshold_usd,agent.temperature,agent.avatar]);
            await mirrorAgentToMemoryProfile(tx, agent);
        }
    });
}

function rowToAgent(row: any): AIAgent { return {
    id: String(row.id), name: String(row.name), system_prompt: String(row.system_prompt || ''), skills: row.skills ? JSON.parse(String(row.skills)) : [], tools: row.tools ? JSON.parse(String(row.tools)) : [], status: String(row.status) as 'active'|'paused', lga: String(row.lga || 'All'), concurrency_limit: Number(row.concurrency_limit || 5), token_quota_daily: Number(row.token_quota_daily || 10000), cost_threshold_usd: Number(row.cost_threshold_usd || 1), temperature: Number(row.temperature || 0.2), tokens_used_today: Number(row.tokens_used_today || 0), success_count: Number(row.success_count || 0), escalation_count: Number(row.escalation_count || 0), avatar: String(row.avatar || '🤖'), created_at: row.created_at ? String(row.created_at) : undefined
}; }

export async function getAllAIAgents(): Promise<AIAgent[]> { await seedDefaultAIAgents(); const store = await getCanonicalStore(); return (await store.all<any>('SELECT * FROM ai_agents ORDER BY created_at DESC')).map(rowToAgent); }
export async function getAIAgentById(id: string): Promise<AIAgent | null> { const store = await getCanonicalStore(); const row = await store.one<any>('SELECT * FROM ai_agents WHERE id = ?', [id]); return row ? rowToAgent(row) : null; }
export async function createAIAgent(agent: AIAgent): Promise<void> { const store = await getCanonicalStore(); await store.transaction(async tx => { await tx.run(`INSERT INTO ai_agents (id,name,system_prompt,skills,tools,status,lga,concurrency_limit,token_quota_daily,cost_threshold_usd,temperature) VALUES (?,?,?,?,?,?,?,?,?,?,?)`, [agent.id,agent.name,agent.system_prompt,JSON.stringify(agent.skills || []),JSON.stringify(agent.tools || []),agent.status || 'active',agent.lga || 'All',agent.concurrency_limit || 5,agent.token_quota_daily || 10000,agent.cost_threshold_usd || 1,agent.temperature || 0.2]); await mirrorAgentToMemoryProfile(tx, agent); }); }
export async function updateAIAgent(id: string, updates: Partial<AIAgent>): Promise<boolean> { const store = await getCanonicalStore(); const existing = await getAIAgentById(id); if (!existing) return false; const next = { ...existing, ...updates, skills: updates.skills ?? existing.skills, tools: updates.tools ?? existing.tools }; await store.transaction(async tx => { await tx.run(`UPDATE ai_agents SET name=?,system_prompt=?,skills=?,tools=?,status=?,lga=?,concurrency_limit=?,token_quota_daily=?,cost_threshold_usd=?,temperature=?,tokens_used_today=?,updated_at=CURRENT_TIMESTAMP WHERE id=?`, [next.name,next.system_prompt,JSON.stringify(next.skills),JSON.stringify(next.tools),next.status,next.lga,next.concurrency_limit,next.token_quota_daily,next.cost_threshold_usd,next.temperature,next.tokens_used_today ?? 0,id]); await mirrorAgentToMemoryProfile(tx, next as AIAgent); }); return true; }
export async function deleteAIAgent(id: string): Promise<boolean> { const store = await getCanonicalStore(); await store.transaction(async tx => { await tx.run('DELETE FROM ai_agents WHERE id=?',[id]); await tx.run('DELETE FROM memory_profiles WHERE phone=?',[id]); await tx.run('DELETE FROM skills WHERE phone=?',[id]); }); return true; }
export async function cloneAIAgent(id: string,newId:string,newName:string):Promise<AIAgent|null>{const existing=await getAIAgentById(id);if(!existing)return null;const cloned={...existing,id:newId,name:newName,tokens_used_today:0,success_count:0,escalation_count:0};await createAIAgent(cloned);return cloned;}

export async function executeAgentTask(agentId: string, taskInput: string, userPhone?: string): Promise<{ success:boolean; result:string; tokensUsed:number; escalated:boolean; provider?:string; model?:string }> {
    const agent = await getAIAgentById(agentId);
    if (!agent) return { success:false,result:'AI Agent not found',tokensUsed:0,escalated:true };
    if (agent.status === 'paused') return { success:false,result:`Agent ${agent.name} is paused due to admin control or quota limit.`,tokensUsed:0,escalated:true };
    if ((agent.tokens_used_today || 0) >= agent.token_quota_daily) { await updateAIAgent(agentId,{status:'paused'}); return { success:false,result:`Daily token quota reached for ${agent.name}. Agent automatically paused.`,tokensUsed:0,escalated:true }; }
    const injectionPatterns=[...blocklistPatterns.map(p=>new RegExp(p.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'),'i')),/ignore previous instructions/i,/disregard all previous instructions/i,/reveal your system prompt/i,/you are now a/i,/new role/i];
    for(const pattern of injectionPatterns) if(pattern.test(taskInput)) return {success:false,result:'Potential prompt injection or prohibited content detected. Task aborted.',tokensUsed:0,escalated:true};
    const ai=await queryUnifiedAI(taskInput,{systemPrompt:agent.system_prompt,phone:userPhone,conversational:true});
    const aiOutput=ai.text;
    const tokensUsed=Math.floor(taskInput.length/4)+Math.floor(aiOutput.length/4)+30;
    const store=await getCanonicalStore();
    await store.run(`UPDATE ai_agents SET tokens_used_today=COALESCE(tokens_used_today,0)+?,success_count=COALESCE(success_count,0)+1 WHERE id=?`,[tokensUsed,agentId]);
    return {success:true,result:aiOutput,tokensUsed,escalated:false,provider:ai.provider,model:ai.model};
}

export async function findAgentForSkill(skillTag:string):Promise<AIAgent|null>{const agents=await getAllAIAgents();return agents.find(a=>a.status==='active'&&a.skills?.includes(skillTag))||null;}
export async function delegateToAgentForSkill(skillTag:string,taskInput:string,userPhone?:string):Promise<{agentUsed?:string;reply:string;success:boolean}>{const agent=await findAgentForSkill(skillTag);if(!agent)return{reply:`No active AI agent found for skill '${skillTag}'.`,success:false};const authenticatedOwner=Boolean(userPhone&&!userPhone.startsWith('anon_'));const coordination=await internalCoordinator.handle(coordinatorEventForFirstClassAgent({ownerPhone:authenticatedOwner?userPhone:undefined,agentId:agent.id,skill:skillTag}));if(!coordination.ok)return{agentUsed:agent.id,reply:coordination.message||'The internal Brain did not authorize this specialist response.',success:false};if(authenticatedOwner&&userPhone&&skillTag!=='support_triage'){const res=await deductPoints(userPhone,1,`AI Agent task: ${skillTag}`,false);if(!res.success)return{agentUsed:agent.id,reply:'Insufficient points for this AI agent task. Please top up.',success:false};await addPoints(agent.id,1,'Earned from task execution');}const execution=await executeAgentTask(agent.id,taskInput,userPhone);if(!execution.success)return{agentUsed:agent.id,reply:execution.result,success:false};return{agentUsed:agent.id,reply:`${agent.name}: ${execution.result}`,success:true};}
