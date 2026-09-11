/* Copyright (c) 2026 temeaco-max. All rights reserved. Proprietary and confidential. */
import { randomUUID } from 'crypto';
import { getDb, saveDb } from '../database.js';

export type CommunityCategory = {
  slug: string;
  name: string;
  description: string;
  public: boolean;
  adsEnabled: boolean;
  order: number;
  subcategories: Array<{ slug: string; name: string; description: string; adsEnabled: boolean; order: number }>;
};

const COMMUNITY_CATEGORIES: CommunityCategory[] = [
  {
    slug: 'general', name: 'General', description: 'Kurukoo, everyday conversation and useful community knowledge.', public: true, adsEnabled: true, order: 10,
    subcategories: [
      { slug: 'welcome-to-kurukoo', name: 'Welcome to Kurukoo', description: 'How Topics work, what belongs here and community rules.', adsEnabled: true, order: 10 },
      { slug: 'kurukoo-help', name: 'Kurukoo Help', description: 'Questions about using Kurukoo and getting the most from it.', adsEnabled: true, order: 20 },
      { slug: 'community-feedback', name: 'Community Feedback', description: 'Ideas, feedback and discussion about the Kurukoo community.', adsEnabled: true, order: 30 },
    ],
  },
  {
    slug: 'everyday-life', name: 'Everyday Life', description: 'Food, shopping, services, routines and everyday experiences.', public: true, adsEnabled: true, order: 20,
    subcategories: [
      { slug: 'food-drink', name: 'Food & Drink', description: 'Food, restaurants, cooking and local places to eat.', adsEnabled: true, order: 10 },
      { slug: 'shopping', name: 'Shopping', description: 'Products, shops, deals and buying experiences.', adsEnabled: true, order: 20 },
      { slug: 'local-services', name: 'Local Services', description: 'Useful services, recommendations and experiences.', adsEnabled: true, order: 30 },
      { slug: 'daily-life', name: 'Daily Life', description: 'Routines, errands and practical everyday questions.', adsEnabled: true, order: 40 },
    ],
  },
  {
    slug: 'money-work-business', name: 'Money, Work & Business', description: 'Work, earning, business, money and opportunities.', public: true, adsEnabled: true, order: 30,
    subcategories: [
      { slug: 'jobs-careers', name: 'Jobs & Careers', description: 'Employment, careers, skills and workplace experiences.', adsEnabled: true, order: 10 },
      { slug: 'gigs-freelancing', name: 'Gigs & Freelancing', description: 'Gigs, independent work and freelance opportunities.', adsEnabled: true, order: 20 },
      { slug: 'business', name: 'Business', description: 'Starting, running and growing a business.', adsEnabled: true, order: 30 },
      { slug: 'money', name: 'Money', description: 'Saving, spending, budgeting and financial experiences.', adsEnabled: true, order: 40 },
      { slug: 'opportunities', name: 'Opportunities', description: 'Useful opportunities, calls, partnerships and openings.', adsEnabled: true, order: 50 },
    ],
  },
  {
    slug: 'getting-around', name: 'Getting Around', description: 'Transport, travel and movement.', public: true, adsEnabled: true, order: 40,
    subcategories: [
      { slug: 'transport', name: 'Transport', description: 'Rides, public transport and local movement.', adsEnabled: true, order: 10 },
      { slug: 'travel', name: 'Travel', description: 'Trips, destinations, planning and experiences.', adsEnabled: true, order: 20 },
      { slug: 'roads-traffic', name: 'Roads & Traffic', description: 'Road conditions, traffic and useful local reports.', adsEnabled: true, order: 30 },
    ],
  },
  {
    slug: 'home-property', name: 'Home & Property', description: 'Homes, repairs, maintenance, utilities and property.', public: true, adsEnabled: true, order: 50,
    subcategories: [
      { slug: 'housing', name: 'Housing', description: 'Renting, buying, housing experiences and local areas.', adsEnabled: true, order: 10 },
      { slug: 'repairs-maintenance', name: 'Repairs & Maintenance', description: 'Repairs, trades, maintenance and practical fixes.', adsEnabled: true, order: 20 },
      { slug: 'utilities', name: 'Utilities', description: 'Power, water, internet and household utilities.', adsEnabled: true, order: 30 },
      { slug: 'home-life', name: 'Home Life', description: 'Cleaning, gardening and running a home.', adsEnabled: true, order: 40 },
    ],
  },
  {
    slug: 'health-wellbeing', name: 'Health & Wellbeing', description: 'Health, wellbeing, care and lived experiences.', public: true, adsEnabled: true, order: 60,
    subcategories: [
      { slug: 'health', name: 'Health', description: 'General health information and experiences.', adsEnabled: true, order: 10 },
      { slug: 'mental-wellbeing', name: 'Mental Wellbeing', description: 'Wellbeing, stress, resilience and support.', adsEnabled: true, order: 20 },
      { slug: 'fitness', name: 'Fitness', description: 'Movement, exercise and healthy routines.', adsEnabled: true, order: 30 },
      { slug: 'care', name: 'Care', description: 'Caregiving, accessibility and support experiences.', adsEnabled: true, order: 40 },
    ],
  },
  {
    slug: 'education-learning', name: 'Education & Learning', description: 'Learning, schools, study, skills and knowledge.', public: true, adsEnabled: true, order: 70,
    subcategories: [
      { slug: 'schools', name: 'Schools', description: 'Schools, education experiences and local questions.', adsEnabled: true, order: 10 },
      { slug: 'higher-education', name: 'Higher Education', description: 'Universities, colleges and further education.', adsEnabled: true, order: 20 },
      { slug: 'skills', name: 'Skills', description: 'Learning practical, professional and creative skills.', adsEnabled: true, order: 30 },
      { slug: 'learning-resources', name: 'Learning Resources', description: 'Useful guides, resources and recommendations.', adsEnabled: true, order: 40 },
    ],
  },
  {
    slug: 'community-culture', name: 'Community & Culture', description: 'People, culture, events, creativity and local community.', public: true, adsEnabled: true, order: 80,
    subcategories: [
      { slug: 'local-community', name: 'Local Community', description: 'Neighbourhoods, community life and local knowledge.', adsEnabled: true, order: 10 },
      { slug: 'events', name: 'Events', description: 'Events, activities and things happening.', adsEnabled: true, order: 20 },
      { slug: 'arts-creativity', name: 'Arts & Creativity', description: 'Art, music, writing, design and creative work.', adsEnabled: true, order: 30 },
      { slug: 'culture', name: 'Culture', description: 'Culture, traditions, language and shared experiences.', adsEnabled: true, order: 40 },
      { slug: 'sports', name: 'Sports', description: 'Sport, teams, games and activities.', adsEnabled: true, order: 50 },
    ],
  },
  {
    slug: 'technology-digital', name: 'Technology & Digital Life', description: 'Technology, apps, devices, internet and digital life.', public: true, adsEnabled: true, order: 90,
    subcategories: [
      { slug: 'devices', name: 'Devices', description: 'Phones, computers and consumer technology.', adsEnabled: true, order: 10 },
      { slug: 'apps-services', name: 'Apps & Services', description: 'Apps, online services and digital tools.', adsEnabled: true, order: 20 },
      { slug: 'ai', name: 'AI', description: 'Artificial intelligence, agents and practical AI use.', adsEnabled: true, order: 30 },
      { slug: 'internet', name: 'Internet', description: 'Connectivity, websites, online communities and digital life.', adsEnabled: true, order: 40 },
    ],
  },
  {
    slug: 'news-public-affairs', name: 'News & Public Affairs', description: 'Public issues, local reports, policy and civic life.', public: true, adsEnabled: true, order: 100,
    subcategories: [
      { slug: 'local-news', name: 'Local News', description: 'Local developments and community reports.', adsEnabled: true, order: 10 },
      { slug: 'public-services', name: 'Public Services', description: 'Public services, access and experiences.', adsEnabled: true, order: 20 },
      { slug: 'civic-life', name: 'Civic Life', description: 'Civic participation and public-interest discussion.', adsEnabled: true, order: 30 },
      { slug: 'public-policy', name: 'Public Policy', description: 'Policy discussion and public affairs.', adsEnabled: true, order: 40 },
    ],
  },
  {
    slug: 'marketplace', name: 'Marketplace & Recommendations', description: 'Things to buy, sell, compare and recommend.', public: true, adsEnabled: true, order: 110,
    subcategories: [
      { slug: 'buying', name: 'Buying', description: 'Buying decisions, products and services.', adsEnabled: true, order: 10 },
      { slug: 'selling', name: 'Selling', description: 'Selling items, services and opportunities.', adsEnabled: true, order: 20 },
      { slug: 'reviews', name: 'Reviews', description: 'Experiences and reviews of products and services.', adsEnabled: true, order: 30 },
      { slug: 'recommendations', name: 'Recommendations', description: 'Community recommendations and comparisons.', adsEnabled: true, order: 40 },
    ],
  },
  {
    slug: 'safety-emergencies', name: 'Safety & Emergencies', description: 'Safety information, alerts and urgent local context.', public: true, adsEnabled: false, order: 120,
    subcategories: [
      { slug: 'safety', name: 'Safety', description: 'Safety questions, prevention and practical information.', adsEnabled: false, order: 10 },
      { slug: 'alerts', name: 'Alerts', description: 'Local alerts and time-sensitive reports.', adsEnabled: false, order: 20 },
      { slug: 'emergencies', name: 'Emergencies', description: 'Emergency information and response context.', adsEnabled: false, order: 30 },
    ],
  },
  {
    slug: 'spirituality-faith', name: 'Spirituality & Faith', description: 'Faith, spirituality, beliefs and respectful discussion.', public: true, adsEnabled: true, order: 130,
    subcategories: [
      { slug: 'faith', name: 'Faith', description: 'Faith communities, beliefs and lived experience.', adsEnabled: true, order: 10 },
      { slug: 'spirituality', name: 'Spirituality', description: 'Spiritual practice, reflection and questions.', adsEnabled: true, order: 20 },
      { slug: 'religion-and-community', name: 'Religion & Community', description: 'Religious communities, events and local life.', adsEnabled: true, order: 30 },
    ],
  },
  {
    slug: 'kurukoo-contributors', name: 'Kurukoo Contributors', description: 'Private operational community for designated Kurukoo contributors, local agents and ambassadors.', public: false, adsEnabled: false, order: 900,
    subcategories: [
      { slug: 'tasks', name: 'Tasks', description: 'Contributor tasks, bids and work needing attention.', adsEnabled: false, order: 10 },
      { slug: 'local-issues', name: 'Local Issues', description: 'Issues and opportunities raised by contributors in the field.', adsEnabled: false, order: 20 },
      { slug: 'resources', name: 'Resources', description: 'Helpful contributor information, guides and resources.', adsEnabled: false, order: 30 },
      { slug: 'contributor-community', name: 'Contributor Community', description: 'Discussion between contributors, local agents and ambassadors.', adsEnabled: false, order: 40 },
    ],
  },
];

