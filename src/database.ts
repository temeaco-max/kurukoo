import initSqlJs from 'sql.js';
import fs from 'fs';
import path from 'path';

let db: any = null;
const dbFilePath = process.env.DB_PATH || path.join(process.cwd(), 'kurukoo.sqlite');

export async function getDb() {
  if (db) return db;
  const SQL = await initSqlJs();
  if (fs.existsSync(dbFilePath)) {
    db = new SQL.Database(fs.readFileSync(dbFilePath));
    initTables(db);
    initEconomicParticipantTables(db);
    initExecutionTables(db);
    auditAppointmentSkillFlows(db);
    saveDb();
  } else {
    db = new SQL.Database();
    initTables(db);
    initEconomicParticipantTables(db);
    initExecutionTables(db);
    seedSkillFlows(db);
    if (process.env.NODE_ENV !== 'production') {
      seedDemoProviders(db);
    }
    auditAppointmentSkillFlows(db);
    saveDb();
    console.log(`Kurukoo database initialized${process.env.NODE_ENV === 'production' ? '' : ' with development seed data'}.`);
  }
  return db;
}

let saveTimer: NodeJS.Timeout | null = null;
const SAVE_DEBOUNCE_MS = Math.max(50, Number(process.env.KURUKOO_DB_SAVE_DEBOUNCE_MS || 250));

function flushDb() {
  if (!db) return;
  const data = db.export();
  const directory = path.dirname(dbFilePath);
  fs.mkdirSync(directory, { recursive: true });
  const tempPath = path.join(directory, `.${path.basename(dbFilePath)}.${process.pid}.tmp`);
  fs.writeFileSync(tempPath, Buffer.from(data));
  fs.renameSync(tempPath, dbFilePath);
}

export function saveDb(immediate = false) {
  if (!db) return;
  if (immediate) {
    if (saveTimer) {
      clearTimeout(saveTimer);
      saveTimer = null;
    }
    flushDb();
    return;
  }
  if (saveTimer) return;
  saveTimer = setTimeout(() => {
    saveTimer = null;
    flushDb();
  }, SAVE_DEBOUNCE_MS);
}

process.once('beforeExit', () => flushDb());

