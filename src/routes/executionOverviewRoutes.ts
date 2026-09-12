/* Copyright (c) 2026 temeaco-max. All rights reserved. Proprietary and confidential. */
import express from 'express';
import { getExternalIntegrationReadiness } from '../services/externalIntegrationReadiness.js';
import { getPilotReadiness } from '../services/pilotReadiness.js';
import { getClientSurfaces } from '../services/clientSurfaceRegistry.js';
import { getCanonicalDiscoverablePlatformFeatures } from '../services/canonicalPlatformFeatureRegistry.js';
import { getLocalExecutionAdapter, listLocalExecutionAdapters } from '../services/localExecutionAdapters.js';

const router = express.Router();

/**
 * Product-level execution inventory. This is deliberately a read model: it does
 * not create a second execution engine or claim that an external integration is
 * live. The canonical chat, Economic Request, provider, agent and payment
 * boundaries remain authoritative for consequential work.
 */
router.get('/execution/overview', (req, res) => {
  const integrations = getExternalIntegrationReadiness();
  const features = getCanonicalDiscoverablePlatformFeatures().filter(feature => !feature.audience.includes('admin'));
  const surfaces = getClientSurfaces('web');
  const readiness = getPilotReadiness();
  const localExecutionAdapter = getLocalExecutionAdapter(req.query.country);

  const modes = [
    { id: 'digital', title: 'Digital', description: 'Websites, apps, forms, research, documents, connected tools and supported digital services.', prompt: 'Handle this digitally if you can.' },
    { id: 'physical', title: 'Physical', description: 'People, providers, businesses, deliveries, repairs, local services and other real-world fulfilment.', prompt: 'Find the right real-world help for this.' },
    { id: 'hybrid', title: 'Hybrid', description: 'Combine digital actions with people, products, logistics or other physical fulfilment.', prompt: 'Work out the best digital and physical route.' },
    { id: 'assisted', title: 'User-assisted', description: 'Prepare the work, ask for the missing approval or information, then continue from the same context.', prompt: 'Prepare everything and tell me what you need from me.' },
  ] as const;

  const surfaceGroups = [
    { id: 'assist', title: 'Assist', path: '/chat', description: 'Tell Kurukoo what needs doing.' },
    { id: 'discover', title: 'Discover', path: '/explore', description: 'Find people, places, products, services, opportunities and information.' },
    { id: 'work', title: 'Work', path: '/work', description: 'See everything Kurukoo is doing, waiting on, or has completed.' },
    { id: 'memory', title: 'Memory', path: '/memory', description: 'Control the context Kurukoo remembers and uses.' },
    { id: 'trust', title: 'Trust', path: '/safety', description: 'Permissions, safety, identity, verification, evidence and truthful outcomes.' },
    { id: 'connect', title: 'Connect', path: '/connect', description: 'Connect channels, tools, devices and external resources.' },
  ] as const;

  res.json({
    success: true,
    product: { name: 'Kurukoo', promise: 'AI that gets things done', primaryAction: 'Tell Kurukoo what needs doing' },
    executionLoop: ['tell', 'understand', 'find_or_plan', 'choose', 'approve', 'do', 'show_proof', 'done'],
    modes,
    surfaceGroups,
    readiness,
    integrationCount: integrations.length,
    enabledIntegrationCount: integrations.filter(item => item.readiness.PRODUCTION_ACTIVE || item.readiness.LIVE_VERIFIED).length,
    configuredIntegrationCount: integrations.filter(item => item.readiness.CREDENTIAL_READY).length,
    featureCount: features.length,
    surfaces,
    features,
    localExecutionAdapter,
    localExecutionAdapters: listLocalExecutionAdapters(),
  });
});

export default router;