const DEFAULT_TOPIC_TEMPLATE = (category: CommunityCategory, subcategory: CommunityCategory['subcategories'][number]) => ({
  title: subcategory.slug === 'welcome-to-kurukoo' ? `Welcome to ${category.name}` : `What belongs in ${subcategory.name}?`,
  body: `Welcome to the ${subcategory.name} community on Kurukoo. This Topic explains what belongs here, what does not, how to participate respectfully, and how moderation and advertising work for this space. ${subcategory.adsEnabled ? 'Advertising may be enabled by Kurukoo for this category and follows the published Points rate card.' : 'Advertising is currently disabled for this space.'}`,
});

function ensureSchema(db: any) {
  db.run(`
    CREATE TABLE IF NOT EXISTS topic_community_categories (
      slug TEXT PRIMARY KEY, name TEXT NOT NULL, description TEXT NOT NULL, public INTEGER NOT NULL DEFAULT 1,
      ads_enabled INTEGER NOT NULL DEFAULT 1, display_order INTEGER NOT NULL DEFAULT 0, updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS topic_community_subcategories (
      slug TEXT PRIMARY KEY, category_slug TEXT NOT NULL, name TEXT NOT NULL, description TEXT NOT NULL,
      ads_enabled INTEGER NOT NULL DEFAULT 1, display_order INTEGER NOT NULL DEFAULT 0, updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS topic_community_ad_rates (
      id INTEGER PRIMARY KEY AUTOINCREMENT, category_slug TEXT NOT NULL, subcategory_slug TEXT, slot TEXT NOT NULL,
      points INTEGER NOT NULL DEFAULT 0, enabled INTEGER NOT NULL DEFAULT 1, width INTEGER, height INTEGER,
      UNIQUE(category_slug, subcategory_slug, slot)
    );
    CREATE TABLE IF NOT EXISTS topic_community_ad_campaigns (
      id TEXT PRIMARY KEY, advertiser_phone TEXT NOT NULL, category_slug TEXT NOT NULL, subcategory_slug TEXT,
      slot TEXT NOT NULL, title TEXT NOT NULL, body TEXT NOT NULL, destination TEXT NOT NULL, image_url TEXT,
      points_budget INTEGER NOT NULL, points_spent INTEGER NOT NULL DEFAULT 0, status TEXT NOT NULL DEFAULT 'pending',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP, updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS topic_community_presence (
      id TEXT PRIMARY KEY, phone TEXT, visitor_id TEXT, kind TEXT NOT NULL, last_seen_at TEXT DEFAULT CURRENT_TIMESTAMP,
      expires_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_topic_community_presence_expiry ON topic_community_presence(expires_at, kind);
  `);
}