function initTables(database: any) {
  database.run(`
    CREATE TABLE IF NOT EXISTS system_settings (key TEXT PRIMARY KEY, value TEXT);
    CREATE TABLE IF NOT EXISTS memory_profiles (
      phone TEXT PRIMARY KEY, 
      name TEXT, 
      email TEXT, 
      location TEXT, 
      primary_lga TEXT, 
      primary_state TEXT, 
      country TEXT DEFAULT 'ng', 
      subscription_tier TEXT DEFAULT 'Base', 
      points_balance INTEGER DEFAULT 30, 
      wallet_balance_minor INTEGER DEFAULT 30, 
      currency TEXT DEFAULT 'NGN', 
      preferences TEXT, 
      behavior_patterns TEXT, 
      inferred_roles TEXT, 
      grace_leads INTEGER DEFAULT 0, 
      fcm_token TEXT, 
      is_available INTEGER DEFAULT 0, 
      is_contributor INTEGER DEFAULT 0, 
      nin TEXT, 
      verified_provider INTEGER DEFAULT 0, 
      provider_type TEXT NOT NULL DEFAULT 'human', 
      livecast_signals_remaining INTEGER DEFAULT 30, 
      trust_score REAL DEFAULT 5.0, 
      last_active_at TEXT, 
      created_at TEXT DEFAULT CURRENT_TIMESTAMP, 
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS profile_access_log (id INTEGER PRIMARY KEY AUTOINCREMENT, phone TEXT, service_name TEXT, action TEXT, timestamp TEXT DEFAULT CURRENT_TIMESTAMP);
    CREATE TABLE IF NOT EXISTS keep_alive_analytics (id INTEGER PRIMARY KEY AUTOINCREMENT, phone TEXT, event_type TEXT, cost_impact REAL DEFAULT 0.0, metadata TEXT, timestamp TEXT DEFAULT CURRENT_TIMESTAMP);
    CREATE TABLE IF NOT EXISTS temp_sessions (sessionId TEXT PRIMARY KEY, location TEXT, interactions TEXT, preferences TEXT, created_at TEXT DEFAULT CURRENT_TIMESTAMP);
    CREATE TABLE IF NOT EXISTS skills (
      id INTEGER PRIMARY KEY AUTOINCREMENT, 
      phone TEXT, 
      skill TEXT, 
      source TEXT DEFAULT 'explicit', 
      confidence REAL DEFAULT 1.0, 
      is_available INTEGER DEFAULT 1, 
      operation_mode TEXT DEFAULT 'stationary', 
      hourly_rate REAL DEFAULT 0, 
      rating REAL DEFAULT 5.0, 
      jobs_completed INTEGER DEFAULT 0, 
      equipment TEXT, 
      availability_schedule TEXT, 
      service_radius_km REAL DEFAULT 10, 
      transport_mode TEXT, 
      pricing_model TEXT, 
      payment_method TEXT, 
      booking_mode TEXT DEFAULT 'instant', 
      products TEXT, 
      verified_artist INTEGER DEFAULT 0, 
      FOREIGN KEY(phone) REFERENCES memory_profiles(phone)
    );
    CREATE TABLE IF NOT EXISTS skill_flows (skill TEXT PRIMARY KEY, question_set TEXT, post_match_action TEXT, payment_model TEXT, fulfillment_instructions TEXT, available_locales TEXT DEFAULT '["en"]', booking_mode TEXT DEFAULT 'instant');
    CREATE TABLE IF NOT EXISTS messages (id INTEGER PRIMARY KEY AUTOINCREMENT, phone TEXT, sender TEXT, content TEXT, channel TEXT DEFAULT 'pwa', card_data TEXT, status TEXT DEFAULT 'sent', whatsapp_msg_id TEXT, created_at TEXT DEFAULT CURRENT_TIMESTAMP);
    CREATE TABLE IF NOT EXISTS credit_transactions (id INTEGER PRIMARY KEY AUTOINCREMENT, phone TEXT, amount INTEGER, type TEXT, description TEXT, created_at TEXT DEFAULT CURRENT_TIMESTAMP);
    CREATE TABLE IF NOT EXISTS pulse_sessions (id INTEGER PRIMARY KEY AUTOINCREMENT, phone TEXT, skill TEXT, lat REAL, lng REAL, expires_at TEXT, active INTEGER DEFAULT 1);
    CREATE TABLE IF NOT EXISTS provider_presence (phone TEXT PRIMARY KEY, is_live INTEGER DEFAULT 0, operation_mode TEXT DEFAULT 'stationary', last_lat REAL, last_lng REAL, fuzzed_radius_m INTEGER DEFAULT 100, live_until TEXT, last_confirmed TEXT, updated_at TEXT DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY(phone) REFERENCES memory_profiles(phone));
    CREATE TABLE IF NOT EXISTS user_behavior_signals (id INTEGER PRIMARY KEY AUTOINCREMENT, phone TEXT, signal_type TEXT, key TEXT, value TEXT, strength REAL DEFAULT 0.5, last_seen TEXT DEFAULT CURRENT_TIMESTAMP, created_at TEXT DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY(phone) REFERENCES memory_profiles(phone));
    CREATE TABLE IF NOT EXISTS escrow (id INTEGER PRIMARY KEY AUTOINCREMENT, order_id TEXT, buyer_phone TEXT, provider_phone TEXT, amount_minor INTEGER, description TEXT, status TEXT DEFAULT 'held', created_at TEXT DEFAULT CURRENT_TIMESTAMP);
    CREATE TABLE IF NOT EXISTS disputes (id INTEGER PRIMARY KEY AUTOINCREMENT, phone TEXT, order_id TEXT, reason TEXT, status TEXT DEFAULT 'open', resolution TEXT, type TEXT DEFAULT 'dispute', fault_party TEXT, fault_phone TEXT, created_at TEXT DEFAULT CURRENT_TIMESTAMP);
    CREATE TABLE IF NOT EXISTS content (slug TEXT PRIMARY KEY, title TEXT, body TEXT, type TEXT, author TEXT, created_at TEXT DEFAULT CURRENT_TIMESTAMP, updated_at TEXT DEFAULT CURRENT_TIMESTAMP);
    CREATE TABLE IF NOT EXISTS money_circles (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT, creator_phone TEXT, target_amount REAL, status TEXT DEFAULT 'active', created_at TEXT DEFAULT CURRENT_TIMESTAMP);
    CREATE TABLE IF NOT EXISTS circle_members (id INTEGER PRIMARY KEY AUTOINCREMENT, circle_id INTEGER, phone TEXT, role TEXT DEFAULT 'member');
    CREATE TABLE IF NOT EXISTS circle_contributions (id INTEGER PRIMARY KEY AUTOINCREMENT, circle_id INTEGER, phone TEXT, amount REAL, created_at TEXT DEFAULT CURRENT_TIMESTAMP);
    CREATE TABLE IF NOT EXISTS emergency_contacts (id INTEGER PRIMARY KEY AUTOINCREMENT, country TEXT, name TEXT, phone TEXT);
    CREATE TABLE IF NOT EXISTS survey_opportunities (id INTEGER PRIMARY KEY AUTOINCREMENT, question TEXT, options TEXT);
    CREATE TABLE IF NOT EXISTS survey_inventory (id INTEGER PRIMARY KEY AUTOINCREMENT, item TEXT);
    CREATE TABLE IF NOT EXISTS livecast_sessions (id INTEGER PRIMARY KEY AUTOINCREMENT, phone TEXT, lat REAL, lng REAL);
    CREATE TABLE IF NOT EXISTS processed_transactions (id INTEGER PRIMARY KEY AUTOINCREMENT, tx_ref TEXT UNIQUE);
    CREATE TABLE IF NOT EXISTS referrals (id INTEGER PRIMARY KEY AUTOINCREMENT, referrer_phone TEXT, referred_phone TEXT, rewarded INTEGER DEFAULT 0, status TEXT DEFAULT 'pending', referral_code TEXT, created_at TEXT DEFAULT CURRENT_TIMESTAMP);
    CREATE TABLE IF NOT EXISTS unknown_intents (id INTEGER PRIMARY KEY AUTOINCREMENT, query TEXT);
    CREATE TABLE IF NOT EXISTS sent_questions (id INTEGER PRIMARY KEY AUTOINCREMENT, phone TEXT, question TEXT);
    CREATE TABLE IF NOT EXISTS compliance_events (id INTEGER PRIMARY KEY AUTOINCREMENT, event TEXT);
    CREATE TABLE IF NOT EXISTS community_posts (id INTEGER PRIMARY KEY AUTOINCREMENT, author TEXT, content TEXT);
    CREATE TABLE IF NOT EXISTS price_checks (id INTEGER PRIMARY KEY AUTOINCREMENT, item TEXT, price REAL);
    CREATE TABLE IF NOT EXISTS classifieds (id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT, price REAL);
    CREATE TABLE IF NOT EXISTS appointment_slots (id INTEGER PRIMARY KEY AUTOINCREMENT, client_phone TEXT, provider_phone TEXT, slot_time TEXT, status TEXT);
    CREATE TABLE IF NOT EXISTS affiliate_clicks (id INTEGER PRIMARY KEY AUTOINCREMENT, product TEXT);
    CREATE TABLE IF NOT EXISTS audit_logs (id INTEGER PRIMARY KEY AUTOINCREMENT, action TEXT, details TEXT, created_at TEXT DEFAULT CURRENT_TIMESTAMP);
    CREATE TABLE IF NOT EXISTS orders (id TEXT PRIMARY KEY, phone TEXT, order_type TEXT, provider_phone TEXT, amount INTEGER, status TEXT, idempotency_key TEXT UNIQUE, created_at TEXT DEFAULT CURRENT_TIMESTAMP);
    CREATE TABLE IF NOT EXISTS ad_campaigns (id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT, desc TEXT, image_url TEXT, target_keyword TEXT, credits_budget INTEGER, credits_spent INTEGER DEFAULT 0, status TEXT DEFAULT 'active', created_at TEXT DEFAULT CURRENT_TIMESTAMP, updated_at TEXT DEFAULT CURRENT_TIMESTAMP);
    CREATE TABLE IF NOT EXISTS email_log (id INTEGER PRIMARY KEY AUTOINCREMENT, recipient TEXT, subject TEXT, body TEXT, status TEXT, sent_at TEXT DEFAULT CURRENT_TIMESTAMP);
    CREATE TABLE IF NOT EXISTS future_plans (id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT, description TEXT, phase TEXT, status TEXT);
    CREATE TABLE IF NOT EXISTS ai_agents (id TEXT PRIMARY KEY, name TEXT, system_prompt TEXT, skills TEXT, tools TEXT, status TEXT DEFAULT 'active', lga TEXT, concurrency_limit INTEGER DEFAULT 5, token_quota_daily INTEGER DEFAULT 10000, cost_threshold_usd REAL DEFAULT 1.0, temperature REAL DEFAULT 0.2, tokens_used_today INTEGER DEFAULT 0, success_count INTEGER DEFAULT 0, escalation_count INTEGER DEFAULT 0, avatar TEXT DEFAULT '🤖', created_at TEXT DEFAULT CURRENT_TIMESTAMP, updated_at TEXT DEFAULT CURRENT_TIMESTAMP);
    CREATE TABLE IF NOT EXISTS scam_reports (id INTEGER PRIMARY KEY AUTOINCREMENT, reporter_phone TEXT, reported_phone TEXT, description TEXT, status TEXT DEFAULT 'pending', created_at TEXT DEFAULT CURRENT_TIMESTAMP);
    CREATE TABLE IF NOT EXISTS social_posts (id INTEGER PRIMARY KEY AUTOINCREMENT, platform TEXT, content TEXT, scheduled_time TEXT, status TEXT DEFAULT 'pending');
    CREATE TABLE IF NOT EXISTS partnerships (id INTEGER PRIMARY KEY AUTOINCREMENT, company TEXT, contact TEXT, status TEXT, next_action TEXT, due_date TEXT, notes TEXT);
    CREATE TABLE IF NOT EXISTS micro_tasks (id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT, description TEXT, skill_tag TEXT, credits_reward INTEGER, status TEXT DEFAULT 'available', assigned_to TEXT);
    CREATE TABLE IF NOT EXISTS service_categories (id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT, options TEXT);
    CREATE TABLE IF NOT EXISTS success_stories (id INTEGER PRIMARY KEY AUTOINCREMENT, story_text TEXT, category TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP, used INTEGER DEFAULT 0);
    CREATE TABLE IF NOT EXISTS badges (phone TEXT, badge_type TEXT, awarded_at DATETIME DEFAULT CURRENT_TIMESTAMP, PRIMARY KEY(phone, badge_type));
    CREATE TABLE IF NOT EXISTS celebrity_demand (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT UNIQUE, category TEXT, interested_users INTEGER DEFAULT 0, threshold INTEGER DEFAULT 5000, status TEXT DEFAULT 'tracking', report_generated INTEGER DEFAULT 0, contacted INTEGER DEFAULT 0);
    CREATE TABLE IF NOT EXISTS provider_leaderboard (phone TEXT PRIMARY KEY, skill TEXT, monthly_jobs INTEGER DEFAULT 0, monthly_rating REAL DEFAULT 0.0, rank INTEGER DEFAULT 0);
    CREATE TABLE IF NOT EXISTS pricing (plan TEXT, country TEXT, monthly_price_minor INTEGER, currency TEXT, credits_per_month INTEGER, features TEXT, active INTEGER DEFAULT 1, PRIMARY KEY(plan, country));
    CREATE TABLE IF NOT EXISTS provider_subscriptions (phone TEXT PRIMARY KEY, tier TEXT NOT NULL, status TEXT NOT NULL, next_billing_date TEXT NOT NULL, leads_this_month INTEGER DEFAULT 0);
    CREATE TABLE IF NOT EXISTS commission_config (id INTEGER PRIMARY KEY AUTOINCREMENT, type TEXT UNIQUE, rate_minor INTEGER, description TEXT, active INTEGER DEFAULT 1);
  `);
  
  database.run("CREATE INDEX IF NOT EXISTS idx_messages_phone ON messages(phone)");
  database.run("CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at)");
  
  const emergency = [['ng', 'Police Emergency', '112'], ['ng', 'Federal Road Safety (FRSC)', '122'], ['ng', 'Lagos State Emergency (LASEMA)', '767']];
  for (const e of emergency) database.run(`INSERT OR IGNORE INTO emergency_contacts(country, name, phone) VALUES(?,?,?)`, e);
}

