import fs from 'fs';
import path from 'path';
import { getAdminFeatureOverride } from './adminControlPlane.js';

const FLAG_ENV_PREFIX = 'FF_';

function parseBoolean(value: string | undefined): boolean | undefined {
    if (value === undefined) return undefined;
    const normalized = value.trim().toLowerCase();
    if (['true', '1', 'yes', 'on'].includes(normalized)) return true;
    if (['false', '0', 'no', 'off'].includes(normalized)) return false;
    return undefined;
}

function localeCandidates(country: string): string[] {
    const normalized = String(country || 'ng').toLowerCase();
    const candidates = [normalized];
    if (normalized === 'gb' || normalized === 'uk') candidates.push('gb', 'en');
    else if (normalized === 'ng') candidates.push('ng', 'en');
    else candidates.push('en');
    return [...new Set(candidates)];
}

export function getFeatureFlag(country: string, flagName: string): boolean {
    const envName = `${FLAG_ENV_PREFIX}${flagName.toUpperCase()}`;
    const deploymentLocked = parseBoolean(process.env[`KURUKOO_ADMIN_LOCK_${envName}`]) === true;
    // An explicit deployment lock wins. Otherwise a persisted admin override can safely supersede a bootstrap default.
    const envValue = parseBoolean(process.env[envName]);
    if (deploymentLocked && envValue !== undefined) return envValue;
    const adminOverride = getAdminFeatureOverride(country, flagName);
    if (adminOverride !== undefined) return adminOverride;
    if (envValue !== undefined) return envValue;

    for (const locale of localeCandidates(country)) {
        const filePath = path.join(process.cwd(), 'locales', `${locale}.json`);
        try {
            if (!fs.existsSync(filePath)) continue;
            const localeData = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
            const value = localeData?.feature_flags?.[flagName];
            if (typeof value === 'boolean') return value;
            if (typeof value === 'string') {
                const parsed = parseBoolean(value);
                if (parsed !== undefined) return parsed;
            }
        } catch (e) {
            console.error(`Error reading feature flag ${flagName} for locale ${locale}:`, e);
        }
    }

    // Blueprint default is fail-closed for optional features.
    return false;
}

export function isFeatureEnabled(country: string, flagName: string): boolean {
    return getFeatureFlag(country, flagName);
}
