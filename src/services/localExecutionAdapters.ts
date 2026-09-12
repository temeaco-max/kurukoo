/* Copyright (c) 2026 temeaco-max. All rights reserved. Proprietary and confidential. */
import { getCountryExperience, type CountryCode } from './countryExperience.js';

export interface LocalExecutionAdapter {
  country: CountryCode;
  name: string;
  status: 'configured' | 'pending_activation';
  currency: string;
  emergencyNumber: string;
  strengths: readonly string[];
  executionResources: readonly string[];
  externalActivationRequired: boolean;
}

const ADAPTERS: Record<CountryCode, LocalExecutionAdapter> = {
  ng: {
    country: 'ng', name: 'Nigeria local execution', status: 'configured', currency: 'NGN', emergencyNumber: '112',
    strengths: ['local providers and businesses', 'mobile-first communications', 'local payment rails'],
    executionResources: ['providers', 'businesses', 'agents', 'channels'], externalActivationRequired: true,
  },
  gh: {
    country: 'gh', name: 'Ghana local execution', status: 'configured', currency: 'GHS', emergencyNumber: '112',
    strengths: ['local providers and businesses', 'mobile-first communications', 'local payment rails'],
    executionResources: ['providers', 'businesses', 'agents', 'channels'], externalActivationRequired: true,
  },
  gb: {
    country: 'gb', name: 'United Kingdom local execution', status: 'configured', currency: 'GBP', emergencyNumber: '999',
    strengths: ['local providers and businesses', 'digital services', 'supported communications'],
    executionResources: ['providers', 'businesses', 'agents', 'channels'], externalActivationRequired: true,
  },
  ca: {
    country: 'ca', name: 'Canada local execution', status: 'configured', currency: 'CAD', emergencyNumber: '911',
    strengths: ['broad local discovery', 'service-provider coordination', 'local business participation', 'AI-assisted routing'],
    executionResources: ['providers', 'businesses', 'agents', 'channels'], externalActivationRequired: true,
  },
  us: {
    country: 'us', name: 'United States local execution', status: 'configured', currency: 'USD', emergencyNumber: '911',
    strengths: ['local providers and businesses', 'digital services', 'supported communications'],
    executionResources: ['providers', 'businesses', 'agents', 'channels'], externalActivationRequired: true,
  },
};

export function getLocalExecutionAdapter(value: unknown): LocalExecutionAdapter {
  const country = getCountryExperience(value).code;
  return ADAPTERS[country];
}

export function listLocalExecutionAdapters(): LocalExecutionAdapter[] {
  return Object.values(ADAPTERS);
}
