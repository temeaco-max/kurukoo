import express, { Router } from 'express';
import fs from 'fs';
import path from 'path';
import { getSeoPage, getSchemaForPage, getFaqForPage } from '../services/seoService.js';

function getLocale(lang = 'en') { const localePath=path.join(process.cwd(),'locales',`${lang}.json`); const fallbackPath=path.join(process.cwd(),'locales','en.json'); try { const filePath=fs.existsSync(localePath)?localePath:fallbackPath; if(fs.existsSync(filePath)) return JSON.parse(fs.readFileSync(filePath,'utf-8')); } catch {} return {tagline:'Your everyday, sorted.'}; }
async function fetchSeoData(urlPath:string,pageTitle?:string){const seo=await getSeoPage(urlPath);const schemas=await getSchemaForPage(urlPath,pageTitle||seo.title);const faqs=await getFaqForPage(urlPath);return{seo,schemas,faqs};}
export function createPublicRouter():Router{const router=express.Router();
 const renderPage=async(req:express.Request,res:express.Response,view:string,reqPath=req.path,extra={})=>{const country='ng';const t=getLocale('en');const{seo,schemas,faqs}=await fetchSeoData(reqPath);res.render(view,{country,t,shortcode:'*7000#',seo,schemas,faqs,reqPath,...extra});};
 router.get('/',async(req,res,next)=>{try{await renderPage(req,res,'index','/');}catch(error){next(error);}});
 router.get('/web',async(_req,res)=>res.sendFile(path.join(process.cwd(),'public','dashboard.html')));
 router.get('/download',async(req,res,next)=>{try{await renderPage(req,res,'download','/download');}catch(error){next(error);}});
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
 return router;}
export default createPublicRouter();
