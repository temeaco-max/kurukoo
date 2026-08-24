import postgres from 'postgres';

const sourceUrl = String(process.env.KURUKOO_TEST_POSTGRES_URL || '').trim();
if (!sourceUrl) throw new Error('KURUKOO_TEST_POSTGRES_URL is required.');

const targetDatabase = 'kurukoo_domain_ci';
const adminUrl = new URL(sourceUrl);
adminUrl.pathname = '/postgres';
const sql = postgres(adminUrl.toString(), { max: 1, ssl: String(process.env.KURUKOO_POSTGRES_SSL || 'false').toLowerCase() !== 'false' ? 'require' : false });

try {
  await sql.unsafe(`CREATE DATABASE "${targetDatabase}"`);
  console.log(`Created fresh PostgreSQL domain database: ${targetDatabase}`);
} catch (error: any) {
  if (error?.code === '42P04') {
    await sql.unsafe(`DROP DATABASE "${targetDatabase}"`);
    await sql.unsafe(`CREATE DATABASE "${targetDatabase}"`);
    console.log(`Recreated fresh PostgreSQL domain database: ${targetDatabase}`);
  } else {
    throw error;
  }
} finally {
  await sql.end({ timeout: 5 });
}