function initEconomicParticipantTables(database: any) {
  database.run(`
    CREATE TABLE IF NOT EXISTS economic_offers (
      id TEXT PRIMARY KEY,
      request_id TEXT NOT NULL UNIQUE,
      seller_phone TEXT NOT NULL,
      description TEXT NOT NULL,
      price_minor INTEGER,
      currency TEXT NOT NULL DEFAULT 'NGN',
      source TEXT NOT NULL,
      availability_note TEXT,
      external_source TEXT,
      status TEXT NOT NULL DEFAULT 'available',
      provenance TEXT NOT NULL DEFAULT 'conversationally_created',
      media_reference TEXT,
      external_url TEXT,
      origin_offer_id TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS economic_participants (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      request_id TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('seller', 'delivery_provider', 'external_platform', 'agent')),
      provider_phone TEXT NOT NULL,
      capability TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'invited' CHECK(status IN ('invited', 'offered', 'selected', 'confirmed', 'handover_pending', 'handed_over', 'collected', 'in_progress', 'delivered', 'declined', 'withdrawn')),
      evidence_json TEXT NOT NULL DEFAULT '{}',
      added_at TEXT DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(request_id, role, provider_phone)
    );
    CREATE INDEX IF NOT EXISTS idx_economic_offers_request ON economic_offers(request_id);
    CREATE INDEX IF NOT EXISTS idx_economic_participants_request ON economic_participants(request_id);
    CREATE INDEX IF NOT EXISTS idx_economic_offers_seller_status ON economic_offers(seller_phone, status);
  `);
}

