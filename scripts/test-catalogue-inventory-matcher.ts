import { strict as assert } from 'node:assert';
import { getDb, saveDb } from '../src/database.js';
import { matchCatalogueInventory } from '../src/services/catalogueInventoryMatcher.js';

const db = await getDb();
const phone = `ci_inventory_${Date.now()}`;
const skill = 'product_sourcing';
try {
  db.run(`INSERT INTO memory_profiles (phone,name,verified_provider,provider_type,country,currency,location) VALUES (?,?,?,?,?,?,?)`, [phone, 'CI Inventory Seller', 1, 'human', 'ng', 'NGN', 'Ikeja']);
  db.run(`INSERT INTO skills (phone,skill,is_available,products,rating) VALUES (?,?,?,?,?)`, [phone, skill, 1, JSON.stringify([{ name: 'iPhone 13 replacement screen', available: true, price_minor: 125000, currency: 'NGN' }]), 4.8]);
  saveDb(true);
  const matches = await matchCatalogueInventory({ query: 'iPhone 13 screen', skill, location: 'Ikeja', max: 5 });
  assert.equal(matches.length, 1);
  assert.equal(matches[0].providerPhone, phone);
  assert.equal(matches[0].verified, true);
  assert.equal(matches[0].available, true);
  assert.equal(matches[0].product, 'iPhone 13 replacement screen');
  assert.equal(matches[0].price, 125000);
  console.log(JSON.stringify({ passed: true, provider: matches[0].providerName, product: matches[0].product }, null, 2));
} finally {
  db.run('DELETE FROM skills WHERE phone=?', [phone]);
  db.run('DELETE FROM memory_profiles WHERE phone=?', [phone]);
  saveDb(true);
}