function seedTaxonomy(db: any) {
  for (const category of COMMUNITY_CATEGORIES) {
    db.run(`INSERT INTO topic_community_categories(slug,name,description,public,ads_enabled,display_order) VALUES(?,?,?,?,?,?) ON CONFLICT(slug) DO UPDATE SET name=excluded.name, description=excluded.description, public=excluded.public, ads_enabled=excluded.ads_enabled, display_order=excluded.display_order, updated_at=CURRENT_TIMESTAMP`, [category.slug, category.name, category.description, category.public ? 1 : 0, category.adsEnabled ? 1 : 0, category.order]);
    for (const sub of category.subcategories) {
      db.run(`INSERT INTO topic_community_subcategories(slug,category_slug,name,description,ads_enabled,display_order) VALUES(?,?,?,?,?,?) ON CONFLICT(slug) DO UPDATE SET category_slug=excluded.category_slug,name=excluded.name,description=excluded.description,ads_enabled=excluded.ads_enabled,display_order=excluded.order`, [sub.slug, category.slug, sub.name, sub.description, sub.adsEnabled ? 1 : 0, sub.order]);
      for (const [slot, points, width, height] of [["top-1", 100, 320, 180], ["top-2", 100, 320, 180], ["top-3", 100, 320, 180], ["bottom-1", 100, 320, 180], ["bottom-2", 100, 320, 180], ["bottom-3", 100, 320, 180], ["bottom-large", 250, 970, 180]] as const) {
        db.run(`INSERT INTO topic_community_ad_rates(category_slug,subcategory_slug,slot,points,enabled,width,height) VALUES(?,?,?,?,?,?,?) ON CONFLICT(category_slug,subcategory_slug,slot) DO UPDATE SET points=excluded.points,width=excluded.width,height=excluded.height`, [category.slug, sub.slug, slot, points, sub.adsEnabled && category.adsEnabled ? 1 : 0, width, height]);
      }
    }
  }
  saveDb();
}

