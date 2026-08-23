import fs from 'node:fs';
import path from 'node:path';
import { createEconomicRequest, getEconomicRequest, listEconomicRequestsForPhone, updateEconomicRequestRequirements, transitionEconomicRequest, updateEconomicRequestStatus, getAllowedEconomicTransitions } from './economicRequestPersistence.js';
export { createEconomicRequest, getEconomicRequest, listEconomicRequestsForPhone, updateEconomicRequestRequirements, transitionEconomicRequest, updateEconomicRequestStatus, getAllowedEconomicTransitions };

export type EconomicCapability = 'discovery'|'availability'|'quote'|'verification'|'reservation'|'payment'|'escrow'|'contract'|'fulfillment'|'tracking'|'evidence'|'cancellation'|'dispute'|'completion';
export type EconomicRequestStatus = 'requested'|'awaiting_match'|'partially_matched'|'matched'|'quoting'|'quoted'|'awaiting_confirmation'|'reserved'|'payment_pending'|'paid'|'in_fulfillment'|'fulfilled'|'completed'|'cancelled'|'disputed'|'failed'|'abandoned';
export interface RequirementDefinition { key:string; label:string; required?:boolean; }
export interface SkillFlow { skill:string; question_set:string; post_match_action:string; payment_model:string; fulfillment_instructions:string; capabilities?:EconomicCapability[]; category?:string; mode?:'economic'|'information'|'safety'|'coordination'; requirements?:RequirementDefinition[]; }
export interface IntentSuggestion { label:string; prompt:string; }

const LEGACY_TAXONOMY_PATH=path.resolve(process.cwd(),'scripts','legacy','skillFlowsLegacy.ts');
let taxonomyCache: any|null=null;
function extractObject(source:string, pattern:RegExp): any {
  const match=source.match(pattern);
  if(!match) throw new Error(`Skill taxonomy source fragment not found: ${pattern}`);
  return Function(`"use strict"; return (${match[1]});`)();
}
function loadTaxonomy(){
  if(taxonomyCache)return taxonomyCache;
  const source=fs.readFileSync(LEGACY_TAXONOMY_PATH,'utf8');
  const categoryBySkill=extractObject(source,/const CATEGORY_BY_SKILL:Record<string,string>=(\{[\s\S]*?\});\nconst DEFAULT_CAPABILITIES/);
  const requirementsBySkill=extractObject(source,/const REQUIREMENTS_BY_SKILL:Record<string,RequirementDefinition\[]>=(\{[\s\S]*?\});\nconst CATEGORY_REQUIREMENTS/);
  const categoryRequirements=extractObject(source,/const CATEGORY_REQUIREMENTS:Record<string,RequirementDefinition\[]>=(\{[\s\S]*?\});\nfunction requirementsForSkill/);
  const suggestions=extractObject(source,/const CONTEXTUAL_SUGGESTIONS:Record<string,IntentSuggestion\[]>=(\{[\s\S]*?\});\nconst CATEGORY_SUGGESTION_KEY/);
  const suggestionKey=extractObject(source,/const CATEGORY_SUGGESTION_KEY:Record<string,string>=(\{[\s\S]*?\});\nexport function getContextualIntentSuggestions/);
  const definitions=extractObject(source,/const EXPLICIT_SKILL_FLOW_DEFINITIONS:Record<string,\{category:string;mode:string;requirements:Array<\{key:string;label:string;required\?:boolean\}>;questions:Array<\{q:string;options:string\[\]\}>;action:string;payment:string;fulfillment:string\}>=(\{[\s\S]*?\});\nfunction seedCanonicalSkillFlows/);
  taxonomyCache={categoryBySkill,requirementsBySkill,categoryRequirements,suggestions,suggestionKey,definitions};
  return taxonomyCache;
}

export const ECONOMIC_CATEGORIES=['transport-mobility','food-drink','repairs-maintenance','personal-care','emergency-dispatch','health-medical','education-learning','events-entertainment','accommodation-lodging','agriculture-produce','professional-services','spiritual-religious','freelance-services','gigs-microtasks','errands-delivery','communication-telecom','logistics-freight','tourism-travel','creative-arts','security-safety','fitness-coaching','nightlife-lounges','betting-gaming','money-circle','classifieds-marketplace','price-check','government-civic','community-neighbourhood','cravings-streetfood','reach-reference','language-services','automotive-mechanics','finance-tax','pet-animal-care','digital-services','property-real-estate','childcare-nanny','beauty-wellness','cleaning-sanitation','home-automation','legal-compliance','fashion-apparel','solar-energy','event-rentals','water-beverage','sports-recreation'] as const;
const DEFAULT_CAPABILITIES:EconomicCapability[]=['discovery','availability','quote','verification','reservation','payment','fulfillment','cancellation','dispute','completion'];
const AUXILIARY_SKILL_CATEGORIES:Record<string,string>={taxi_driver:'transport-mobility'};
const GENERIC_CAPABILITY_CATEGORIES=['events-entertainment','professional-services','property-real-estate','legal-compliance'];
const TRACKING_CATEGORIES=['transport-mobility','logistics-freight','errands-delivery'];
const EVIDENCE_CATEGORIES=['repairs-maintenance','health-medical','classifieds-marketplace'];

