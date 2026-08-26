import fs from 'fs';
import os from 'os';
import path from 'path';
import { execFileSync, spawnSync } from 'child_process';
import { getDb } from '../database.js';
import { getAllConvergedSkillNames } from './skillBehaviourConvergence.js';
import { getFastTextThresholdConfig } from './fastTextThresholds.js';
import { recordUnknownIntentCandidate } from './unknownIntentReviewService.js';

export interface FastTextResult {
  intent: string;
  confidence: number;
  source?: 'fasttext' | 'rules' | 'fallback';
  skill?: string;
  alternateIntents?: string[];
}
export type FastTextModelState = 'real' | 'missing' | 'invalid';
export interface FastTextRuntimeStatus { modelState: FastTextModelState; realModelPresent: boolean; executableAvailable: boolean; ready: boolean; modelPath: string; trainingExamples: number; }
let trainingSet: { label: string; tokens: Set<string>; normalized: string }[] = [];
let trainingExact = new Map<string, string>();
let fastTextReady = false;
const classificationCache = new Map<string, { result: FastTextResult | null; expiresAt: number }>();
const CACHE_TTL_MS = 5 * 60 * 1000;
const STOP_WORDS = new Set(['a','an','and','are','as','at','be','by','can','do','for','from','get','help','i','in','is','it','me','my','need','of','on','or','please','the','this','to','want','with','you']);
function modelPath(): string { return path.join(process.cwd(), 'models', 'kurukoo_intent.bin'); }
function trainingPaths(): string[] {
  const modelsDir = path.join(process.cwd(), 'models');
  return [
    path.join(modelsDir, 'intent_training_data.txt'),
    path.join(modelsDir, 'intent_training_behaviour_additions.txt'),
    path.join(modelsDir, 'intent_training_skill_hints.txt'),
  ];
}
function normalize(query: string): string { return query.toLowerCase().replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim(); }
function meaningfulTokens(query: string): string[] { return normalize(query).split(/\s+/).filter(token => token.length > 1 && !STOP_WORDS.has(token)); }
function isRealBinaryModel(binPath: string): boolean { try { if (!fs.existsSync(binPath)) return false; const stats=fs.statSync(binPath); if(stats.size<100)return false; return !fs.readFileSync(binPath).subarray(0,32).toString('utf8').includes('DUMMY_FASTTEXT'); } catch { return false; } }
function getModelState(binPath: string): FastTextModelState { if(!fs.existsSync(binPath))return'missing'; return isRealBinaryModel(binPath)?'real':'invalid'; }
// Capability probe: the real fasttext CLI prints its usage text and may exit non-zero
// when invoked without a valid command, so availability must not depend on exit code.
function isFastTextExecutableAvailable(): boolean {
  try {
    const probe = spawnSync('fasttext', [], { timeout: 3000, encoding: 'utf8' });
    if (probe.error) return false;
    const output = `${probe.stdout || ''}${probe.stderr || ''}`.toLowerCase();
    return output.includes('fasttext') && output.includes('command');
  } catch { return false; }
}
export function getFastTextRuntimeStatus(rootDir=process.cwd()): FastTextRuntimeStatus { const binPath=path.join(rootDir,'models','kurukoo_intent.bin'); const modelState=getModelState(binPath); const realModelPresent=modelState==='real'; const executableAvailable=realModelPresent&&isFastTextExecutableAvailable(); return {modelState,realModelPresent,executableAvailable,ready:realModelPresent&&executableAvailable,modelPath:binPath,trainingExamples:trainingSet.length}; }
function loadTrainingData(): void { try { trainingSet=[]; trainingExact.clear(); const seen = new Set<string>(); for(const filePath of trainingPaths()){ if(!fs.existsSync(filePath))continue; for(const line of fs.readFileSync(filePath,'utf8').split(/\r?\n/)){ if(!line.startsWith('__label__'))continue; const spaceIdx=line.indexOf(' '); if(spaceIdx===-1)continue; const label=line.slice(9,spaceIdx).trim(); const normalized=normalize(line.slice(spaceIdx+1)); if(!normalized)continue; const key=`${label}\u0000${normalized}`; if(seen.has(key))continue; seen.add(key); const tokens=new Set(meaningfulTokens(normalized)); const entry={label,tokens,normalized}; trainingSet.push(entry); if(normalized.length>=3 && !trainingExact.has(normalized)) trainingExact.set(normalized,label); } } console.log(`[FastText] loaded ${trainingSet.length} merged training examples from ${trainingPaths().filter(fs.existsSync).length} corpus files`); } catch(err){console.error('[FastText] training-data load failed:',err);} }
export function initializeFastText(): void { classificationCache.clear(); const binaryModelPath=modelPath(); fastTextReady=isRealBinaryModel(binaryModelPath)&&isFastTextExecutableAvailable(); loadTrainingData(); const status=getFastTextRuntimeStatus(); console.log(`[FastText] modelState=${status.modelState}, ready=${fastTextReady}, trainingExamples=${trainingSet.length}`); }
initializeFastText();