export async function ensureCommunityTopicSupport() {
  const db = await getDb();
  ensureSchema(db);
  seedTaxonomy(db);
  return db;
}

export async function getCommunityTaxonomy(includePrivate = false) {
  const db = await ensureCommunityTopicSupport();
  const categories = db.prepare(`SELECT slug,name,description,public,ads_enabled,display_order FROM topic_community_categories ${includePrivate ? '' : 'WHERE public=1'} ORDER BY display_order, name`);
  const result: CommunityCategory[] = [];
  while (categories.step()) {
    const row = categories.getAsObject();
    const subs = db.prepare(`SELECT slug,name,description,ads_enabled,display_order FROM topic_community_subcategories WHERE category_slug=? ORDER BY display_order,name`);
    subs.bind([row.slug]);
    const subcategories: CommunityCategory['subcategories'] = [];
    while (subs.step()) { const sub = subs.getAsObject(); subcategories.push({ slug: String(sub.slug), name: String(sub.name), description: String(sub.description), adsEnabled: Boolean(sub.ads_enabled), order: Number(sub.display_order) }); }
    subs.free();
    result.push({ slug: String(row.slug), name: String(row.name), description: String(row.description), public: Boolean(row.public), adsEnabled: Boolean(row.ads_enabled), order: Number(row.display_order), subcategories });
  }
  categories.free();
  return result;
}

