import { getDb, saveDb } from '../database.js';
import { getProfile, updateProfile } from './memoryProfile.js';
import { isEmailOtpEnabled, normalizeOtpEmail, normalizeOtpPhone, requestEmailOtp, requestPhoneOtp, verifyEmailOtp, verifyPhoneOtp } from './otpAuthService.js';
import { developmentTestOtpLabel, isDevelopmentTestIdentity, verifyDevelopmentTestOtp } from './devTestAuthService.js';
import { issueUserToken, upsertProfile } from '../routes/authRoutes.js';
import { sendFcmPush } from './pushNotifications.js';
import { generateConversationalResponse } from './conversationalGenerationService.js';
import { resolveConversationPriority } from './conversationPriorityService.js';
import { executeCanonicalCapabilityProposal } from './canonicalCapabilityExecutor.js';
import { requestMagicLink, isMagicLinkAuthEnabled, sanitizeReturnPath } from './authChallengeService.js';
import { handleEmergencyTurn } from './emergencyService.js';

export type AuthState = 'none' | 'awaiting_name' | 'awaiting_phone' | 'awaiting_otp' | 'awaiting_email_phone' | 'awaiting_email_otp';

export interface ConversationalAuthResult {
  reply: string;
  cardData?: any;
  authenticated?: boolean;
  token?: string;
  phone?: string;
  continuationMessage?: string;
}