function initExecutionTables(database: any) {
  database.run(`
    CREATE TABLE IF NOT EXISTS provider_execution_connectors (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      provider_phone TEXT NOT NULL,
      connector_id TEXT NOT NULL,
      capability TEXT NOT NULL,
      external_provider_id TEXT,
      authorization_status TEXT NOT NULL DEFAULT 'active' CHECK(authorization_status IN ('active', 'revoked', 'expired')),
      allowed_actions_json TEXT NOT NULL DEFAULT '[]',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(provider_phone, connector_id, capability)
    );
    CREATE TABLE IF NOT EXISTS execution_requests (
      id TEXT PRIMARY KEY,
      request_id TEXT NOT NULL,
      action_id TEXT NOT NULL,
      provider_phone TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('seller', 'delivery_provider', 'external_platform', 'agent')),
      capability TEXT NOT NULL,
      action_requested TEXT NOT NULL,
      idempotency_key TEXT NOT NULL UNIQUE,
      correlation_id TEXT NOT NULL,
      connector_id TEXT NOT NULL,
      authorization_context TEXT NOT NULL DEFAULT '{}',
      status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'dispatched', 'acknowledged', 'in_progress', 'succeeded', 'failed', 'cancelled', 'expired')),
      external_reference TEXT,
      failure_reason TEXT,
      evidence_json TEXT NOT NULL DEFAULT '[]',
      requested_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_provider_execution_connectors_provider ON provider_execution_connectors(provider_phone, capability);
    CREATE INDEX IF NOT EXISTS idx_execution_requests_request ON execution_requests(request_id, requested_at);
    CREATE INDEX IF NOT EXISTS idx_execution_requests_provider ON execution_requests(provider_phone, requested_at);
  `);
}