export async function getCommunityStats() {
  const db = await ensureCommunityTopicSupport();
  const cutoff = new Date(Date.now() - 5 * 60 * 1000).toISOString().replace('T', ' ').replace('Z', '');
  const members = Number(db.exec(`SELECT COUNT(*) AS count FROM memory_profiles`)[0]?.values?.[0]?.[0] ?? 0);
  const aiAgents = Number(db.exec(`SELECT COUNT(*) AS count FROM ai_agents WHERE status='active'`)[0]?.values?.[0]?.[0] ?? 0);
  const onlineMembers = Number(db.exec(`SELECT COUNT(*) AS count FROM memory_profiles WHERE last_active_at IS NOT NULL AND last_active_at >= '${cutoff}'`)[0]?.values?.[0]?.[0] ?? 0);
  const onlineGuests = Number(db.exec(`SELECT COUNT(*) AS count FROM topic_community_presence WHERE kind='guest' AND expires_at > CURRENT_TIMESTAMP`)[0]?.values?.[0]?.[0] ?? 0);
  return { members: members + aiAgents, online: onlineMembers + aiAgents, guests: onlineGuests, aiAgents };
}

export async function touchCommunityPresence(input: { phone?: string | null; visitorId?: string | null }) {
  const db = await ensureCommunityTopicSupport();
  const kind = input.phone ? 'member' : 'guest';
  const id = input.phone ? `member:${input.phone}` : `guest:${input.visitorId || randomUUID()}`;
  const expires = new Date(Date.now() + 5 * 60 * 1000).toISOString().replace('T', ' ').replace('Z', '');
  db.run(`INSERT INTO topic_community_presence(id,phone,visitor_id,kind,last_seen_at,expires_at) VALUES(?,?,?,?,CURRENT_TIMESTAMP,?) ON CONFLICT(id) DO UPDATE SET last_seen_at=CURRENT_TIMESTAMP,expires_at=excluded.expires_at`, [id, input.phone || null, input.visitorId || null, kind, expires]);
  saveDb();
  return { id, expiresAt: expires };
}

export async function getCategoryAdRates(categorySlug: string, subcategorySlug?: string) {
  const db = await ensureCommunityTopicSupport();
  const statement = db.prepare(`SELECT slot,points,enabled,width,height FROM topic_community_ad_rates WHERE category_slug=? AND (subcategory_slug=? OR subcategory_slug IS NULL) ORDER BY CASE slot WHEN 'top-1' THEN 1 WHEN 'top-2' THEN 2 WHEN 'top-3' THEN 3 WHEN 'bottom-1' THEN 4 WHEN 'bottom-2' THEN 5 WHEN 'bottom-3' THEN 6 ELSE 7 END`);
  statement.bind([categorySlug, subcategorySlug || null]);
  const rates: Array<{ slot: string; points: number; enabled: boolean; width: number | null; height: number | null }> = [];
  while (statement.step()) { const row = statement.getAsObject(); rates.push({ slot: String(row.slot), points: Number(row.points), enabled: Boolean(row.enabled), width: row.width == null ? null : Number(row.width), height: row.height == null ? null : Number(row.height) }); }
  statement.free();
  return rates;
}

