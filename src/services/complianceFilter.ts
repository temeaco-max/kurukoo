/* Copyright (c) 2026 temeaco-max. All rights reserved. Proprietary and confidential. */
import { getDb, saveDb } from '../database.js';
import fs from 'fs';
import path from 'path';

let blocklistPatterns: string[] = [];
try {
    const configPath = path.join(process.cwd(), 'config', 'blocklist.json');
    if (fs.existsSync(configPath)) {
        const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
        blocklistPatterns = config.patterns || [];
    }
} catch (err) {
    console.error('Failed to load blocklist.json:', err);
}

const SCAM_KEYWORDS = [
    ...blocklistPatterns,
    'bitcoin', 'crypto', 'investment return', 'double your money', 'wire transfer', 
    'western union', 'urgent cash', 'lottery', 'inheritance', 'bank account details',
    'send money urgently', 'gift card', 'pay outside the platform', 'bypass kurukoo'
];

const SCAM_REGEX = [
    /w\.?e\.?s\.?t\.?e\.?r\.?n\s*u\.?n\.?i\.?o\.?n/i,
    /b\.?i\.?t\.?c\.?o\.?i\.?n/i,
    /c\.?r\.?y\.?p\.?t\.?o/i,
    // Credential and platform-bypass solicitation is unambiguous on its own and does not
    // need a long digit run, so it is checked unconditionally.
    /give\s+(?:me\s+|us\s+)?(?:your\s+|the\s+)?(?:pin|otp|code|passcode)\b/i,
    /share\s+(?:your\s+|the\s+)?(?:pin|otp|code|passcode)\b/i,
    /bypass\s+(?:the\s+)?(?:kurukoo|escrow|platform)/i,
];


// A long digit run on its own is not evidence of a scam. The canonical conversational
// sign-in path (AGENTS.md section 9) is the user typing their own phone number, and
// ordinary messages carry dates, order numbers and reference ids. This rule therefore
// contributes to a block only when the digit run appears in a money or transfer
// context, which is what it was always meant to detect. The scam keyword and pattern
// checks above stay unconditional.
const DIGIT_RUN = /\+?[0-9][0-9\s\-]{7,19}[0-9]/;
const MONEY_TRANSFER_CONTEXT = [
    /send\s+(?:the\s+|me\s+|us\s+|to\s+|for\s+|it\s+|back\s+)*(?:money|cash|funds)/i,
    /(?:transfer|wire)\s+(?:the\s+|me\s+|us\s+|to\s+|for\s+)*(?:money|cash|funds)/i,
    /pay\s+(?:me\s+|us\s+|him\s+|her\s+|them\s+)?(?:directly|outside|off[\s-]?platform)/i,
    /(?:bank|account)\s+(?:number|details)/i,
    /money\s*(?:urgent|now|asap)/i,
    /(?:urgent|immediately)\s+(?:cash|money|payment)/i,
    /deposit\s+(?:the\s+)?(?:money|funds)/i,
];

export async function checkCompliance(phone: string, text: string): Promise<boolean> {
    const q = text.toLowerCase();
    
    // Keyword check
    for (const kw of SCAM_KEYWORDS) {
        if (q.includes(kw)) {
            await logComplianceEvent(`Scam keyword detected: ${kw}`, phone);
            return false;
        }
    }

    // Regex check
    for (const re of SCAM_REGEX) {
        if (re.test(q)) {
            await logComplianceEvent(`Scam pattern detected: ${re.source}`, phone);
            return false;
        }
    }

    // A digit run only counts when it sits in a money or transfer context.
    if (DIGIT_RUN.test(q)) {
        for (const context of MONEY_TRANSFER_CONTEXT) {
            if (context.test(text)) {
                await logComplianceEvent(`Scam pattern detected: digit run in transfer context (${context.source})`, phone);
                return false;
            }
        }
    }

    return true;
}

async function logComplianceEvent(reason: string, phone: string) {
    const db = await getDb();
    db.run(`INSERT INTO compliance_events (event) VALUES (?)`, [`${reason} from ${phone}`]);
    saveDb();
}