function seedSkillFlows(database: any) {
  const skills = [
    ['rider', [{ q: 'What is your pickup location?', options: [] }, { q: 'What is your dropoff location?', options: [] }], 'lead', 'credits', 'Find nearest active riders'],
    ['plumber', [{ q: 'What plumbing issue are you facing?', options: ['Leaking pipe', 'Blocked drain', 'Toilet repair', 'Other'] }], 'lead', 'credits', 'Match with certified local plumber'],
    ['electrician', [{ q: 'Describe the electrical job', options: ['Wiring', 'Fixture install', 'Fault finding', 'Other'] }], 'lead', 'credits', 'Match with licensed electrician'],
    ['mechanic', [{ q: 'What is the vehicle issue?', options: ['Engine sound', 'Brakes', 'Oil change', 'Battery', 'Not starting'] }], 'lead', 'credits', 'Match vehicle mechanic'],
    ['phone_repair', [{ q: 'Select your phone issue', options: ['Screen replacement', 'Battery change', 'Charging port', 'Software'] }], 'lead', 'credits', 'Match mobile repair technician'],
    ['order_food', [{ q: 'What would you like to order, and how many?', options: [] }, { q: 'Delivery location', options: [] }], 'order', 'payment', 'Match catalog vendor, confirm inventory, then dispatch if needed'],
    ['buy_car', [{ q: 'Make, model, year and budget', options: [] }], 'listing', 'escrow', 'Match verified vehicle sellers and inspection options'],
    ['buy_ticket', [{ q: 'Which event, date, quantity and seating preference?', options: [] }], 'reservation', 'payment', 'Check real inventory and reserve only after provider confirmation'],
    ['verified_artist', [{ q: 'What event are you planning?', options: ['Wedding', 'Corporate', 'Concert', 'Private event'] }, { q: 'Event date and venue', options: [] }, { q: 'Approximate budget', options: [] }], 'booking', 'escrow', 'Match verified talent/representative'],
    ['keke_driver', [{ q: 'Pickup and destination', options: [] }, { q: 'When?', options: ['Now', 'Later'] }], 'ride', 'payment', 'Match available keke provider'],
    ['okada_rider', [{ q: 'Pickup and destination', options: [] }, { q: 'When?', options: ['Now', 'Later'] }], 'ride', 'payment', 'Match available rider'],
    ['find_worker', [{ q: 'What work do you need done?', options: [] }, { q: 'Where?', options: [] }, { q: 'When?', options: [] }], 'lead', 'quote', 'Match by skill, presence, availability and trust'],
    ['repair', [{ q: 'What needs fixing?', options: [] }, { q: 'Where are you?', options: [] }, { q: 'How urgent is it?', options: ['Now', 'Today', 'Flexible'] }], 'lead', 'quote', 'Match the appropriate repair provider'],
    ['emergency', [{ q: 'What is happening and where?', options: [] }], 'dispatch', 'none', 'Provide verified emergency contacts and escalate to appropriate services'],
    ['product_sourcing', [{ q: 'What product, quantity and budget?', options: [] }, { q: 'Delivery location', options: [] }], 'order', 'escrow', 'Source from verified catalog providers and confirm inventory'],
    ['security_personnel', [{ q: 'What protection/service is needed?', options: [] }, { q: 'Location, date and duration', options: [] }, { q: 'Vetting level required?', options: ['Standard', 'Enhanced'] }], 'booking', 'escrow', 'Match licensed/verified security providers'],
    ['sports_coach', [{ q: 'Sport, level and schedule', options: [] }], 'booking', 'payment', 'Match sports provider']
  ];
  for (const s of skills) {
    database.run(`INSERT OR IGNORE INTO skill_flows(skill, question_set, post_match_action, payment_model, fulfillment_instructions) VALUES(?,?,?,?,?)`, [s[0], JSON.stringify(s[1]), s[2], s[3], s[4]]);
  }
}