export async function getTopicAdInventory(categorySlug?: string, subcategorySlug?: string) {
  const db = await ensureCommunityTopicSupport();
  const category = categorySlug || 'general';
  const statement = db.prepare(`SELECT r.slot,r.points,r.width,r.height,r.enabled,c.title,c.body,c.destination,c.image_url,c.advertiser_phone FROM topic_community_ad_rates r LEFT JOIN topic_community_ad_campaigns c ON c.category_slug=r.category_slug AND (c.subcategory_slug=r.subcategory_slug OR c.subcategory_slug IS NULL) AND c.slot=r.slot AND c.status='active' AND c.points_spent < c.points_budget WHERE r.category_slug=? AND (r.subcategory_slug=? OR r.subcategory_slug IS NULL) AND r.enabled=1 ORDER BY CASE r.slot WHEN 'top-1' THEN 1 WHEN 'top-2' THEN 2 WHEN 'top-3' THEN 3 WHEN 'bottom-1' THEN 4 WHEN 'bottom-2' THEN 5 WHEN 'bottom-3' THEN 6 ELSE 7 END`);
  statement.bind([category, subcategorySlug || null]);
  const inventory: any[] = [];
  while (statement.step()) { const row = statement.getAsObject(); inventory.push({ slot: String(row.slot), points: Number(row.points), width: row.width == null ? null : Number(row.width), height: row.height == null ? null : Number(row.height), enabled: Boolean(row.enabled), campaign: row.title ? { title: String(row.title), body: String(row.body), destination: String(row.destination), imageUrl: row.image_url ? String(row.image_url) : null } : null }); }
  statement.free();
  return inventory;
}

export async function createTopicAdCampaign(advertiserPhone: string, input: { categorySlug: string; subcategorySlug?: string; slot: string; title: string; body: string; destination: string; imageUrl?: string; pointsBudget: number }) {
  const db = await ensureCommunityTopicSupport();
  const rates = await getCategoryAdRates(input.categorySlug, input.subcategorySlug);
  const rate = rates.find((item) => item.slot === input.slot && item.enabled);
  if (!rate) throw new Error('This advertising slot is not enabled for the selected Topic space');
  const budget = Math.max(rate.points, Math.floor(input.pointsBudget));
  const profile = db.prepare('SELECT points_balance FROM memory_profiles WHERE phone=? LIMIT 1'); profile.bind([advertiserPhone]); const row = profile.step() ? profile.getAsObject() : null; profile.free();
  if (!row) throw new Error('A Kurukoo account is required to place an advert');
  const balance = Number(row.points_balance || 0);
  if (balance < budget) throw new Error(`You need ${budget} Points to place this advert`);
  const id = randomUUID();
  db.run('UPDATE memory_profiles SET points_balance=points_balance-?, updated_at=CURRENT_TIMESTAMP WHERE phone=?', [budget, advertiserPhone]);
  db.run('INSERT INTO credit_transactions(phone,amount,type,description) VALUES(?,?,?,?)', [advertiserPhone, -budget, 'topic_ad_purchase', `Topic advert: ${input.categorySlug}/${input.slot}`]);
  db.run("INSERT INTO topic_community_ad_campaigns(id,advertiser_phone,category_slug,subcategory_slug,slot,title,body,destination,image_url,points_budget,status) VALUES(?,?,?,?,?,?,?,?,?,?,'active')", [id, advertiserPhone, input.categorySlug, input.subcategorySlug || null, input.slot, input.title.trim(), input.body.trim(), input.destination.trim(), input.imageUrl || null, budget]);
  saveDb();
  return { id, pointsCharged: budget, status: 'active' };
}

export async function seedCommunityWelcomeTopics() {
  const db = await ensureCommunityTopicSupport();
  const existing = db.prepare('SELECT COUNT(*) AS count FROM topics WHERE category=? AND status IN (\'submitted\',\'public\')');
  for (const category of COMMUNITY_CATEGORIES.filter((item) => item.public)) {
    for (const sub of category.subcategories) {
      const template = DEFAULT_TOPIC_TEMPLATE(category, sub);
      const check = db.prepare('SELECT id FROM topics WHERE category=? AND title=? LIMIT 1'); check.bind([category.slug, template.title]); const found = check.step(); check.free();
      if (!found) {
        const id = randomUUID(); const slug = `${category.slug}-${sub.slug}`;
        const collision = db.prepare('SELECT id FROM topics WHERE slug=? LIMIT 1'); collision.bind([slug]); const exists = collision.step(); collision.free();
        if (!exists) db.run(`INSERT INTO topics(id,slug,author_phone,title,body,type,category,skills_json,status,published_at) VALUES(?,?,?,?,?,?,?,?,?,CURRENT_TIMESTAMP)`, [id, slug, 'kurukoo-ai', template.title, template.body, 'guide', category.slug, '[]', 'public']);
      }
    }
  }
  existing.free();
  saveDb();
}
