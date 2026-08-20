import fs from 'node:fs';
import path from 'node:path';

interface CorpusExample { label: string; text: string; provenance: 'curated_seed' | 'hard_negative'; locale: 'uk' | 'ng' | 'ng_pidgin' | 'ca' | 'global'; }

const examples: CorpusExample[] = [
  { label: 'ride_request', text: 'I need a cab from Yaba to Lekki around 7 tomorrow morning', provenance: 'curated_seed', locale: 'ng' },
  { label: 'ride_request', text: 'abeg find me keke to take me from here to the market', provenance: 'curated_seed', locale: 'ng_pidgin' },
  { label: 'ride_request', text: 'Can you get me a lift to the station after work?', provenance: 'curated_seed', locale: 'uk' },
  { label: 'ride_request', text: 'need a ride from Scarborough to downtown this evening', provenance: 'curated_seed', locale: 'ca' },
  { label: 'order_food', text: 'I want jollof and chicken delivered to Surulere', provenance: 'curated_seed', locale: 'ng' },
  { label: 'order_food', text: 'abeg where fit I buy hot suya near me', provenance: 'curated_seed', locale: 'ng_pidgin' },
  { label: 'order_food', text: 'Can I get dinner delivered near Brixton tonight?', provenance: 'curated_seed', locale: 'uk' },
  { label: 'order_food', text: 'need shawarma and a drink, delivery please', provenance: 'curated_seed', locale: 'global' },
  { label: 'find_worker', text: 'my tap is leaking, find a plumber near me please', provenance: 'curated_seed', locale: 'uk' },
  { label: 'find_worker', text: 'electrician wey fit check this light for my house', provenance: 'curated_seed', locale: 'ng_pidgin' },
  { label: 'find_worker', text: 'I need someone to repaint one room this weekend', provenance: 'curated_seed', locale: 'ca' },
  { label: 'find_worker', text: 'find a local person to fix the broken gate', provenance: 'curated_seed', locale: 'global' },
  { label: 'product_sourcing', text: 'where can I buy a fairly used iPhone 13 in Ikeja?', provenance: 'curated_seed', locale: 'ng' },
  { label: 'product_sourcing', text: 'help me find a seller for a replacement fridge shelf', provenance: 'curated_seed', locale: 'uk' },
  { label: 'product_sourcing', text: 'I need a shop that has this item, not someone to repair it', provenance: 'hard_negative', locale: 'global' },
  { label: 'support_triage', text: 'I am confused about my account and need general support', provenance: 'hard_negative', locale: 'global' },
  { label: 'support_triage', text: 'something is not working in the app, can someone explain?', provenance: 'curated_seed', locale: 'global' },
  { label: 'pay_bill', text: 'I want to pay my phone bill, not buy airtime', provenance: 'hard_negative', locale: 'global' },
  { label: 'pay_bill', text: 'help me settle my electricity bill before it is due', provenance: 'curated_seed', locale: 'uk' },
  { label: 'airtime_purchase', text: 'load two thousand naira airtime on this line', provenance: 'curated_seed', locale: 'ng' },
  { label: 'bin_day', text: 'what day do my bins go out in this postcode?', provenance: 'hard_negative', locale: 'uk' },
  { label: 'bin_day', text: 'when is rubbish collection for my street?', provenance: 'curated_seed', locale: 'uk' },
  { label: 'reminder', text: 'remind me this evening to put the bins out', provenance: 'hard_negative', locale: 'uk' },
  { label: 'reminder', text: 'set a reminder for my bin day next Tuesday', provenance: 'hard_negative', locale: 'uk' },
  { label: 'general_question', text: 'what does a cracked phone screen usually mean?', provenance: 'hard_negative', locale: 'global' },
  { label: 'general_question', text: 'is it safe to keep using a laptop that gets hot?', provenance: 'hard_negative', locale: 'global' },
  { label: 'laptop_repairer', text: 'my MacBook is not charging, find someone to repair it', provenance: 'hard_negative', locale: 'uk' },
  { label: 'phone_repairer', text: 'my iPhone screen don scatter, I need repair person', provenance: 'curated_seed', locale: 'ng_pidgin' },
  { label: 'phone_repairer', text: 'need somebody to change my broken phone screen today', provenance: 'curated_seed', locale: 'global' },
  { label: 'laptop_repairer', text: 'Dell laptop no dey come on, who fit repair am?', provenance: 'curated_seed', locale: 'ng_pidgin' },
  { label: 'bin_day', text: 'hello, quick one: what is bin day for me?', provenance: 'hard_negative', locale: 'uk' },
  { label: 'greeting', text: 'hello there', provenance: 'hard_negative', locale: 'global' },
  { label: 'greeting', text: 'good morning', provenance: 'hard_negative', locale: 'uk' },
  { label: 'greeting', text: 'hi, I need a plumber for a leak', provenance: 'hard_negative', locale: 'global' },
  { label: 'hotel_booking', text: 'find a hotel in Manchester for two adults next Friday', provenance: 'curated_seed', locale: 'uk' },
  { label: 'gp_appointment', text: 'I need to see a GP in my area this week', provenance: 'curated_seed', locale: 'uk' },
  { label: 'dentist_appointment', text: 'book a dentist because my tooth is aching', provenance: 'curated_seed', locale: 'uk' },
  { label: 'mot_booking', text: 'my MOT is due soon, find a test slot close by', provenance: 'curated_seed', locale: 'uk' },
  { label: 'driving_test_booking', text: 'looking for the earliest driving test slot at a nearby centre', provenance: 'curated_seed', locale: 'uk' },
  { label: 'snow_removal', text: 'need the driveway cleared before school run tomorrow', provenance: 'curated_seed', locale: 'ca' },
  { label: 'winter_tire_service', text: 'book somewhere to swap my winter tyres this weekend', provenance: 'curated_seed', locale: 'ca' },
  { label: 'hydro_outage', text: 'is there a hydro outage around my postal code?', provenance: 'curated_seed', locale: 'ca' },
  { label: 'pos_agent', text: 'where can I cash out nearby, POS network dey work?', provenance: 'curated_seed', locale: 'ng_pidgin' },
  { label: 'generator_fuel_delivery', text: 'I need diesel delivered for my generator before evening', provenance: 'curated_seed', locale: 'ng' },
  { label: 'gas_refill', text: 'who fit refill my cooking gas cylinder near here?', provenance: 'curated_seed', locale: 'ng_pidgin' },
  { label: 'parcel_pickup', text: 'can someone collect a parcel from the depot for me?', provenance: 'curated_seed', locale: 'uk' },
  { label: 'locksmith', text: 'I am locked out of my flat and need a locksmith now', provenance: 'curated_seed', locale: 'uk' },
  { label: 'boiler_repairer', text: 'the heating has stopped and the boiler is showing an error', provenance: 'curated_seed', locale: 'uk' },
  { label: 'rubbish_removal', text: 'I have old furniture and bags of rubbish to take away', provenance: 'curated_seed', locale: 'uk' },
  { label: 'market_shopper', text: 'abeg help me buy fresh tomatoes and pepper from market', provenance: 'curated_seed', locale: 'ng_pidgin' },
  { label: 'school_run_uk', text: 'I need an authorised school pickup for my child on Thursday', provenance: 'curated_seed', locale: 'uk' },
  { label: 'bicycle_repairer', text: 'my bike tyre keeps going flat and the brakes feel wrong', provenance: 'curated_seed', locale: 'ca' },
  { label: 'motorbike_repairer', text: 'my okada is making a bad noise, I need a bike mechanic', provenance: 'curated_seed', locale: 'ng' },
  { label: 'property_manager', text: 'I need help coordinating repairs for a tenant in my rental', provenance: 'curated_seed', locale: 'uk' },
  { label: 'check_balance', text: 'how many points or credit do I have left?', provenance: 'curated_seed', locale: 'global' },
  { label: 'top_up', text: 'I want to add money to my wallet', provenance: 'curated_seed', locale: 'global' },
  { label: 'emergency', text: 'there has been an accident and I need urgent help', provenance: 'curated_seed', locale: 'global' },
  { label: 'advertising', text: 'how do I promote my shop on Kurukoo?', provenance: 'curated_seed', locale: 'global' },
  { label: 'referral', text: 'where is my referral link?', provenance: 'curated_seed', locale: 'global' },
  { label: 'nearby_pulse_start', text: 'make me visible to people looking for my service nearby', provenance: 'curated_seed', locale: 'global' },
];