function seedDemoProviders(database: any) {
  const skills = ['plumber', 'electrician', 'mechanic', 'carpenter', 'painter', 'tailor', 'baker', 'caterer', 'photographer', 'cleaner', 'tutor', 'nanny', 'nurse', 'doctor', 'dj', 'event_planner', 'solar_installer', 'phone_repair', 'graphic_designer', 'web_developer', 'delivery', 'rider'];
  for (let i = 1; i <= 40; i++) {
    const phone = `+23480${String(i).padStart(8, '0')}`;
    const skill = skills[i % skills.length];
    database.run(`INSERT OR IGNORE INTO memory_profiles(phone, name, location, country, subscription_tier, wallet_balance_minor, is_available) VALUES(?,?,?,'ng','Plus',200,1)`, [phone, `Provider ${i}`, 'Lagos']);
    database.run(`INSERT OR IGNORE INTO skills(phone, skill, source, confidence, is_available, operation_mode, hourly_rate, rating, jobs_completed) VALUES(?,?, 'explicit',1,1,'mobile',2500,4.8,15)`, [phone, skill]);
  }
}

function auditAppointmentSkillFlows(database: any) {
  return 0;
}

export async function searchUserMessages(phone: string, keyword: string): Promise<any[]> {
  const database = await getDb();
  const stmt = database.prepare(`SELECT * FROM messages WHERE phone=? AND content LIKE ? ORDER BY id DESC`);
  stmt.bind([phone, `%${keyword}%`]);
  const results: any[] = [];
  while (stmt.step()) results.push(stmt.getAsObject());
  stmt.free();
  return results;
}

export async function searchMessagesByKeyword(phone: string, keyword: string): Promise<any[]> {
  return searchUserMessages(phone, keyword);
}

