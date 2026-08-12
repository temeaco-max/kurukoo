import { GoogleGenAI } from '@google/genai';

let genAIInstance: GoogleGenAI | null = null;

export function getGenAIClient(): GoogleGenAI {
    if (!genAIInstance) {
        const apiKey = process.env.GEMINI_API_KEY || process.env.API_KEY || '';
        genAIInstance = new GoogleGenAI({ apiKey });
    }
    return genAIInstance;
}

function getGenAI(): GoogleGenAI { return getGenAIClient(); }

export interface GeminiChatOptions {
    systemInstruction?: string;
    temperature?: number;
    maxOutputTokens?: number;
    responseMimeType?: string;
}

/**
 * Query Gemini 3.6 Flash / 3.1 Flash-Lite for fast, reliable, high-quality responses with built-in free tier.
 */
export async function queryGemini(prompt: string, options?: GeminiChatOptions): Promise<string> {
    const isJson = options?.responseMimeType === 'application/json';
    try {
        const ai = getGenAI();
        const response = await ai.models.generateContent({
            model: 'gemini-3.6-flash',
            contents: prompt,
            config: {
                systemInstruction: options?.systemInstruction || 'You are Kurukoo, a conversational fulfilment assistant. Help clarify what the user needs and route it through Kurukoo\'s canonical request flow. Never claim that a provider is verified or available, a price is current, a reminder is saved, a payment is complete, money is held, a message was delivered, or an emergency contact was notified unless the server has supplied authoritative evidence. If an external integration is unavailable, say so plainly and offer the text-based next step.',
                temperature: options?.temperature ?? 0.7,
                maxOutputTokens: options?.maxOutputTokens ?? 512,
                responseMimeType: options?.responseMimeType,
            }
        });

        if (response && response.text) {
            return response.text.trim();
        }
        return getGeminiFallback(prompt, isJson);
    } catch (err: any) {
        console.warn('[Gemini Service] API call failed or rate limit, falling back gracefully:', err?.message || err);
        return getGeminiFallback(prompt, isJson);
    }
}

function getGeminiFallback(prompt: string, isJson: boolean = false): string {
    const q = prompt.toLowerCase();

    if (isJson) {
        let category = 'artisan';
        let selectedType: string | null = null;
        let reply = '';
        
        if (q.includes('ride') || q.includes('okada') || q.includes('keke') || q.includes('car') || q.includes('taxi')) {
            category = 'ride';
            if (q.includes('okada')) selectedType = 'Okada';
            else if (q.includes('keke')) selectedType = 'Keke';
            else if (q.includes('taxi') || q.includes('car') || q.includes('cab')) selectedType = 'Taxi';
            
            if (selectedType) {
                reply = `I can help you request a ${selectedType} ride. I still need the route and timing, then Kurukoo will show only options supported by current provider data.`;
            } else {
                reply = `Ku Kurukoo! Which do you prefer for your transit today? Okada, Keke, or Taxi?`;
            }
        } else if (q.includes('food') || q.includes('hungry') || q.includes('caterer') || q.includes('rice') || q.includes('eat')) {
            category = 'food';
            if (q.includes('suya')) selectedType = 'Suya & Masa';
            else if (q.includes('rice') || q.includes('yam')) selectedType = 'Rice & Yam Bundle';
            else if (q.includes('caterer')) selectedType = 'Local Caterer Platter';
            
            if (selectedType) {
                reply = `I can help you request ${selectedType}. Tell me the delivery area and timing; availability, price, and fulfilment will be confirmed only after a real option is found.`;
            } else {
                reply = `Ku Kurukoo! What are you craving today? Suya & Masa, Rice & Yam Bundle, or a Caterer Platter?`;
            }
        } else {
            category = 'artisan';
            if (q.includes('mechanic')) selectedType = 'Mobile Mechanic';
            else if (q.includes('security') || q.includes('guard')) selectedType = 'Event Security';
            else if (q.includes('bill') || q.includes('electricity') || q.includes('meter')) selectedType = 'Electricity Bill';
            
            if (selectedType) {
                reply = `I can help you request ${selectedType}. Share the location and urgency; Kurukoo will distinguish a real provider match from a request that still needs searching.`;
            } else {
                reply = `Ku Kurukoo! I can connect you with local artisans or clear utilities. Which do you need? Mobile Mechanic, Event Security, or Electricity Bill?`;
            }
        }
        
        return JSON.stringify({
            category,
            hasAllDetails: !!selectedType,
            selectedType,
            reply,
            thoughts: `Autonomous rule-fallback active. Instantiated local entity recognizer on: "${prompt}".`
        });
    }

    if (q.includes('ride') || q.includes('okada') || q.includes('keke') || q.includes('taxi')) {
        return 'I can help you request transport. Tell me your pickup, destination, and timing; Kurukoo will look for a real option and will not invent availability or a price.';
    }
    if (q.includes('price') || q.includes('market') || q.includes('cost')) {
        return 'I can help clarify what price information you need. Any price or availability shown must come from a configured, current source; no live market feed is connected in this fallback.';
    }
    if (q.includes('mot') || q.includes('bin') || q.includes('reminder') || q.includes('council')) {
        return 'I can help you create or review a reminder. It is not saved until the reminder service confirms persistence and the relevant date and timezone are clear.';
    }
    return `I can help clarify that request: "${prompt}". Tell me what outcome you want, and I will route it through Kurukoo\'s canonical conversation flow without assuming a provider, price, payment, or connected channel.`;
}