const GUEST_CONVERSATION_RE = /^(?:hi|hey|hello|hiya|yo|sup|morning|afternoon|evening|good\s+(?:morning|afternoon|evening)|how\s+are\s+you|how're\s+you|how\s+are\s+things)[.!?,\s]*$/i;
const COMMON_TASK_OR_LOCATION_TERMS = /\b(?:rice|yam|food|groceries|ride|repair|work|barber|delivery|deliver|plumber|electrician|mechanic|cleaner|tailor|appointment|errand|ikeja|yaba|lagos|lekki|ajah|surulere|maryland|victoria\s+island|ibadan|abuja|port\s+harcourt)\b/i;
const REQUEST_SHAPING_RE = /\b(?:and|in|at|near|around|to|from|for|deliver(?:ed|y)?|need|want|find|book|get|help|looking|area|location)\b/i;
const EXPLICIT_NAME_RE = /^(?:my\s+name\s+is|i(?:'m| am)|call\s+me)\s+([A-Za-z][A-Za-z0-9 .'-]{1,58})[.!?]?$/i;

/** Refuse task and location language at the identity boundary unless the user explicitly introduces a name. */
export function isPlausibleConversationalName(text: string): boolean {
  const value = text.trim().replace(/\s+/g, ' ');
  if (!value || value.length > 60 || GUEST_CONVERSATION_RE.test(value)) return false;
  const explicit = value.match(EXPLICIT_NAME_RE);
  if (explicit) return /^[A-Za-z][A-Za-z0-9 .'-]*$/.test(explicit[1].trim()) && explicit[1].trim().split(/\s+/).length <= 4;
  if (!/^[A-Za-z][A-Za-z0-9 .'-]*$/.test(value)) return false;
  if (COMMON_TASK_OR_LOCATION_TERMS.test(value) && REQUEST_SHAPING_RE.test(value)) return false;
  if (/[,:;]/.test(value) || /(?:^|\s)(?:i|my|me|please)\b/i.test(value)) return false;
  const words = value.split(' ');
  return words.length <= 4 && words.every(word => /^[A-Za-z][A-Za-z0-9'’-]*$/.test(word));
}

export async function getAuthState(guestPhone: string): Promise<{ state: AuthState, data: any }> {
  const profile = await getProfile(guestPhone, 'conversational_auth');
  const prefs = profile?.preferences && typeof profile.preferences === 'object' ? profile.preferences : {};
  return { state: (prefs.auth_in_chat_state || 'none') as AuthState, data: prefs.auth_in_chat_data && typeof prefs.auth_in_chat_data === 'object' ? prefs.auth_in_chat_data : {} };
}

export async function setAuthState(guestPhone: string, state: AuthState, data: any = {}): Promise<void> {
  const profile = await getProfile(guestPhone, 'conversational_auth');
  const prefs = profile?.preferences && typeof profile.preferences === 'object' ? { ...profile.preferences } : {};
  prefs.auth_in_chat_state = state; prefs.auth_in_chat_data = data;
  await updateProfile(guestPhone, 'conversational_auth', { preferences: prefs });
}

export async function handleConversationalAuth(guestPhone: string, text: string): Promise<ConversationalAuthResult> {
  const priority = resolveConversationPriority(text);
  if (priority.kind === 'emergency') {
    await setAuthState(guestPhone, 'none', {});
    const emergency = await handleEmergencyTurn(guestPhone, text);
    if (emergency) {
      return {
        reply: `${emergency.reply} You do not need to register before seeking immediate help.`,
        cardData: { ...emergency.cardData, type: 'emergency_dispatch', canonicalAction: 'safety.emergency_dispatch', service: emergency.session?.serviceType, status: 'externally_pending', guestAllowed: true, authenticationRequired: false, preservePriorContext: true },
      };
    }
    return { reply: 'This may be an emergency. Call your local emergency number now; you do not need to register before seeking immediate help.', cardData: { type: 'emergency_dispatch', canonicalAction: 'safety.emergency_dispatch', status: 'externally_pending', guestAllowed: true, authenticationRequired: false, preservePriorContext: true } };
  }

  const { state, data } = await getAuthState(guestPhone);

  if (state === 'awaiting_name') {
    const supplied = text.trim();
    const explicit = supplied.match(EXPLICIT_NAME_RE);
    const name = explicit?.[1]?.trim() || supplied;
    if (GUEST_CONVERSATION_RE.test(name)) { await setAuthState(guestPhone, 'none', {}); const generated = await generateConversationalResponse({ prompt: text, phone: guestPhone, systemPrompt: 'You are Kurukoo, a helpful everyday conversational assistant. This is a casual greeting from a guest who has not signed in. Respond naturally and briefly. Do not ask for a name, phone number, OTP, or create a request unless the user explicitly asks for one.' }); return { reply: generated.text }; }
    if (!name) return { reply: "I didn't catch your name. What should I call you?" };
    if (!isPlausibleConversationalName(supplied)) return { reply: 'That sounds like request information, not a name. I have kept it out of your identity profile. Tell me the name you want Kurukoo to use, or say “My name is …”.' };
    await setAuthState(guestPhone, 'awaiting_phone', { ...data, name });
    return { reply: `Nice to meet you, ${name}. Enter your phone number below and I’ll create a verification request and tell you whether an approved delivery method is available.`, cardData: { type: 'auth_conversation', step: 'phone', name } };
  }

  if (state === 'awaiting_phone') {
    const supplied = text.trim();
    if (supplied.includes('@') && isEmailOtpEnabled()) {
      const email = normalizeOtpEmail(supplied);
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { reply: 'That email address does not look valid. You can enter your phone number, or try the email again.' };
      await setAuthState(guestPhone, 'awaiting_email_phone', { ...data, email });
      return { reply: 'Email can be used for the verification code, while your phone remains your primary Kurukoo channel identity. What phone number should stay connected to your account?', cardData: { type: 'auth_conversation', step: 'phone', email } };
    }
    const digits = supplied.replace(/\D/g, ''); if (digits.length < 10) return { reply: "That doesn't look like a valid phone number. Please enter your full phone number (e.g. 080...)" };
    const fullPhone = normalizeOtpPhone(supplied);
    const result = await requestPhoneOtp(fullPhone);
    if (!result.success) {
      if (isMagicLinkAuthEnabled() && data.name) {
        const emailHint = String(data.email || '').trim().toLowerCase();
        if (emailHint && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailHint)) {
          const magic = await requestMagicLink({ email: emailHint, name: data.name, guestPhone, returnPath: '/chat' }).catch(() => ({ success: false, message: 'Unable to issue a magic link', delivery: 'none' as const }));
          if (magic.success) return { reply: 'Phone verification is not available in this environment, but I can continue through your email instead.', cardData: { type: 'auth_magic_link', canonicalAction: 'identity.upgrade.email_magic_link', email: emailHint, debugUrl: 'debugUrl' in magic ? magic.debugUrl : undefined, status: 'ready' } };
        }
      }
      return { reply: `I couldn't request a code for that number: ${result.message || 'unknown error'}. Please try again.` };
    }
    await setAuthState(guestPhone, 'awaiting_otp', { ...data, phone: fullPhone });
    const controlledTest = isDevelopmentTestIdentity(fullPhone); const delivered = /sent|delivery/i.test(String(result.message || '')) && !/generated|configure/i.test(String(result.message || ''));
    const reply = controlledTest ? `For this controlled development test, use verification code ${developmentTestOtpLabel()}. No external SMS was sent.` : delivered ? "I've sent a 6-digit verification code to your phone. Enter it here to continue." : "I've created the verification request, but external SMS/WhatsApp delivery is not configured in this environment. Do not assume a code was delivered; connect an approved delivery provider before using this flow with real users.";
    return { reply, cardData: { type: 'auth_conversation', step: 'otp', phone: fullPhone, devCode: controlledTest ? developmentTestOtpLabel() : undefined } };
  }

  if (state === 'awaiting_email_phone') {
    const phone = normalizeOtpPhone(text.trim()); if (phone.replace(/\D/g, '').length < 10) return { reply: 'That does not look like a valid phone number. Please enter your full phone number.' };
    const result = await requestEmailOtp(data.email, phone); if (!result.success) return { reply: result.message || 'I could not request the email code yet.' };
    await setAuthState(guestPhone, 'awaiting_email_otp', { ...data, phone }); const codeNote = result.debugCode ? ` For this development test, use ${result.debugCode}.` : '';
    return { reply: `I’ve sent a verification code to ${data.email}. Enter it here to continue.${codeNote}`, cardData: { type: 'auth_conversation', step: 'otp', email: data.email } };
  }

  if (state === 'awaiting_email_otp') {
    const code = text.trim().replace(/\D/g, ''); if (code.length !== 6) return { reply: 'Please enter the 6-digit code sent to your email.' };
    const result = await verifyEmailOtp(data.email, code); if (!result.success) return { reply: `That email code did not work: ${result.message}. Please check it and try again.` };
    const userPhone = result.phone || data.phone; await upsertProfile(userPhone, data.name, data.email); const db = await getDb(); db.run('UPDATE memory_profiles SET email_verified_at = CURRENT_TIMESTAMP WHERE phone = ?', [userPhone]); saveDb();
    const token = issueUserToken(userPhone); await sendFcmPush(userPhone, 'Kurukoo details confirmed', `Thanks for confirming your email, ${data.name || 'friend'}. Your account is now connected.`, '/chat').catch(() => false); await setAuthState(guestPhone, 'none');
    return { reply: `Thanks for confirming your email, ${data.name || 'friend'}. Your phone remains connected as your primary Kurukoo channel identity, and I’ll continue with the request we were discussing.`, authenticated: true, token, phone: userPhone, continuationMessage: data.continuationMessage || undefined, cardData: data.continuationCard || undefined };
  }

  if (state === 'awaiting_otp') {
    const code = text.trim().replace(/\D/g, ''); if (code.length !== 6) return { reply: 'Please enter the 6-digit code from the approved verification channel, if one has been delivered.' };
    const developmentResult = verifyDevelopmentTestOtp(data.phone, code); const result = developmentResult || await verifyPhoneOtp(data.phone, code); if (!result.success || !result.phone) return { reply: `That code didn't work: ${result.message}. Please check the code and try again.` };
    const userPhone = result.phone; await upsertProfile(userPhone, data.name); const token = issueUserToken(userPhone); await sendFcmPush(userPhone, 'Kurukoo details confirmed', `Thanks for confirming your details, ${data.name || 'friend'}. Your Kurukoo account is now connected.`, '/chat').catch(() => false); await setAuthState(guestPhone, 'none');
    return { reply: `Thanks for confirming your details, ${data.name || 'friend'}. Your Kurukoo profile is now verified, and I’ll continue with the request we were discussing.`, authenticated: true, token, phone: userPhone, continuationMessage: data.continuationMessage || undefined, cardData: data.continuationCard || undefined };
  }
  return { reply: "I'm not sure how to help with that identity step." };
}