export async function purgeExpiredData(): Promise<{ messagesDeleted: number; tempSessionsDeleted: number; pulseLocationsDeleted: number }> {
  const database = await getDb();
  const a = new Date(Date.now() - 365 * 86400000).toISOString();
  database.run(`DELETE FROM messages WHERE created_at<?`, [a]);
  const messagesDeleted = database.getRowsModified();
  const b = new Date(Date.now() - 7 * 86400000).toISOString();
  database.run(`DELETE FROM temp_sessions WHERE created_at<?`, [b]);
  const tempSessionsDeleted = database.getRowsModified();
  const c = new Date(Date.now() - 30 * 86400000).toISOString();
  database.run(`DELETE FROM pulse_sessions WHERE expires_at<?`, [c]);
  const pulseLocationsDeleted = database.getRowsModified();
  try { database.run(`DELETE FROM provider_presence WHERE updated_at<? AND is_live=0`, [c]); } catch { }
  try { database.run(`DELETE FROM audit_logs WHERE created_at<?`, [c]); } catch { }
  saveDb();
  return { messagesDeleted, tempSessionsDeleted, pulseLocationsDeleted };
}

export async function updateProviderPresence(p: { phone: string; is_live?: boolean | number; operation_mode?: string; last_lat?: number; last_lng?: number; fuzzed_radius_m?: number; live_until?: string }): Promise<void> {
  const database = await getDb();
  const isLive = p.is_live ? 1 : 0;
  const now = new Date().toISOString();
  const s = database.prepare("SELECT phone FROM provider_presence WHERE phone=?");
  s.bind([p.phone]);
  const exists = s.step();
  s.free();
  if (exists) {
    database.run(`UPDATE provider_presence SET is_live=COALESCE(?,is_live),operation_mode=COALESCE(?,operation_mode),last_lat=COALESCE(?,last_lat),last_lng=COALESCE(?,last_lng),fuzzed_radius_m=COALESCE(?,fuzzed_radius_m),live_until=COALESCE(?,live_until),last_confirmed=?,updated_at=? WHERE phone=?`, [p.is_live !== undefined ? isLive : null, p.operation_mode || null, p.last_lat ?? null, p.last_lng ?? null, p.fuzzed_radius_m ?? null, p.live_until || null, now, now, p.phone]);
  } else {
    database.run(`INSERT INTO provider_presence(phone,is_live,operation_mode,last_lat,last_lng,fuzzed_radius_m,live_until,last_confirmed,updated_at) VALUES(?,?,?,?,?,?,?,?,?)`, [p.phone, isLive, p.operation_mode || 'stationary', p.last_lat || null, p.last_lng || null, p.fuzzed_radius_m || 100, p.live_until || null, now, now]);
  }
  saveDb();
}

export async function getProviderPresence(phone: string): Promise<any | null> {
  const database = await getDb();
  const s = database.prepare("SELECT * FROM provider_presence WHERE phone=?");
  s.bind([phone]);
  const r = s.step() ? s.getAsObject() : null;
  s.free();
  return r;
}

export async function recordBehaviorSignal(s: { phone: string; signal_type: string; key: string; value: any; strength?: number }): Promise<void> {
  const database = await getDb();
  const v = typeof s.value === 'object' ? JSON.stringify(s.value) : String(s.value);
  const now = new Date().toISOString();
  database.run(`INSERT INTO user_behavior_signals(phone,signal_type,key,value,strength,last_seen,created_at) VALUES(?,?,?,?,?,?,?)`, [s.phone, s.signal_type, s.key, v, s.strength ?? 0.5, now, now]);
  saveDb();
}

export async function getUserBehaviorSignals(phone: string, signalType?: string): Promise<any[]> {
  const database = await getDb();
  let q = "SELECT * FROM user_behavior_signals WHERE phone=?";
  const p: any[] = [phone];
  if (signalType) {
    q += " AND signal_type=?";
    p.push(signalType);
  }
  q += " ORDER BY id DESC LIMIT 50";
  const s = database.prepare(q);
  s.bind(p);
  const r: any[] = [];
  while (s.step()) {
    const row = s.getAsObject();
    try { row.value = JSON.parse(row.value); } catch { }
    r.push(row);
  }
  s.free();
  return r;
}

export async function getSystemSetting(key: string, defaultValue: string = ''): Promise<string> {
  const database = await getDb();
  const s = database.prepare("SELECT value FROM system_settings WHERE key=?");
  s.bind([key]);
  let v = defaultValue;
  if (s.step()) {
    const r = s.getAsObject();
    v = r.value !== undefined ? String(r.value) : defaultValue;
  }
  s.free();
  return v;
}

export async function setSystemSetting(key: string, value: string): Promise<void> {
  const database = await getDb();
  database.run("INSERT OR REPLACE INTO system_settings(key,value) VALUES(?,?)", [key, value]);
  saveDb();
}