// FastText is a cheap signal, never the conversational authority. Common
// conversation acts are deterministic so a weak/stale model cannot turn
// ordinary chat into an unknown-intent failure.
const conversationActRules: Array<[RegExp,string]> = [
  [/^(hi|hello|hey|hiya|howdy|greetings|good morning|good afternoon|good evening|hello there)[!,. ]*$/i,'greeting'],
  [/\b(how far|how body|wetin dey happen)\b/i,'greeting'],
  [/^(thanks|thank you|thx|cheers|much appreciated)[!,. ]*$/i,'thanks'],
  [/^(bye|goodbye|see you|see ya|talk later)[!,. ]*$/i,'farewell'],
  [/^(yes|yeah|yep|yup|okay|ok|sure|alright|go ahead)[!,. ]*$/i,'confirmation'],
  [/^(no|nope|nah|not really|do not)[!,. ]*$/i,'rejection'],
  [/\b(i meant|i mean|actually i meant|my mistake|correction)\b/i,'correction'],
  [/\b(can you explain|what do you mean|what does that mean|i don't understand|explain that)\b/i,'clarification'],
  [/\b(how do i|how to|show me how|teach me how|walk me through|tutorial|guide me)\b/i,'how_to'],
  [/\b(status|where is my|what happened to|is it booked|is it ready|any update)\b/i,'status'],
  [/\b(cancel|stop|never mind|forget that)\b/i,'cancel'],
];
const blueprintRules: Array<[RegExp,string]> = [
  [/\b(help me stay safe|keep me safe|i(?:'|’)m not safe|i am not safe|i feel unsafe|i feel in danger|protect me|safety help|need help staying safe)\b/i,'emergency'],
  [/\b(emergency|sos|police|accident|hospital|immediate danger|life[- ]threatening|unsafe|danger)\b/i,'emergency'],
  [/\b(bin day|rubbish collection|bins? go out|waste collection)\b/i,'bin_day'],
  [/\b(hotel|booking accommodation|hotel deal|stay overnight)\b/i,'hotel_deals'],
  [/\b(kurukoo)\b.*\b(make money|pricing|price|fee|payment method|what can i use|what does it do)\b|\b(make money|pricing|price|fee|payment method)\b.*\b(kurukoo)\b|\b(tell me about|explain)\b.{0,30}\b(payment methods?|kurukoo)\b/i,'general_question'],
  [/\b(promoted post|sponsored promotion|advert campaign|campaign).{0,40}\b(not showing|disappeared|cannot see|can.t see|missing|problem)\b/i,'advertising'],
  [/\b(okada|motorbike|motorcycle)\b/i,'okada_rider'],
  [/\b(keke|tricycle)\b/i,'keke_driver'],
  [/\b(ride|okada|keke|taxi|cab|transport|driver)\b/i,'ride_request'],
  [/\b(food|suya|rice|bread|grocery|groceries|meal|restaurant|caterer|moi moi|amala|ewedu)\b/i,'order_food'],
  [/\b(tv|television|smart tv).{0,40}\b(repair|broken|no picture|no sound|fix|screen.{0,10}lines)\b/i,'tv_repairer'],
  [/\b(iphone|phone|smartphone|android|samsung(?: galaxy)?|pixel|mobile).{0,40}\b(screen|repair(?:ed|ing)?|broken|damaged|smashed|fix|not working|cracked|won't turn on|not charging)\b/i,'phone_repairer'],
  [/\b(laptop|macbook|dell laptop|lenovo laptop|hp laptop).{0,40}\b(repair(?:ed|ing)?|broken|damaged|fix|screen|won't turn on|not charging|won't boot|will not boot)\b/i,'laptop_repairer'],
  [/\b(tablet|ipad|galaxy tab|surface).{0,40}\b(repair|broken|damaged|fix|not working|won't turn on)\b/i,'tablet_repairer'],
  [/\b(ps5|ps4|xbox|nintendo switch|playstation).{0,40}\b(repair|broken|fix|not working|won't turn on)\b/i,'console_repairer'],
  [/\b(apple watch|galaxy watch|garmin|fitbit).{0,40}\b(repair|broken|fix|not working|won't turn on)\b/i,'smartwatch_repairer'],
  [/\b(airpods|airpod|galaxy buds|wireless earbuds).{0,40}\b(repair|broken|not working|fix|one side works|one side not working)\b|\b(repair|broken|not working|fix)\b.{0,40}\b(airpods|airpod|galaxy buds|wireless earbuds)\b/i,'earbuds_repairer'],
  [/\b(bluetooth speaker|bose speaker|jbl speaker|wireless speaker).{0,40}\b(repair|broken|no sound|fix)\b/i,'speaker_repairer'],
  [/\b(washing machine|fridge|refrigerator|oven|dishwasher|generator).{0,40}\b(repair|broken|leak|fix|not working|not cooling|won't start|will not start)\b/i,'appliance_repairer'],
  [/\b(bicycle|bike).{0,40}\b(repair|broken|fix|damaged|punctur(?:e|ed))\b/i,'bicycle_repairer'],
  [/\b(motorbike|motorcycle).{0,40}\b(repair|broken|fault|fix)\b/i,'motorbike_repairer'],
  [/\b(my car|my vehicle).{0,40}\b(broken down|won't start|tow|recovery)\b/i,'vehicle_recovery'],
  [/\b(plumber|electrician|mechanic|repair|fix|artisan|worker|painter|carpenter|tailor|cobbler|shoe maker)\b/i,'find_worker'],
  [/\b(pepper seller|pepper vendor|fruit seller|fruit vendor|vegetable seller|fish seller)\b/i,'find_worker'],
  [/\b(balance|points|wallet|credit)\b/i,'check_balance'],
  [/\b(football|basketball|tennis|league|team|club|tournament|watch party)\b/i,'sports_matchmaking'],
  [/\b(event coverage|cover this event|photograph.*event|film.*event)\b/i,'event_coverage'],
  [/\b(how to|tutorial|teach me|guide me)\b/i,'how_to_video'],
  [/\b(security|guard|close protection)\b/i,'security_booking'],
  [/\b(top up|top-up|recharge|add money|fund my wallet)\b/i,'top_up'],
  [/\b(unlink|unpair|disconnect).{0,40}\b(device|phone|laptop|tablet)\b/i,'unlink_device'],
  [/\b(gp appointment|book.*gp|see my doctor)\b/i,'gp_appointment'],
  [/\b(dentist|dental appointment)\b/i,'dentist_appointment'],
  [/\b(mot test|book my mot|mot booking|mot).{0,40}\b(book|next week|due|appointment|test)\b/i,'mot_booking'],
  [/\b(driving test|test centre|test center).{0,20}\b(book|slot|test)\b/i,'driving_test_booking'],
  [/\b(snow removal|snow plowing|clear my driveway)\b/i,'snow_removal'],
  [/\b(winter tyre|winter tire).{0,20}\b(change|service|booking)\b/i,'winter_tire_service'],
  [/\b(power outage|hydro outage|electricity outage)\b/i,'hydro_outage'],
  [/\b(pos agent|cash out|withdraw cash)\b/i,'pos_agent'],
  [/\b(pray|prayer|prayer time)\b/i,'prayer'],
  [/\b(generator fuel|diesel delivery|fuel delivery)\b/i,'generator_fuel_delivery'],
  [/\b(water tanker|water delivery|borehole water)\b/i,'borehole_water'],
  [/\b(cooking gas|gas refill|lpg refill)\b/i,'gas_refill'],
  [/\b(parcel pickup|pick up my parcel|drop off this parcel)\b/i,'parcel_pickup'],
  [/\b(locksmith|locked out|door lock repair)\b/i,'locksmith'],
  [/\b(boiler repair|heating engineer|boiler broken|boiler.{0,20}making noise)\b/i,'boiler_repairer'],
  [/\b(rubbish removal|junk removal|waste removal)\b/i,'rubbish_removal'],
  [/\b(window cleaner|window cleaning)\b/i,'window_cleaner'],
  [/\b(key cutting|cut me a key|spare key)\b/i,'key_cutter'],
  [/\b(laundry pickup|wash and fold|laundry service)\b/i,'laundry_pickup'],
  [/\b(market shopper|market run|shop.*market)\b/i,'market_shopper'],
  [/\b(school run|school pickup|school drop off)\b/i,'school_run_uk'],
  [/\b(same day courier|local courier|courier pickup)\b/i,'local_courier'],
  [/\b(handyman|neighbourhood handyman)\b/i,'neighbourhood_handyman'],
];
function skillFromLabel(label:string): string | undefined { const prefix='skill_route_'; if (!label.startsWith(prefix)) return undefined; const candidate=label.slice(prefix.length); return getAllConvergedSkillNames().includes(candidate) ? candidate : undefined; }
function ruleClassify(q:string):FastTextResult|null { for(const [rule,intent] of conversationActRules) if(rule.test(q)) return {intent,confidence:.999,source:'rules'}; for(const [rule,intent] of blueprintRules) if(rule.test(q)) return {intent,confidence:.995,source:'rules', skill:getAllConvergedSkillNames().includes(intent) ? intent : undefined}; return null; }
function classifyWithBinaryModel(query:string):FastTextResult|null { const thresholds=getFastTextThresholdConfig(); if(!fastTextReady)return null; const clean=normalize(query); if(!clean)return null; const inputPath=path.join(os.tmpdir(),`kurukoo-fasttext-${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2)}.txt`); try { fs.writeFileSync(inputPath,`${clean}\n`,{mode:0o600}); const stdout=execFileSync('fasttext',['predict-prob',modelPath(),inputPath,'3'],{encoding:'utf8',timeout:2500}).trim(); const candidates=stdout.split(/\r?\n/).map(line=>{const match=line.match(/__label__([^\s]+)\s+([0-9.]+)/); return match?{label:match[1],confidence:Number(match[2])}:null;}).filter(Boolean) as Array<{label:string;confidence:number}>; if(!candidates.length)return null; const best=candidates[0]; if(!Number.isFinite(best.confidence)||best.confidence<thresholds.modelMinConfidence)return null; const second=candidates[1]; if(second && best.confidence-second.confidence<thresholds.modelMarginConfidence && best.confidence<0.78)return null; const skill=skillFromLabel(best.label); return {intent:skill?skill:best.label,confidence:best.confidence,source:'fasttext',skill,alternateIntents:candidates.slice(1).map(candidate=>skillFromLabel(candidate.label)||candidate.label)}; } catch(err:any){console.warn('[FastText] prediction failed:',err?.message||err);return null;} finally{try{fs.unlinkSync(inputPath);}catch{}} }
function classifyWithMemory(query:string):FastTextResult|null { const thresholds=getFastTextThresholdConfig(); if(!trainingSet.length)return null; const normalized=normalize(query); const exact=trainingExact.get(normalized); if(exact){const skill=skillFromLabel(exact); return {intent:skill||exact.replace(/^__label__/,''),confidence:.97,source:'fallback',skill};} const tokens=meaningfulTokens(normalized); if(!tokens.length)return null; const scored=new Map<string,number>(); for(const item of trainingSet){ let hits=0; for(const token of tokens){ if(item.tokens.has(token)) hits+=1; else if([...item.tokens].some(t=>t.length>=4&&token.length>=4&&(t.includes(token)||token.includes(t)))) hits+=.35; } const phraseBoost=normalized.includes(item.normalized)?0.75:(item.normalized.includes(normalized)&&normalized.length>3?0.25:0); const candidate=(hits/Math.max(tokens.length,item.tokens.size*0.55))+phraseBoost; scored.set(item.label,Math.max(scored.get(item.label)||0,candidate)); } const ranked=[...scored.entries()].sort((a,b)=>b[1]-a[1]); if(!ranked.length||ranked[0][1]<thresholds.fallbackMinScore)return null; const best=ranked[0]; const second=ranked[1]; if(second && best[1]-second[1]<thresholds.fallbackMargin && best[1]<0.8)return null; const skill=skillFromLabel(best[0]); return{intent:skill||best[0],confidence:Math.min(.95,Math.max(.67,best[1])),source:'fallback',skill,alternateIntents:ranked.slice(1,3).map(([label])=>skillFromLabel(label)||label)}; }
function correctKnownDomainCollision(query:string,result:FastTextResult|null):FastTextResult|null { if(/\b(help me stay safe|keep me safe|i(?:'|’)m not safe|i feel unsafe|i feel in danger|protect me|safety help|need help staying safe|immediate danger|life[- ]threatening)\b/i.test(query))return{intent:'emergency',confidence:.999,source:'rules'}; if(/\b(advertis(?:e|ing)?|advert|campaign|sponsored|promotion|promote)\b/i.test(query)&&result?.intent!=='advertising')return{intent:'advertising',confidence:.99,source:'rules'}; if(/\b(bin day|rubbish collection|bins? go out|waste collection)\b/i.test(query))return{intent:'bin_day',confidence:.995,source:'rules',skill:'bin_day'}; return result; }
export function classifyWithFastText(query:string):FastTextResult|null { const q=query.trim();if(!q)return null;const key=normalize(q);const cached=classificationCache.get(key);if(cached&&cached.expiresAt>Date.now())return cached.result; const result=correctKnownDomainCollision(q,ruleClassify(q)||classifyWithBinaryModel(q)||classifyWithMemory(q)); if(classificationCache.size>2000)classificationCache.delete(classificationCache.keys().next().value as string);classificationCache.set(key,{result,expiresAt:Date.now()+CACHE_TTL_MS}); if(result)console.info(`[FastText] query="${q}" intent=${result.intent} confidence=${result.confidence.toFixed(3)} source=${result.source}${result.skill ? ` skill=${result.skill}` : ''}`); else { getDb().then(db=>db.run(`INSERT INTO unknown_intents (query) VALUES (?)`,[q])).catch(()=>{}); recordUnknownIntentCandidate(q).catch(()=>{}); } return result; }
export function classifyIntentFastText(query:string):string{return classifyWithFastText(query)?.intent||'unknown';}
