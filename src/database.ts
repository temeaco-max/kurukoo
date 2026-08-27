import initSqlJs from 'sql.js';
import fs from 'fs';
import path from 'path';

let db: any = null;
let dbInitialization: Promise<any> | null = null;
const dbFilePath = process.env.DB_PATH || path.join(process.cwd(), 'kurukoo.sqlite');

export async function getDb() {
  if (db) return db;
  if (dbInitialization) return dbInitialization;
  dbInitialization = (async () => {
    const SQL = await initSqlJs();
    if (db) return db;
    if (fs.existsSync(dbFilePath)) {
      db = new SQL.Database(fs.readFileSync(dbFilePath));
      initTables(db);
      initEconomicParticipantTables(db);
      initExecutionTables(db);
      seedCanonicalOperatorState(db);
      auditAppointmentSkillFlows(db);
      saveDb();
    } else {
      db = new SQL.Database();
      initTables(db);
      initEconomicParticipantTables(db);
      initExecutionTables(db);
      seedCanonicalOperatorState(db);
      seedSkillFlows(db);
      if (process.env.NODE_ENV !== 'production') {
        seedDemoProviders(db);
      }
      auditAppointmentSkillFlows(db);
      saveDb();
      console.log(`Kurukoo database initialized${process.env.NODE_ENV === 'production' ? '' : ' with development seed data'}.`);
    }
    return db;
  })();
  try {
    return await dbInitialization;
  } finally {
    dbInitialization = null;
  }
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
      phone_verified_at TEXT,
      email_verified_at TEXT,
      last_active_at TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS profile_access_log (id INTEGER PRIMARY KEY AUTOINCREMENT, phone TEXT, service_name TEXT, action TEXT, timestamp TEXT DEFAULT CURRENT_TIMESTAMP);
    CREATE TABLE IF NOT EXISTS keep_alive_analytics (id INTEGER PRIMARY KEY AUTOINCREMENT, phone TEXT, event_type TEXT, cost_impact REAL DEFAULT 0.0, metadata TEXT, timestamp TEXT DEFAULT CURRENT_TIMESTAMP);
    CREATE TABLE IF NOT EXISTS temp_sessions (sessionId TEXT PRIMARY KEY, location TEXT, interactions TEXT, preferences TEXT, created_at TEXT DEFAULT CURRENT_TIMESTAMP);
    CREATE TABLE IF NOT EXISTS web_artifacts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      phone TEXT NOT NULL,
      kind TEXT NOT NULL DEFAULT 'voice-note',
      title TEXT NOT NULL DEFAULT 'Untitled artifact',
      storage_provider TEXT NOT NULL DEFAULT 'unknown',
      storage_status TEXT NOT NULL DEFAULT 'needs-review',
      storage_url TEXT,
      mime_type TEXT,
      duration_ms INTEGER,
      transcript TEXT,
      transcript_state TEXT NOT NULL DEFAULT 'needs-review',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_web_artifacts_phone_created ON web_artifacts(phone, created_at);
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
      execution_profile_json TEXT NOT NULL DEFAULT '{}',
      payment_method TEXT,
      booking_mode TEXT DEFAULT 'instant',
      products TEXT,
      verified_artist INTEGER DEFAULT 0,
      FOREIGN KEY(phone) REFERENCES memory_profiles(phone)
    );
    CREATE TABLE IF NOT EXISTS skill_flows (skill TEXT PRIMARY KEY, question_set TEXT, post_match_action TEXT, payment_model TEXT, fulfillment_instructions TEXT, available_locales TEXT DEFAULT '["en"]', booking_mode TEXT DEFAULT 'instant', flow_mode TEXT NOT NULL DEFAULT 'economic');
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
    CREATE TABLE IF NOT EXISTS economic_requests (id TEXT PRIMARY KEY, phone TEXT NOT NULL, skill TEXT NOT NULL, category TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'requested', requirements_json TEXT NOT NULL DEFAULT '{}', capabilities_json TEXT NOT NULL DEFAULT '[]', provider_phone TEXT, quote_json TEXT, fulfillment_json TEXT, created_at TEXT DEFAULT CURRENT_TIMESTAMP, updated_at TEXT DEFAULT CURRENT_TIMESTAMP);
    CREATE INDEX IF NOT EXISTS idx_economic_requests_phone_status ON economic_requests(phone, status);
    CREATE TABLE IF NOT EXISTS internal_notifications (id INTEGER PRIMARY KEY AUTOINCREMENT, phone TEXT NOT NULL, title TEXT NOT NULL, body TEXT NOT NULL, link TEXT, status TEXT NOT NULL DEFAULT 'unread', delivery_state TEXT NOT NULL DEFAULT 'queued', provider_reference TEXT, failure_reason TEXT, attempt_count INTEGER NOT NULL DEFAULT 0, max_attempts INTEGER NOT NULL DEFAULT 3, next_attempt_at TEXT, last_attempt_at TEXT, dead_lettered_at TEXT, context_id TEXT, conversation_id TEXT, available_action TEXT, surface TEXT, canonical_action TEXT, object_type TEXT, object_id TEXT, owner_scope TEXT, idempotency_key TEXT, created_at TEXT DEFAULT CURRENT_TIMESTAMP);
    CREATE INDEX IF NOT EXISTS idx_internal_notifications_phone_status ON internal_notifications(phone, status);
    CREATE INDEX IF NOT EXISTS idx_internal_notifications_delivery_state ON internal_notifications(delivery_state);
    CREATE TABLE IF NOT EXISTS relationships (
      id TEXT PRIMARY KEY,
      actor_phone TEXT NOT NULL,
      target_type TEXT NOT NULL,
      target_id TEXT NOT NULL,
      relationship_type TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','revoked','suppressed')),
      notification_preference TEXT NOT NULL DEFAULT 'all' CHECK(notification_preference IN ('all','muted')),
      visibility TEXT NOT NULL DEFAULT 'private' CHECK(visibility IN ('private','contextual')),
      context_json TEXT NOT NULL DEFAULT '{}',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      revoked_at TEXT,
      UNIQUE(actor_phone, target_type, target_id, relationship_type)
    );
    CREATE INDEX IF NOT EXISTS idx_relationships_actor_status ON relationships(actor_phone, status, updated_at DESC);
    CREATE INDEX IF NOT EXISTS idx_relationships_target_status ON relationships(target_type, target_id, status, relationship_type);
    CREATE INDEX IF NOT EXISTS idx_relationships_type_status ON relationships(relationship_type, status, updated_at DESC);
    CREATE TABLE IF NOT EXISTS relationship_blocks (
      blocker_phone TEXT NOT NULL,
      blocked_phone TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY(blocker_phone, blocked_phone)
    );
    CREATE INDEX IF NOT EXISTS idx_relationship_blocks_blocked ON relationship_blocks(blocked_phone, blocker_phone);
    CREATE TABLE IF NOT EXISTS trust_score_ledger (id INTEGER PRIMARY KEY AUTOINCREMENT, phone TEXT NOT NULL, score REAL NOT NULL, breakdown_json TEXT NOT NULL, reason TEXT NOT NULL, created_at TEXT DEFAULT CURRENT_TIMESTAMP);
    CREATE INDEX IF NOT EXISTS idx_trust_score_ledger_phone ON trust_score_ledger(phone, created_at DESC);
    CREATE TABLE IF NOT EXISTS ad_campaigns (id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT, desc TEXT, image_url TEXT, target_keyword TEXT, credits_budget INTEGER, credits_spent INTEGER DEFAULT 0, status TEXT DEFAULT 'active', campaign_type TEXT DEFAULT 'external', disclosure TEXT DEFAULT 'Sponsored', advertiser_name TEXT DEFAULT '', first_party INTEGER DEFAULT 0, cta_text TEXT DEFAULT 'Learn more', destination TEXT DEFAULT '/chat', placement TEXT DEFAULT 'public_discovery', category TEXT DEFAULT 'community', country TEXT DEFAULT 'NG', region TEXT DEFAULT '', start_at TEXT, expires_at TEXT, frequency_cap INTEGER DEFAULT 3, priority INTEGER DEFAULT 0, targeting TEXT DEFAULT '{}', impressions INTEGER DEFAULT 0, clicks INTEGER DEFAULT 0, created_at TEXT DEFAULT CURRENT_TIMESTAMP, updated_at TEXT DEFAULT CURRENT_TIMESTAMP);
    CREATE TABLE IF NOT EXISTS email_log (id INTEGER PRIMARY KEY AUTOINCREMENT, recipient TEXT, subject TEXT, body TEXT, status TEXT, sent_at TEXT DEFAULT CURRENT_TIMESTAMP);
    CREATE TABLE IF NOT EXISTS future_plans (id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT, description TEXT, phase TEXT, status TEXT);
    CREATE TABLE IF NOT EXISTS ai_agents (id TEXT PRIMARY KEY, name TEXT, system_prompt TEXT, skills TEXT, tools TEXT, status TEXT DEFAULT 'active', lga TEXT, concurrency_limit INTEGER DEFAULT 5, token_quota_daily INTEGER DEFAULT 10000, cost_threshold_usd REAL DEFAULT 1.0, temperature REAL DEFAULT 0.2, tokens_used_today INTEGER DEFAULT 0, success_count INTEGER DEFAULT 0, escalation_count INTEGER DEFAULT 0, avatar TEXT DEFAULT '🤖', created_at TEXT DEFAULT CURRENT_TIMESTAMP, updated_at TEXT DEFAULT CURRENT_TIMESTAMP);
    CREATE TABLE IF NOT EXISTS scam_reports (id INTEGER PRIMARY KEY AUTOINCREMENT, reporter_phone TEXT, reported_phone TEXT, description TEXT, status TEXT DEFAULT 'pending', created_at TEXT DEFAULT CURRENT_TIMESTAMP);
    CREATE TABLE IF NOT EXISTS social_posts (id INTEGER PRIMARY KEY AUTOINCREMENT, platform TEXT, content TEXT, scheduled_time TEXT, status TEXT DEFAULT 'pending');
    CREATE TABLE IF NOT EXISTS partnerships (id INTEGER PRIMARY KEY AUTOINCREMENT, company TEXT, contact TEXT, status TEXT, next_action TEXT, due_date TEXT, notes TEXT);
    CREATE TABLE IF NOT EXISTS micro_tasks (id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT, description TEXT, skill_tag TEXT, credits_reward INTEGER, status TEXT DEFAULT 'available', assigned_to TEXT, source_type TEXT, source_id TEXT, verification_kind TEXT, submitted_result TEXT, moderation_note TEXT, approved_by TEXT, approved_at TEXT, created_at TEXT DEFAULT CURRENT_TIMESTAMP, updated_at TEXT DEFAULT CURRENT_TIMESTAMP);
    CREATE TABLE IF NOT EXISTS service_categories (id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT, options TEXT);
    CREATE TABLE IF NOT EXISTS success_stories (id INTEGER PRIMARY KEY AUTOINCREMENT, story_text TEXT, category TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP, used INTEGER DEFAULT 0);
    CREATE TABLE IF NOT EXISTS badges (phone TEXT, badge_type TEXT, awarded_at DATETIME DEFAULT CURRENT_TIMESTAMP, PRIMARY KEY(phone, badge_type));
    CREATE TABLE IF NOT EXISTS celebrity_demand (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT UNIQUE, category TEXT, interested_users INTEGER DEFAULT 0, threshold INTEGER DEFAULT 5000, status TEXT DEFAULT 'tracking', report_generated INTEGER DEFAULT 0, contacted INTEGER DEFAULT 0);
    CREATE TABLE IF NOT EXISTS provider_leaderboard (phone TEXT PRIMARY KEY, skill TEXT, monthly_jobs INTEGER DEFAULT 0, monthly_rating REAL DEFAULT 0.0, rank INTEGER DEFAULT 0);
    CREATE TABLE IF NOT EXISTS pricing (plan TEXT, country TEXT, monthly_price_minor INTEGER, currency TEXT, credits_per_month INTEGER, features TEXT, active INTEGER DEFAULT 1, PRIMARY KEY(plan, country));
    CREATE TABLE IF NOT EXISTS provider_subscriptions (phone TEXT PRIMARY KEY, tier TEXT NOT NULL, status TEXT NOT NULL, next_billing_date TEXT NOT NULL, leads_this_month INTEGER DEFAULT 0);
    CREATE TABLE IF NOT EXISTS commission_config (id INTEGER PRIMARY KEY AUTOINCREMENT, type TEXT UNIQUE, rate_minor INTEGER, description TEXT, active INTEGER DEFAULT 1);
    CREATE TABLE IF NOT EXISTS topics (
      id TEXT PRIMARY KEY,
      slug TEXT NOT NULL UNIQUE,
      author_phone TEXT NOT NULL,
      title TEXT NOT NULL,
      body TEXT NOT NULL,
      type TEXT NOT NULL,
      category TEXT,
      skills_json TEXT NOT NULL DEFAULT '[]',
      city TEXT,
      lga TEXT,
      status TEXT NOT NULL DEFAULT 'submitted' CHECK(status IN ('draft','submitted','public','restricted','removed')),
      moderation_note TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      published_at TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_topics_publication ON topics(status, published_at, updated_at);
    CREATE INDEX IF NOT EXISTS idx_topics_author_updated ON topics(author_phone, updated_at);
    CREATE INDEX IF NOT EXISTS idx_topics_category_publication ON topics(category, status, published_at);
    CREATE TABLE IF NOT EXISTS topic_idempotency_keys (
      author_phone TEXT NOT NULL,
      idempotency_key TEXT NOT NULL,
      topic_id TEXT NOT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY(author_phone, idempotency_key),
      FOREIGN KEY(topic_id) REFERENCES topics(id)
    );
    CREATE TABLE IF NOT EXISTS topic_replies (
      id TEXT PRIMARY KEY,
      topic_id TEXT NOT NULL,
      author_phone TEXT NOT NULL,
      body TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'submitted' CHECK(status IN ('submitted','public','restricted','removed')),
      moderation_note TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(topic_id) REFERENCES topics(id)
    );
    CREATE INDEX IF NOT EXISTS idx_topic_replies_topic_status_created ON topic_replies(topic_id, status, created_at);
    CREATE INDEX IF NOT EXISTS idx_topic_replies_author_updated ON topic_replies(author_phone, updated_at);
    CREATE TABLE IF NOT EXISTS topic_reports (
      id TEXT PRIMARY KEY,
      target_type TEXT NOT NULL CHECK(target_type IN ('topic','reply')),
      target_id TEXT NOT NULL,
      reporter_phone TEXT NOT NULL,
      reason TEXT NOT NULL,
      detail TEXT,
      status TEXT NOT NULL DEFAULT 'open' CHECK(status IN ('open','closed')),
      moderation_note TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      reviewed_at TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_topic_reports_status_created ON topic_reports(status, created_at);
    CREATE UNIQUE INDEX IF NOT EXISTS idx_topic_reports_open_reporter_target ON topic_reports(reporter_phone, target_type, target_id) WHERE status='open';
    CREATE TABLE IF NOT EXISTS topic_resource_links (
      topic_id TEXT NOT NULL,
      resource_slug TEXT NOT NULL,
      created_by TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY(topic_id, resource_slug),
      FOREIGN KEY(topic_id) REFERENCES topics(id),
      FOREIGN KEY(resource_slug) REFERENCES content(slug)
    );
  `);
  for (const migration of [
    "ALTER TABLE memory_profiles ADD COLUMN relationship_visibility TEXT NOT NULL DEFAULT 'private'",
    'ALTER TABLE micro_tasks ADD COLUMN source_type TEXT',
    'ALTER TABLE micro_tasks ADD COLUMN source_id TEXT',
    'ALTER TABLE micro_tasks ADD COLUMN verification_kind TEXT',
    'ALTER TABLE micro_tasks ADD COLUMN submitted_result TEXT',
    'ALTER TABLE micro_tasks ADD COLUMN moderation_note TEXT',
    'ALTER TABLE micro_tasks ADD COLUMN approved_by TEXT',
    'ALTER TABLE micro_tasks ADD COLUMN approved_at TEXT',
    'ALTER TABLE micro_tasks ADD COLUMN created_at TEXT',
    'ALTER TABLE micro_tasks ADD COLUMN updated_at TEXT',
    'ALTER TABLE memory_profiles ADD COLUMN phone_verified_at TEXT',
    'ALTER TABLE memory_profiles ADD COLUMN email_verified_at TEXT',
  ]) { try { database.run(migration); } catch { /* column already exists */ } }
  const skillColumns = database.exec('PRAGMA table_info(skills)')[0]?.values || [];
  if (!skillColumns.some((column: unknown[]) => String(column[1]) === 'execution_profile_json')) {
    database.run("ALTER TABLE skills ADD COLUMN execution_profile_json TEXT NOT NULL DEFAULT '{}'");
  }
  const skillFlowColumns = database.exec('PRAGMA table_info(skill_flows)')[0]?.values || [];
  if (!skillFlowColumns.some((column: unknown[]) => String(column[1]) === 'flow_mode')) database.run("ALTER TABLE skill_flows ADD COLUMN flow_mode TEXT NOT NULL DEFAULT 'economic'");
  database.run("UPDATE micro_tasks SET created_at = COALESCE(created_at, approved_at), updated_at = COALESCE(updated_at, approved_at, created_at) WHERE created_at IS NULL OR updated_at IS NULL");
  database.run("CREATE INDEX IF NOT EXISTS idx_micro_tasks_source ON micro_tasks(source_type, source_id)");
  database.run("CREATE INDEX IF NOT EXISTS idx_micro_tasks_assignee_updated ON micro_tasks(assigned_to, status, updated_at DESC)");
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
      role TEXT NOT NULL CHECK(role IN ('seller', 'delivery_provider', 'service_provider', 'external_platform', 'agent')),
      provider_phone TEXT NOT NULL,
      capability TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'invited' CHECK(status IN ('invited', 'offered', 'selected', 'confirmed', 'handover_pending', 'handed_over', 'collected', 'in_progress', 'completion_reported', 'delivered', 'declined', 'withdrawn')),
      evidence_json TEXT NOT NULL DEFAULT '{}',
      added_at TEXT DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(request_id, role, provider_phone)
    );
    CREATE INDEX IF NOT EXISTS idx_economic_offers_request ON economic_offers(request_id);
    CREATE INDEX IF NOT EXISTS idx_economic_participants_request ON economic_participants(request_id);
    CREATE INDEX IF NOT EXISTS idx_economic_offers_seller_status ON economic_offers(seller_phone, status);
  `);

  // Rebuild older participant tables when their lifecycle constraint cannot
  // represent a provider completion report awaiting owner confirmation. Preserve
  // all rows and indexes; the migration never fabricates participant evidence.
  const participantSchema = database.exec("SELECT sql FROM sqlite_master WHERE type='table' AND name='economic_participants'")[0]?.values?.[0]?.[0];
  if (typeof participantSchema === 'string' && (!participantSchema.includes("'service_provider'") || !participantSchema.includes("'completion_reported'"))) {
    database.run(`
      BEGIN;
      CREATE TABLE economic_participants_migrated (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        request_id TEXT NOT NULL,
        role TEXT NOT NULL CHECK(role IN ('seller', 'delivery_provider', 'service_provider', 'external_platform', 'agent')),
        provider_phone TEXT NOT NULL,
        capability TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'invited' CHECK(status IN ('invited', 'offered', 'selected', 'confirmed', 'handover_pending', 'handed_over', 'collected', 'in_progress', 'completion_reported', 'delivered', 'declined', 'withdrawn')),
        evidence_json TEXT NOT NULL DEFAULT '{}',
        added_at TEXT DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(request_id, role, provider_phone)
      );
      INSERT INTO economic_participants_migrated (id, request_id, role, provider_phone, capability, status, evidence_json, added_at)
        SELECT id, request_id, role, provider_phone, capability, status, evidence_json, added_at FROM economic_participants;
      DROP TABLE economic_participants;
      ALTER TABLE economic_participants_migrated RENAME TO economic_participants;
      CREATE INDEX IF NOT EXISTS idx_economic_participants_request ON economic_participants(request_id);
      COMMIT;
    `);
  }
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
      role TEXT NOT NULL CHECK(role IN ('seller', 'delivery_provider', 'service_provider', 'external_platform', 'agent')),
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

export interface OperatorActorDefinition {
  id: string;
  role: 'customer' | 'provider' | 'seller' | 'contributor' | 'business' | 'agent_owner';
  phone: string;
  name: string;
  description: string;
}

export const CANONICAL_OPERATOR_PHONE = process.env.KURUKOO_OPERATOR_PHONE || '+2348000000001';

const OPERATOR_ACTORS: OperatorActorDefinition[] = [
  { id: 'customer', role: 'customer', phone: '+2348000000101', name: 'Kurukoo Customer Actor', description: 'Customer request, memory, reminders and Points state.' },
  { id: 'provider', role: 'provider', phone: '+2348000000102', name: 'Kurukoo Provider Actor', description: 'Provider skills, availability and presence state.' },
  { id: 'seller', role: 'seller', phone: '+2348000000103', name: 'Kurukoo Seller Actor', description: 'Seller/product sourcing and offer review state.' },
  { id: 'contributor', role: 'contributor', phone: '+2348000000104', name: 'Kurukoo Contributor Actor', description: 'Contributor evidence and community Topic state.' },
  { id: 'business', role: 'business', phone: '+2348000000105', name: 'Kurukoo Business Actor', description: 'Business advertising and subscription state.' },
  { id: 'agent_owner', role: 'agent_owner', phone: '+2348000000106', name: 'Kurukoo Agent Owner', description: 'Bounded agent ownership and lifecycle state.' },
];

export function getOperatorActorDefinitions(): OperatorActorDefinition[] {
  return OPERATOR_ACTORS.map(actor => ({ ...actor }));
}

export function getCanonicalOperatorIdentity(): OperatorActorDefinition {
  return { id: 'operator', role: 'customer', phone: CANONICAL_OPERATOR_PHONE, name: process.env.KURUKOO_OPERATOR_NAME || 'Kurukoo Super Admin Operator', description: 'User #1 operator with normal authenticated Chat and platform state.' };
}

function ensureSeedProfile(database: any, phone: string, name: string, role: string, extra: Record<string, unknown> = {}): void {
  const preferences = JSON.stringify({ seeded_operator_state: true, actor_role: role, onboarding_complete: true, ...extra });
  const existing = database.exec('SELECT phone FROM memory_profiles WHERE phone = ?', [phone]);
  if (existing[0]?.values?.length) {
    database.run('UPDATE memory_profiles SET name = ?, location = COALESCE(NULLIF(location, \'\'), \'Ikeja\'), country = COALESCE(NULLIF(country, \'\'), \'ng\'), preferences = COALESCE(preferences, ?) WHERE phone = ?', [name, preferences, phone]);
  } else {
    database.run(`INSERT INTO memory_profiles (phone, name, location, primary_lga, country, subscription_tier, points_balance, wallet_balance_minor, preferences, behavior_patterns, is_available, is_contributor, verified_provider, provider_type)
      VALUES (?, ?, 'Ikeja', 'Ikeja', 'ng', 'Base', 120, 120, ?, '{}', ?, ?, ?, ?)`, [phone, name, preferences, role === 'provider' ? 1 : 0, role === 'contributor' ? 1 : 0, role === 'provider' ? 1 : 0, role === 'business' || role === 'seller' ? 'business' : 'human']);
  }
}

export function seedCanonicalOperatorState(database: any): void {
  const operator = getCanonicalOperatorIdentity();
  ensureSeedProfile(database, operator.phone, operator.name, 'super_admin', { operator_user_number: 1 });
  for (const actor of OPERATOR_ACTORS) ensureSeedProfile(database, actor.phone, actor.name, actor.role, { test_actor: true, actor_context_id: actor.id });

  database.run(`CREATE TABLE IF NOT EXISTS reminders (id TEXT PRIMARY KEY, phone TEXT NOT NULL, title TEXT NOT NULL, note TEXT NOT NULL DEFAULT '', due_at TEXT NOT NULL, recurrence TEXT, status TEXT NOT NULL DEFAULT 'scheduled', created_at TEXT DEFAULT CURRENT_TIMESTAMP, sent_at TEXT)`);
  database.run(`CREATE TABLE IF NOT EXISTS internal_notifications (id INTEGER PRIMARY KEY AUTOINCREMENT, phone TEXT NOT NULL, title TEXT NOT NULL, body TEXT NOT NULL, link TEXT, status TEXT NOT NULL DEFAULT 'unread', delivery_state TEXT NOT NULL DEFAULT 'queued', provider_reference TEXT, failure_reason TEXT, created_at TEXT DEFAULT CURRENT_TIMESTAMP)`);
  database.run(`CREATE TABLE IF NOT EXISTS chat_conversations (id TEXT PRIMARY KEY, phone TEXT NOT NULL, title TEXT, channel TEXT DEFAULT 'unified', created_at TEXT DEFAULT CURRENT_TIMESTAMP, updated_at TEXT DEFAULT CURRENT_TIMESTAMP)`);
  database.run(`CREATE TABLE IF NOT EXISTS chat_message_meta (message_id INTEGER PRIMARY KEY, conversation_id TEXT NOT NULL, metadata TEXT, attachment_url TEXT, attachment_name TEXT, attachment_type TEXT, created_at TEXT DEFAULT CURRENT_TIMESTAMP)`);
  database.run(`CREATE TABLE IF NOT EXISTS agent_goals (id TEXT PRIMARY KEY, phone TEXT NOT NULL, conversation_id TEXT, economic_request_id TEXT, source TEXT NOT NULL, goal_type TEXT NOT NULL, objective TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'active', priority INTEGER NOT NULL DEFAULT 50, autonomy TEXT NOT NULL DEFAULT 'assist', next_action_at TEXT, completed_at TEXT, failure_reason TEXT, summary TEXT, plan_json TEXT, risk_level TEXT DEFAULT 'read_only', confirmation_required INTEGER DEFAULT 0, expires_at TEXT, created_at TEXT DEFAULT CURRENT_TIMESTAMP, updated_at TEXT DEFAULT CURRENT_TIMESTAMP)`);
  database.run(`CREATE TABLE IF NOT EXISTS agent_goal_events (id INTEGER PRIMARY KEY AUTOINCREMENT, goal_id TEXT NOT NULL, action TEXT NOT NULL, tool TEXT, result TEXT NOT NULL, evidence TEXT, detail TEXT, idempotency_key TEXT UNIQUE, created_at TEXT DEFAULT CURRENT_TIMESTAMP)`);
  database.run(`CREATE TABLE IF NOT EXISTS privacy_bridge (id INTEGER PRIMARY KEY AUTOINCREMENT, real_phone TEXT NOT NULL, proxy_phone TEXT NOT NULL UNIQUE, context TEXT NOT NULL DEFAULT 'booking', status TEXT NOT NULL DEFAULT 'active', created_at TEXT DEFAULT CURRENT_TIMESTAMP, expires_at TEXT, released_at TEXT)`);
  database.run(`CREATE INDEX IF NOT EXISTS idx_privacy_bridge_real_active ON privacy_bridge(real_phone, status)`);

  const conversationId = 'operator-seeded-conversation';
  const existingConversation = database.exec('SELECT id FROM chat_conversations WHERE id = ?', [conversationId]);
  if (!existingConversation[0]?.values?.length) {
    database.run('INSERT INTO chat_conversations (id, phone, title, channel) VALUES (?, ?, ?, ?)', [conversationId, operator.phone, 'Operator seeded Chat', 'web']);
    const first = database.exec('SELECT id FROM messages WHERE phone = ? AND content = ?', [operator.phone, 'Welcome to your canonical Kurukoo operator Chat.']);
    if (!first[0]?.values?.length) {
      database.run('INSERT INTO messages (phone, sender, content, channel, card_data) VALUES (?, ?, ?, ?, ?)', [operator.phone, 'assistant', 'Welcome to your canonical Kurukoo operator Chat.', 'web', JSON.stringify({ type: 'seeded_operator_state', clearlySeeded: true })]);
      database.run('INSERT INTO messages (phone, sender, content, channel, card_data) VALUES (?, ?, ?, ?, ?)', [operator.phone, 'user', 'Remember that I prefer short answers.', 'web', JSON.stringify({ type: 'seeded_operator_state', clearlySeeded: true })]);
    }
  }

  const reminder = database.exec('SELECT id FROM reminders WHERE phone = ? AND title = ?', [operator.phone, 'Review the operator acceptance queue']);
  if (!reminder[0]?.values?.length) database.run('INSERT INTO reminders (id, phone, title, note, due_at, status) VALUES (?, ?, ?, ?, datetime(\'now\', \'+1 day\'), \'scheduled\')', ['operator-seeded-reminder', operator.phone, 'Review the operator acceptance queue', 'Seeded controlled operator state; safe to delete.',]);
  if (process.env.NODE_ENV !== 'test') {
    const notification = database.exec('SELECT id FROM internal_notifications WHERE phone = ? AND title = ?', [operator.phone, 'Seeded operator state']);
    if (!notification[0]?.values?.length) database.run('INSERT INTO internal_notifications (phone, title, body, link) VALUES (?, ?, ?, ?)', [operator.phone, 'Seeded operator state', 'This notification is controlled demo data for User #1.', '/chat']);
  }
  if (!database.exec('SELECT id FROM credit_transactions WHERE phone = ? AND description = ?', [operator.phone, 'Seeded operator Points balance'])[0]?.values?.length) database.run('INSERT INTO credit_transactions (phone, amount, type, description) VALUES (?, ?, ?, ?)', [operator.phone, 120, 'seeded_operator', 'Seeded operator Points balance']);
}

export function resetOperatorActorState(database: any, phone: string): void {
  const actor = OPERATOR_ACTORS.find(item => item.phone === phone);
  if (!actor) throw new Error('Unknown controlled actor');
  for (const statement of [
    ['DELETE FROM messages WHERE phone = ?', [phone]],
    ['DELETE FROM chat_message_meta WHERE conversation_id IN (SELECT id FROM chat_conversations WHERE phone = ?)', [phone]],
    ['DELETE FROM chat_conversations WHERE phone = ?', [phone]],
    ['DELETE FROM reminders WHERE phone = ?', [phone]],
    ['DELETE FROM internal_notifications WHERE phone = ?', [phone]],
    ['DELETE FROM credit_transactions WHERE phone = ? AND type = \'seeded_operator\'', [phone]],
    ['DELETE FROM agent_goal_events WHERE goal_id IN (SELECT id FROM agent_goals WHERE phone = ?)', [phone]],
    ['DELETE FROM agent_goals WHERE phone = ?', [phone]],
    ['DELETE FROM economic_requests WHERE phone = ?', [phone]],
  ] as Array<[string, unknown[]]>) { try { database.run(statement[0], statement[1]); } catch {} }
  ensureSeedProfile(database, actor.phone, actor.name, actor.role, { test_actor: true, actor_context_id: actor.id, reset_at: new Date().toISOString() });
  saveDb(true);
}