function requirementsForSkill(skill:string,category?:string):RequirementDefinition[]{const t=loadTaxonomy();const explicit=t.definitions[skill]?.requirements;if(Array.isArray(explicit)&&explicit.length)return explicit.map((r:any)=>({...r}));return(t.requirementsBySkill[skill]||t.categoryRequirements[category||'']||[{key:'service',label:'What do you need?',required:true},{key:'location',label:'Location'},{key:'time',label:'When'}]).map((r:any)=>({...r}));}
export function getEconomicCategory(skill:string):string|null{const normalized=skill.trim().toLowerCase();const t=loadTaxonomy();return t.categoryBySkill[normalized]||AUXILIARY_SKILL_CATEGORIES[normalized]||null;}
export function getKnownSkills():string[]{return Object.keys(loadTaxonomy().categoryBySkill);}
export function getKnownCapabilitySkills():string[]{return [...new Set([...getKnownSkills(),'taxi_driver','memory','reminder','notification','notifications','safety','safety_contact','provider_onboarding','provider_profile_setup','autonomous_agent','subscription','topic','event_coverage','support_triage','seller_offer_review','advertising','provider_request'])];}
export function getSkillRequirements(skill:string):RequirementDefinition[]{const normalized=skill.trim().toLowerCase();return requirementsForSkill(normalized,getEconomicCategory(normalized)||undefined);}
export function getDefaultCapabilities(category?:string):EconomicCapability[]{const c=[...DEFAULT_CAPABILITIES];if(GENERIC_CAPABILITY_CATEGORIES.includes(category||''))c.splice(5,0,'contract');if(TRACKING_CATEGORIES.includes(category||''))c.splice(7,0,'tracking');if(EVIDENCE_CATEGORIES.includes(category||''))c.splice(8,0,'evidence');return Array.from(new Set<EconomicCapability>(c));}
export function getSkillCapabilities(skill:string):EconomicCapability[]{const normalized=skill.trim().toLowerCase();const category=getEconomicCategory(normalized)||undefined;const capabilities=getDefaultCapabilities(category);if(normalized==='verified_artist')return Array.from(new Set<EconomicCapability>([...capabilities,'contract','escrow']));if(['buy_car','product_sourcing'].includes(normalized))return Array.from(new Set<EconomicCapability>([...capabilities,'evidence','escrow']));if(normalized==='buy_ticket')return Array.from(new Set<EconomicCapability>([...capabilities,'evidence']));return capabilities;}
export function getContextualIntentSuggestions(skill:string,max=3):IntentSuggestion[]{const normalized=skill.trim().toLowerCase();const t=loadTaxonomy();const category=getEconomicCategory(normalized)||'';const key=t.suggestions[normalized]?normalized:(t.suggestionKey[category]||'');return (t.suggestions[key]||[]).slice(0,Math.max(0,max)).map((item:any)=>({...item}));}
export function getSkillFlowSync(skill:string):SkillFlow|null{const name=skill.trim();if(!name)return null;const def=loadTaxonomy().definitions[name];if(!def)return null;const category=getEconomicCategory(name)||undefined;const mode=String(def.mode||'economic') as SkillFlow['mode'];return{skill:name,question_set:JSON.stringify(def.questions||[]),post_match_action:String(def.action||''),payment_model:String(def.payment||''),fulfillment_instructions:String(def.fulfillment||''),capabilities:getSkillCapabilities(name),category,mode:['economic','information','safety','coordination'].includes(mode||'')?mode:'economic',requirements:getSkillRequirements(name)};}
export async function getSkillFlow(skill:string):Promise<SkillFlow|null>{return getSkillFlowSync(skill);}
export async function auditSkillFlows(){const defs=loadTaxonomy().definitions;const invalid:string[]=[];let total=0,valid=0;for(const skill of Object.keys(defs)){total++;const flow=getSkillFlowSync(skill);if(!flow||!flow.question_set||!flow.post_match_action||!flow.payment_model||!flow.fulfillment_instructions||!flow.category)invalid.push(skill);else valid++;}return{total,valid,invalid};}
export function auditEconomicTaxonomy(){const t=loadTaxonomy();const categorySet=new Set<string>(ECONOMIC_CATEGORIES);return{categories:ECONOMIC_CATEGORIES.length,skills:Object.keys(t.categoryBySkill).length,unmapped:Object.keys(t.categoryBySkill).filter(s=>!categorySet.has(t.categoryBySkill[s]))};}
export const __skillFlowTaxonomyInternal={sourcePath:()=>LEGACY_TAXONOMY_PATH,resetCache:()=>{taxonomyCache=null;}};