const output = path.join(process.cwd(), 'models', 'intent_training_curated.txt');
const manifestPath = path.join(process.cwd(), 'models', 'intent_training_curated.manifest.json');
const unique = new Map<string, CorpusExample>();
for (const example of examples) {
  const text = example.text.trim().replace(/\s+/g, ' ');
  unique.set(`${example.label}\u0000${text.toLowerCase()}`, { ...example, text });
}
const rows = [...unique.values()].sort((a, b) => `${a.label}:${a.text}`.localeCompare(`${b.label}:${b.text}`));
fs.mkdirSync(path.dirname(output), { recursive: true });
fs.writeFileSync(output, `${rows.map(row => `__label__${row.label} ${row.text}`).join('\n')}\n`);
const byProvenance = Object.fromEntries(['curated_seed', 'hard_negative'].map(kind => [kind, rows.filter(row => row.provenance === kind).length]));
const byLocale = Object.fromEntries(['uk', 'ng', 'ng_pidgin', 'ca', 'global'].map(locale => [locale, rows.filter(row => row.locale === locale).length]));
fs.writeFileSync(manifestPath, `${JSON.stringify({ schemaVersion: 1, generatedAt: new Date().toISOString(), exampleCount: rows.length, byProvenance, byLocale, synthetic: true, teacherGenerated: false, productionUserData: false, reviewRequiredForNewExamples: true }, null, 2)}\n`);
console.log(`[FastText] generated ${rows.length} curated examples (${byProvenance.hard_negative} hard negatives): ${output}`);
