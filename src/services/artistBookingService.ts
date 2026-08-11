import crypto from 'node:crypto';
import { getDb, saveDb } from '../database.js';
import { getProfile, updateProfile } from './memoryProfile.js';
import { createEconomicRequest, getEconomicRequest, transitionEconomicRequest } from './skillFlows.js';
import { lockEscrowForEconomicRequest } from './tradeEngine.js';

/** Artist/talent is a shared Economic Request policy adapter. Its only special capability is representation verification. */
export interface ArtistBookingRequest { artistPhone:string; eventDate:string; venue:string; eventDetails:string; budgetMinor:number; currency?:string; audienceSize?:number; duration?:string; eventType?:string; technicalRider?:string; travelRequirements?:string; }
function validDate(value:string){const d=new Date(value);return !Number.isNaN(d.getTime())&&d.getTime()>Date.now();}
function bookingToken(){return crypto.randomBytes(18).toString('base64url');}

export async function requestArtistVerification(phone:string,skill:string,managerName:string,managerContact:string):Promise<void>{const profile=await getProfile(phone);if(!profile)throw new Error('Provider profile not found');if(!skill.trim()||!managerName.trim()||!managerContact.trim())throw new Error('Representation verification details are incomplete');const prefs=profile.preferences||{};prefs.representation_verification={skill:skill.trim(),managerName:managerName.trim(),managerContact:managerContact.trim(),status:'pending',requested_at:new Date().toISOString()};await updateProfile(phone,'system',{preferences:prefs});const db=await getDb();db.run(`UPDATE skills SET verified_artist=0 WHERE phone=? AND lower(skill)=lower(?)`,[phone,skill.trim()]);saveDb();}

export async function approveArtistVerification(artistPhone:string,approvedBy:string):Promise<void>{const profile=await getProfile(artistPhone);if(!profile)throw new Error('Provider profile not found');if(!approvedBy.trim())throw new Error('Verification approver is required');const prefs=profile.preferences||{};if(!prefs.representation_verification&&!prefs.artist_verification)throw new Error('No representation verification request exists');prefs.representation_verification={...(prefs.representation_verification||prefs.artist_verification),status:'verified',verified_at:new Date().toISOString(),verified_by:approvedBy.trim()};delete prefs.artist_verification;await updateProfile(artistPhone,'system',{preferences:prefs});const skill=String(prefs.representation_verification.skill||'verified_artist');const db=await getDb();db.run(`UPDATE skills SET verified_artist=1 WHERE phone=? AND lower(skill)=lower(?)`,[artistPhone,skill]);saveDb();}

export async function bookArtist(customerPhone:string,request:ArtistBookingRequest):Promise<{requestId:string;bookingToken:string}>{
 if(!validDate(request.eventDate))throw new Error('Booking date must be a future date');
 if(!request.venue.trim()||!request.eventDetails.trim())throw new Error('Venue and event details are required');
 if(!Number.isInteger(request.budgetMinor)||request.budgetMinor<=0)throw new Error('Budget must be a positive integer in minor currency units');
 const provider=await getProfile(request.artistPhone);if(!provider)throw new Error('Provider profile not found');
 const verification=provider.preferences?.representation_verification||provider.preferences?.artist_verification;if(verification?.status!=='verified')throw new Error('Provider representation verification is required before booking');
 const token=bookingToken();const requestId=`booking_${token}`;const requirements={provider_phone:request.artistPhone,artist_or_act:provider.display_name||request.artistPhone,event_date:request.eventDate,venue:request.venue.trim(),event_details:request.eventDetails.trim(),event_type:request.eventType||'performance',audience_size:request.audienceSize??null,duration:request.duration||null,budget:request.budgetMinor,currency:request.currency||'NGN',representation_requirement:'verified representative',technical_rider:request.technicalRider||null,travel_requirements:request.travelRequirements||null};
 await createEconomicRequest({id:requestId,phone:customerPhone,skill:'verified_artist',requirements,amount:request.budgetMinor});
 await transitionEconomicRequest(requestId,'awaiting_match',{providerPhone:request.artistPhone});
 await transitionEconomicRequest(requestId,'matched',{providerPhone:request.artistPhone});
 // The customer's budget is a constraint, never a fabricated provider quote. A final quote must come from the provider/booking adapter.
 return{requestId,bookingToken:token};
}

/** Artist booking uses the shared payment/escrow path. It cannot create escrow from a budget alone. */
export async function confirmArtistBooking(customerPhone:string,requestId:string):Promise<{success:boolean;requestId:string;orderId?:string;escrowId?:number;message:string}>{const request=await getEconomicRequest(requestId);if(!request||request.phone!==customerPhone)return{success:false,requestId,message:'Booking request not found'};if(request.skill!=='verified_artist')return{success:false,requestId,message:'Request is not an artist booking'};if(!request.providerPhone)return{success:false,requestId,message:'No verified representative has been matched'};if(!['quoted','awaiting_confirmation','paid'].includes(request.status))return{success:false,requestId,message:`A confirmed provider quote is required before booking payment (current status: ${request.status})`};const result=await lockEscrowForEconomicRequest(requestId);return{success:result.success,requestId,orderId:result.orderId,escrowId:result.escrowId,message:result.success?'Verified payment received and shared escrow is active.':'The shared payment/escrow capability is not active for this booking yet: '+result.message};}

/** Escrow release is deliberately not artist-specific; the shared transaction worker owns it. */
export async function releaseArtistEscrow(_escrowId:number,_bypassCoolingOff=false):Promise<{success:boolean;message:string}>{return{success:false,message:'Artist escrow release is handled by the shared Economic OS cooling-off worker; use the common transaction lifecycle.'};}
