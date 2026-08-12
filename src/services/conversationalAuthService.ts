import { getDb, saveDb } from '../database.js';
import { requestPhoneOtp, verifyPhoneOtp } from './otpAuthService.js';
import { issueUserToken, upsertProfile } from '../routes/authRoutes.js';

export type AuthState = 'none' | 'awaiting_name' | 'awaiting_phone' | 'awaiting_otp';

export interface ConversationalAuthResult {
  reply: string;
  cardData?: any;
  authenticated?: boolean;
  token?: string;
  phone?: string;
}

export async function getAuthState(guestPhone: string): Promise<{ state: AuthState, data: any }> {
  const db = await getDb();
  const stmt = db.prepare('SELECT preferences FROM memory_profiles WHERE phone = ?');
  stmt.bind([guestPhone]);
  let state: AuthState = 'none';
  let data: any = {};
  if (stmt.step()) {
    const obj = stmt.getAsObject();
    const prefs = obj.preferences ? JSON.parse(String(obj.preferences)) : {};
    state = prefs.auth_in_chat_state || 'none';
    data = prefs.auth_in_chat_data || {};
  }
  stmt.free();
  return { state, data };
}

export async function setAuthState(guestPhone: string, state: AuthState, data: any = {}): Promise<void> {
  const db = await getDb();
  const stmt = db.prepare('SELECT preferences FROM memory_profiles WHERE phone = ?');
  stmt.bind([guestPhone]);
  let prefs: any = {};
  if (stmt.step()) {
    const obj = stmt.getAsObject();
    prefs = obj.preferences ? JSON.parse(String(obj.preferences)) : {};
  }
  stmt.free();
  
  prefs.auth_in_chat_state = state;
  prefs.auth_in_chat_data = data;
  
  db.run('UPDATE memory_profiles SET preferences = ? WHERE phone = ?', [JSON.stringify(prefs), guestPhone]);
  saveDb();
}

export async function handleConversationalAuth(guestPhone: string, text: string): Promise<ConversationalAuthResult> {
  const { state, data } = await getAuthState(guestPhone);
  
  if (state === 'awaiting_name') {
    const name = text.trim();
    if (!name) return { reply: "I didn't catch your name. What should I call you?" };
    
    await setAuthState(guestPhone, 'awaiting_phone', { ...data, name });
    return { 
      reply: `Nice to meet you, ${name}. What's your phone number? I'll send a verification code to secure your account.` 
    };
  }
  
  if (state === 'awaiting_phone') {
    const phone = text.trim().replace(/\D/g, '');
    if (phone.length < 10) return { reply: "That doesn't look like a valid phone number. Please enter your full phone number (e.g. 080...)" };
    
    // For now, assume Nigeria prefix if missing
    const fullPhone = phone.startsWith('+') ? phone : (phone.startsWith('0') ? '+234' + phone.slice(1) : '+234' + phone);
    
    const result = await requestPhoneOtp(fullPhone);
    if (!result.success) return { reply: `I couldn't send a code to that number: ${result.message || 'unknown error'}. Please try again.` };
    
    await setAuthState(guestPhone, 'awaiting_otp', { ...data, phone: fullPhone });
    let reply = "I've sent a 6-digit verification code to your phone. Enter it here to continue.";
    if (result.debugCode) reply += ` (Dev code: ${result.debugCode})`;
    
    return { 
      reply,
      cardData: { type: 'auth_otp_input' }
    };
  }
  
  if (state === 'awaiting_otp') {
    const code = text.trim().replace(/\D/g, '');
    if (code.length !== 6) return { reply: "Please enter the 6-digit code I sent to your phone." };
    
    const result = await verifyPhoneOtp(data.phone, code);
    if (!result.success || !result.phone) return { reply: `That code didn't work: ${result.message}. Please check the code and try again.` };
    
    const userPhone = result.phone;
    await upsertProfile(userPhone, data.name);
    const token = issueUserToken(userPhone);

    // Clear state
    await setAuthState(guestPhone, 'none');
    
    return {
      reply: `You're all set, ${data.name || 'friend'}! I've linked your conversation to your Kurukoo profile. Let's continue where we left off.`,
      authenticated: true,
      token,
      phone: userPhone
    };
  }
  
  return { reply: "I'm not sure how to help with that identity step." };
}
