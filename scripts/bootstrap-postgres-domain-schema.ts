process.env.KURUKOO_DATABASE_MODE = 'postgres';
process.env.DATABASE_URL = String(process.env.KURUKOO_TEST_POSTGRES_URL || '').trim();

if (!process.env.DATABASE_URL) throw new Error('KURUKOO_TEST_POSTGRES_URL is required.');

const { ensureMemoryProfileSchema, ensureSkillsSchema, ensureProfileAccessLogSchema } = await import('../src/services/canonicalDomainSchemas.js');
const { closeCanonicalStore } = await import('../src/services/canonicalStore.js');

await ensureMemoryProfileSchema();
await ensureSkillsSchema();
await ensureProfileAccessLogSchema();
await closeCanonicalStore();

console.log('Fresh PostgreSQL domain schema bootstrapped: memory_profiles, skills, profile_access_log.');
