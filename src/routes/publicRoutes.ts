import express, { Router } from 'express';
import fs from 'fs';
import path from 'path';
import { getSeoPage, getSchemaForPage, getFaqForPage } from '../services/seoService.js';
import { getDb } from '../database.js';
import { getAdCampaigns } from '../services/adManager.js';

function getLocale(lang = 'en') { const localePath=path.join(process.cwd(),'locales',`${lang}.json`); const fallbackPath=path.join(process.cwd(),'locales','en.json'); try { const filePath=fs.existsSync(localePath)?localePath:fallbackPath; if(fs.existsSync(filePath)) return JSON.parse(fs.readFileSync(filePath,'utf-8')); } catch {} return {tagline:'Your everyday, sorted.'}; }
async function fetchSeoData(urlPath:string,pageTitle?:string){const seo=await getSeoPage(urlPath);const schemas=await getSchemaForPage(urlPath,pageTitle||seo.title);const faqs=await getFaqForPage(urlPath);return{seo,schemas,faqs};}

type ExploreCategory={name:string;slug:string;icon:string;description:string;relatedSlugs?:string[];};
const EXPLORE_ALIASES:Record<string,string>={
  groceries:'food',errands:'errands-delivery','repairs-maintenance':'repairs','solar-energy':'professional-services',
  'automotive-mechanics':'automotive-care','health-medical':'health','emergency-dispatch':'emergency',
  'reach-reference':'professional-services','sports-recreation':'fitness','events-entertainment':'events',
  'price-check':'price-checker',cravings:'food',sports:'fitness',travel:'tourism',
};
const EARN_CATEGORY:Record<string,string>={
  refer:'money-circle',agents:'professional-services',rides:'transport',delivery:'logistics',repairs:'repairs',
  errands:'errands-delivery',support:'professional-services',build:'workers',work:'gigs',help:'professional-services',
  sell:'classifieds',promote:'professional-services',contributor:'gigs',tasks:'gigs',
};
function loadExploreCategories():ExploreCategory[]{
  try{const categoriesPath=path.join(process.cwd(),'content','explore','categories.json');return fs.existsSync(categoriesPath)?JSON.parse(fs.readFileSync(categoriesPath,'utf-8')):[];}catch{return [];}
}
function resolveExploreCategory(slug:string,categories:ExploreCategory[]):ExploreCategory|undefined{
  const canonical=EXPLORE_ALIASES[slug]||slug;
  return categories.find(category=>category.slug===canonical);
}
function withRelatedCategories(category:ExploreCategory,categories:ExploreCategory[]){
  return {...category,subCategories:(category.relatedSlugs||[]).map(slug=>categories.find(candidate=>candidate.slug===slug)).filter((value):value is ExploreCategory=>Boolean(value))};
}
export function createPublicRouter():Router{const router=express.Router();
 const renderPage=async(req:express.Request,res:express.Response,view:string,reqPath=req.path,extra:Record<string,unknown>={})=>{const country=typeof extra.country==='string'?extra.country:'ng';const t=getLocale('en');const{seo,schemas,faqs}=await fetchSeoData(reqPath);res.render(view,{country,t,shortcode:'*7000#',seo,schemas,faqs,reqPath,...extra});};
 router.get('/',async(req,res,next)=>{try{await renderPage(req,res,'index','/',{pageStyles:['/css/kurukoo-home.css?v=1.0.0']});}catch(error){next(error);}});
 router.get('/explore',async(req,res,next)=>{try{const categories=loadExploreCategories();const ads=await getAdCampaigns();await renderPage(req,res,'explore/index','/explore',{categories,ads});}catch(error){next(error);}});
 router.get('/explore/:slug',async(req,res,next)=>{try{const categories=loadExploreCategories();const category=resolveExploreCategory(req.params.slug,categories);if(!category)return next();const ads=await getAdCampaigns();await renderPage(req,res,'explore/category',`/explore/${req.params.slug}`,{category:withRelatedCategories(category,categories),ads});}catch(error){next(error);}});
 router.get('/p/:providerSlug',async(req,res,next)=>{try{const db=await getDb();const stmt=db.prepare(`SELECT * FROM memory_profiles WHERE profile_slug = ?`);stmt.bind([req.params.providerSlug]);let profile:any=null;if(stmt.step())profile=stmt.getAsObject();stmt.free();if(!profile)return next();const sStmt=db.prepare(`SELECT * FROM skills WHERE phone = ?`);sStmt.bind([profile.phone]);const skills:any[]=[];while(sStmt.step())skills.push(sStmt.getAsObject());sStmt.free();if(!skills.length)return next();const providerName=String(profile.display_name||profile.name||'Provider');const provider={name:providerName,initials:providerName.charAt(0).toUpperCase(),location:String(profile.location||profile.primary_lga||'Nigeria'),verified:profile.verified_provider===1,trustScore:Number(profile.trust_score)||5,skills:skills.map((s:any)=>({skill:String(s.skill||''),rating:Number(s.rating)||5,jobsCompleted:Number(s.jobs_completed)||0,hourlyRate:Number(s.hourly_rate)||0}))};const reqPath=`/p/${req.params.providerSlug}`;let{seo,schemas,faqs}=await fetchSeoData(reqPath,providerName);if(!seo.title||seo.title==='Kurukoo — Wake up. Get going.')seo={...seo,title:`${providerName} — ${String(skills[0].skill)} in ${provider.location}`,meta_description:`${providerName} offers ${skills.map((s:any)=>s.skill).join(', ')} on Kurukoo.`};schemas=[...schemas,{'@context':'https://schema.org','@type':'LocalBusiness',name:providerName,description:seo.meta_description,url:`https://kurukoo.com${reqPath}`,address:{'@type':'PostalAddress',addressLocality:provider.location},aggregateRating:{'@type':'AggregateRating',ratingValue:provider.trustScore.toFixed(1),reviewCount:skills.reduce((sum:number,s:any)=>sum+(Number(s.jobs_completed)||0),0)}}];res.render('provider-profile',{country:'ng',t:getLocale('en'),shortcode:'*7000#',provider,seo,schemas,faqs,reqPath});}catch(error){console.error('Provider profile error:',error);next(error);}});
 router.get('/web',async(_req,res)=>res.sendFile(path.join(process.cwd(),'public','dashboard.html')));
 router.get('/download',async(req,res,next)=>{try{await renderPage(req,res,'download','/download');}catch(error){next(error);}});
 router.get('/how-it-works',(_req,res)=>res.redirect(302,'/#how'));
 router.get('/pricing',async(req,res,next)=>{try{await renderPage(req,res,'pricing','/pricing');}catch(error){next(error);}});
 router.get('/events',(_req,res)=>res.redirect(302,'/explore/events'));
 router.get('/earn/:topic',(req,res,next)=>{const category=EARN_CATEGORY[req.params.topic];if(!category)return next();res.redirect(302,`/explore/${category}`);});
 router.get('/about',async(req,res,next)=>{try{await renderPage(req,res,'about');}catch(error){next(error);}});
 router.get('/contact',async(req,res,next)=>{try{await renderPage(req,res,'contact');}catch(error){next(error);}});
 router.get('/help',async(req,res,next)=>{try{await renderPage(req,res,'help','/help',{articles:[{title:'Getting Started',body:'Sign up with your phone number and start chatting.'},{title:'For Providers',body:'Add your skills to start accepting gigs.'},{title:'Payments',body:'Manage your credits and withdraw earnings.'}]});}catch(error){next(error);}});
 router.get('/api-docs',async(req,res,next)=>{try{await renderPage(req,res,'api_docs');}catch(error){next(error);}});
 router.get('/legal/:section?',async(req,res,next)=>{try{await renderPage(req,res,'legal','/legal',{section:(req.params as any).section||'privacy'});}catch(error){next(error);}});
 router.get('/blog',async(req,res,next)=>{try{await renderPage(req,res,'blog');}catch(error){next(error);}});
 router.get('/careers',async(req,res,next)=>{try{await renderPage(req,res,'careers');}catch(error){next(error);}});
 router.get('/discover',async(req,res,next)=>{try{await renderPage(req,res,'discover');}catch(error){next(error);}});
 router.get('/login',async(req,res,next)=>{try{await renderPage(req,res,'login');}catch(error){next(error);}});
 router.get('/for-you',async(req,res,next)=>{try{await renderPage(req,res,'for-you');}catch(error){next(error);}});
 router.get('/resources',async(req,res,next)=>{try{await renderPage(req,res,'resources/index');}catch(error){next(error);}});
 router.get('/resources/:slug',async(req,res,next)=>{try{await renderPage(req,res,'resources/article',`/resources/${req.params.slug}`,{slug:req.params.slug});}catch(error){next(error);}});
 router.get('/partners',async(req,res,next)=>{try{await renderPage(req,res,'partners');}catch(error){next(error);}});
 router.get('/advertise',async(req,res,next)=>{try{await renderPage(req,res,'advertise');}catch(error){next(error);}});
 router.get('/:country(ng|gh|gb)',async(req,res,next)=>{try{const country=String((req.params as any).country);await renderPage(req,res,'index',`/${country}`,{country,pageStyles:['/css/kurukoo-home.css?v=1.0.0']});}catch(error){next(error);}});
 return router;}
export default createPublicRouter();
