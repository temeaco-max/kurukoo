(() => {
  const queue = document.getElementById('admin-queue');
  const refresh = document.getElementById('load-admin');
  const panel = document.getElementById('admin-section-panel');
  const surfaces = document.getElementById('client-surfaces');
  const modules = document.getElementById('admin-modules');
  const contract = document.getElementById('surface-contract');
  const summary = document.getElementById('surface-summary');
  const section = new URLSearchParams(location.search).get('section') || 'overview';
  const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const render = (text) => { if (queue) queue.innerHTML = `<div class="k-row"><span>${esc(text)}</span><span class="k-muted">Authenticated admin API</span></div>`; };

  const loadJson = async (url) => {
    const response = await fetch(url, { credentials: 'same-origin', headers: { Accept: 'application/json' } });
    if (!response.ok) throw new Error(`Admin API ${response.status}`);
    return response.json();
  };

  const setStat = (id, value) => { const node = document.getElementById(id); if (node) node.textContent = String(value ?? '—'); };
  const readinessLabel = (state) => ({ ready: 'Ready', activation_required: 'Needs activation', device_required: 'Needs device verification' }[state] || 'Unavailable');
  const moduleLabel = (state) => ({ connected: 'Connected', readiness: 'Readiness', 'legacy-surface': 'Existing admin surface' }[state] || 'Review');
  const pilotLabel = (state) => ({ READY: 'Ready', EXTERNAL_DEPENDENCY: 'External dependency', PENDING: 'Pending', DISABLED: 'Disabled', NOT_CONFIGURED: 'Not configured' }[state] || state || 'Unknown');
  const scaleLabel = (state) => ({ READY: 'Ready', PENDING: 'Pending validation', REQUIRED: 'Required before scale', NOT_CONFIGURED: 'Not configured' }[state] || state || 'Unknown');

  const renderSurfaces = (groups) => {
    if (!surfaces) return;
    surfaces.innerHTML = (groups || []).map((group) => {
      const ready = group.surfaces.filter((surface) => surface.readiness === 'ready').length;
      const activation = group.surfaces.filter((surface) => surface.readiness === 'activation_required').length;
      const device = group.surfaces.filter((surface) => surface.readiness === 'device_required').length;
      return `<section class="admin-surface-group"><div class="admin-surface-group-head"><div><span class="k-muted">${esc(group.label)}</span><h3>${esc(group.family.toUpperCase())}</h3></div><span class="k-status">${ready} ready · ${activation} activation · ${device} device</span></div><div class="admin-surface-list">${group.surfaces.map((surface) => `<div class="admin-surface-row"><div><strong>${esc(surface.label)}</strong><span class="k-muted">${esc(surface.route)}</span></div><span class="admin-state admin-state-${esc(surface.readiness)}">${esc(readinessLabel(surface.readiness))}</span></div>`).join('')}</div></section>`;
    }).join('');
  };

  const renderModules = (items) => {
    if (!modules) return;
    const groups = ['operations', 'platform', 'growth', 'content'];
    modules.innerHTML = groups.map((category) => {
      const rows = (items || []).filter(item => item.category === category);
      if (!rows.length) return '';
      return `<section class="admin-module"><div class="admin-module-head"><div><span class="k-muted">${esc(category)}</span><h3>${esc(category === 'operations' ? 'Operations' : category === 'platform' ? 'Platform' : category === 'growth' ? 'Growth' : 'Content')}</h3></div><span class="k-status">${rows.length} areas</span></div><div class="admin-module-list">${rows.map(item => `<div class="admin-surface-row"><div><strong><a href="${esc(item.href)}">${esc(item.label)}</a></strong><span class="admin-module-owner">${esc(item.owner)}</span></div><span class="admin-module-state admin-module-state-${esc(item.state)}">${esc(moduleLabel(item.state))}</span></div>`).join('')}</div></section>`;
    }).join('');
  };

  const renderList = (items) => `<div class="k-list">${items.map(([label, value]) => `<div class="k-row"><span>${esc(label)}</span><strong>${esc(value)}</strong></div>`).join('')}</div>`;
  const renderOperationalQueue = (items) => {
    if (!queue) return;
    const rows = Array.isArray(items) ? items : [];
    queue.innerHTML = rows.length ? rows.map((item) => `<a class="k-row admin-queue-row admin-queue-${esc(item.state)}" href="${esc(item.href)}"><span><strong>${esc(item.label)}</strong><small>${esc(item.description)}</small></span><span class="k-status">${esc(item.count)} · ${esc(item.state === 'clear' ? 'Clear' : item.state === 'blocked' ? 'Activation boundary' : item.state === 'pending' ? 'Pending' : 'Needs review')}</span></a>`).join('') : '<div class="k-row"><span>No operational items are currently projected.</span><span class="k-muted">Canonical admin API</span></div>';
  };

  const renderPilotReadiness = (readiness) => {
    if (!readiness || typeof readiness !== 'object') return '<p class="admin-muted">Canonical dependency readiness is unavailable.</p>';
    const categories = Object.entries(readiness);
    return `<div class="admin-readiness-grid">${categories.map(([category, entries]) => {
      const rows = Object.entries(entries || {});
      return `<section class="admin-module"><div class="admin-module-head"><div><span class="k-muted">${esc(category)}</span><h3>${esc(category.replaceAll('_', ' '))}</h3></div><span class="k-status">${rows.length} checks</span></div><div class="admin-module-list">${rows.map(([name, value]) => {
        const state = value?.state || 'UNKNOWN';
        return `<div class="admin-surface-row"><div><strong>${esc(name)}</strong><span class="admin-module-owner">${esc(value?.note || '')}</span></div><span class="admin-module-state admin-module-state-${esc(state.toLowerCase())}">${esc(pilotLabel(state))}</span></div>`;
      }).join('')}</div></section>`;
    }).join('')}</div>`;
  };

  const renderScaleTransition = (report) => {
    if (!report) return '<p class="admin-muted">Scale transition readiness is unavailable.</p>';
    const items = [
      ['Persistence', report.persistence],
      ['Rate limiting', report.rateLimiting],
      ['Presence', report.presence],
      ['Agent workers', report.agentWorkers],
      ['Object storage', report.objectStorage],
    ];
    return `<div class="admin-readiness-grid">${items.map(([label, value]) => `<div class="admin-surface-row"><div><strong>${esc(label)}</strong><span class="admin-module-owner">${esc(value?.note || '')}</span></div><span class="admin-module-state admin-module-state-${esc(String(value?.state || 'UNKNOWN').toLowerCase())}">${esc(scaleLabel(value?.state))}</span></div>`).join('')}</div><div class="k-card k-scale-recommendation"><span class="k-muted">Recommendation</span><p>${esc(report.recommendation || 'No scale recommendation available.')}</p></div>`;
  };

  const loadPlatform = async () => {
    try {
      const data = await loadJson('/api/admin/platform/overview');
      const counts = data.counts || {};
      setStat('stat-profiles', counts.profiles);
      setStat('stat-requests', counts.openRequests);
      setStat('stat-integrations', `${data.integrations?.implemented ?? 0}/${data.integrations?.total ?? 0}`);
      setStat('stat-active-integrations', `External active ${data.integrations?.externallyActive ?? 0}`);
      setStat('stat-providers', counts.providers);
      setStat('stat-messages', counts.messages);
      setStat('stat-notifications', counts.notificationsPending);
      setStat('stat-orders', `Orders ${counts.orders ?? 0}`);
      setStat('stat-devices', counts.trustedDevices ?? 0);
      setStat('stat-disputes', `Open disputes ${counts.disputes ?? 0}`);
      if (contract) contract.textContent = `${data.contractVersion || 'admin-platform'} · ${new Date(data.generatedAt).toLocaleTimeString()}`;
      if (summary && data.readinessSummary) summary.textContent = `${data.readinessSummary.ready} ready · ${data.readinessSummary.activation_required} activation · ${data.readinessSummary.device_required} device`;
      renderSurfaces(data.surfaces);
      renderModules(data.modules);
      renderOperationalQueue(data.operationalQueue);
      render(`Platform state refreshed · ${data.clientContract?.sourceOfTruth || 'canonical API'}`);
      return data;
    } catch (error) {
      render(`Platform state unavailable: ${error.message}`);
      renderOperationalQueue([]);
      if (contract) contract.textContent = 'Platform projection unavailable';
      if (surfaces) surfaces.innerHTML = '<p class="admin-error">Client surface state could not be loaded. Admin authentication and canonical API health are required.</p>';
      if (modules) modules.innerHTML = '<p class="admin-error">Admin module registry could not be loaded.</p>';
      throw error;
    }
  };

  const renderReadiness = async (title, description, rows) => {
    panel.innerHTML = `<div class="card"><h2>${esc(title)}</h2><p class="muted">${esc(description)}</p><div id="section-data">Loading…</div></div>`;
    try {
      const data = await loadJson('/api/admin/trust/readiness');
      document.getElementById('section-data').innerHTML = renderList(rows(data));
    } catch (error) {
      document.getElementById('section-data').innerHTML = `<p class="admin-error">Readiness unavailable: ${esc(error.message)}</p>`;
    }
  };

  const renderSection = async () => {
    if (!panel) return;
    if (section === 'overview') {
      try {
        const data = await loadJson('/api/admin/platform/overview');
        panel.innerHTML = `<div class="card"><div class="k-section-heading"><div><p class="k-muted">Deployment truth</p><h2>Platform dependency readiness</h2></div><span class="k-status">Canonical pilotReadiness</span></div><p class="muted">Implementation, configuration and external activation are deliberately separated. This view never treats credentials or feature flags as proof of live delivery.</p>${renderPilotReadiness(data.readiness)}<div class="k-section-heading k-scale-heading"><div><p class="k-muted">Scale transition</p><h2>When the launch boundary changes</h2></div><span class="k-status">Canonical scaleTransition</span></div>${renderScaleTransition(data.scaleTransition)}</div>`;
      } catch (error) {
        panel.innerHTML = `<div class="card"><h2>Platform dependency readiness</h2><p class="admin-error">${esc(error.message)}</p></div>`;
      }
      return;
    }
    if (section === 'connectors') {
      try {
        const data = await loadJson('/api/admin/platform/overview');
        panel.innerHTML = `<div class="card"><h2>Channels & integrations</h2><p class="muted">Implementation, activation and device readiness are displayed separately.</p>${renderList([['Integrations represented', data.integrations?.total ?? 0], ['Implemented', data.integrations?.implemented ?? 0], ['Externally active', data.integrations?.externallyActive ?? 0], ['PWA', data.surfaces?.find(x => x.family === 'pwa')?.surfaces?.length ?? 0], ['Native surfaces', data.surfaces?.find(x => x.family === 'native')?.surfaces?.length ?? 0]])}</div>`;
      } catch (error) { panel.innerHTML = `<div class="card"><h2>Channels & integrations</h2><p class="admin-error">${esc(error.message)}</p></div>`; }
      return;
    }
    if (section === 'providers') {
      await renderReadiness('Provider readiness', 'Canonical provider entities, trust evidence and channel state. External fulfilment is never inferred from implementation alone.', data => {
        const evidence = Object.entries(data.channelEvidence || {}).reduce((sum, [, statuses]) => sum + Object.values(statuses || {}).reduce((n, value) => n + Number(value || 0), 0), 0);
        return [['Trusted devices active', data.trustedDevices?.active ?? 0], ['Channel evidence records', evidence], ['WhatsApp linked state', data.connectors?.whatsappLinkedDevice?.status ?? 'unknown'], ['Telegram linked state', data.connectors?.telegramLinkedDevice?.status ?? 'unknown'], ['Provider verification', 'Evidence-gated'], ['External fulfilment', 'Activation-dependent']];
      });
      return;
    }
    if (section === 'compliance' || section === 'settings') {
      await renderReadiness(section === 'compliance' ? 'Compliance & safety' : 'Platform settings', section === 'compliance' ? 'Canonical safety, trust, privacy and activation gates.' : 'Non-secret feature and activation state. Credential values are never exposed.', data => section === 'compliance' ? [
        ['Progressive trust', data.featureFlags?.progressiveTrust ? 'Enabled' : 'Disabled'], ['Channel evidence', data.featureFlags?.channelEvidence ? 'Enabled' : 'Disabled'], ['Push approval', data.featureFlags?.pushApproval ? 'Enabled' : 'Disabled'], ['Email OTP', data.featureFlags?.emailOtp ? 'Enabled' : 'Disabled'], ['Private number masking', data.featureFlags?.privateNumberMasking ? 'Enabled' : 'Disabled'], ['Privacy number bridge', data.privacyNumberMasking?.status ?? 'Unknown'], ['Delivery claims', data.deliveryClaims ?? 'Internal states only']
      ] : [
        ['Configured feature flags', Object.keys(data.featureFlags || {}).length], ['Trusted devices', `${data.trustedDevices?.active ?? 0} active / ${data.trustedDevices?.revoked ?? 0} revoked`], ['Trust challenges pending', data.trustChallenges?.pending ?? 0], ['Local model state', data.brain?.localModel?.mode ?? data.brain?.localModel?.executionMode ?? 'Unknown'], ['Context arbitration telemetry', data.brain?.contextArbitration ? 'Available' : 'Unavailable'], ['External delivery truth', 'Fail-closed'], ['Credentials', 'Never exposed in UI']
      ]);
      return;
    }
    if (section === 'notifications') {
      try {
        const data = await loadJson('/api/admin/platform/overview');
        panel.innerHTML = `<div class="card"><h2>Notifications & delivery</h2><p class="muted">Queue state is owned by the canonical notification service; delivery is not marked complete without evidence.</p>${renderList([['Pending', data.counts?.notificationsPending ?? 0], ['Queue mode', data.notifications?.mode ?? data.notifications?.executionMode ?? 'internal'], ['Push approval', data.notifications?.pushApproval ?? 'deployment-dependent'], ['Delivery truth', 'Evidence-gated']])}</div>`;
      } catch (error) { panel.innerHTML = `<div class="card"><h2>Notifications & delivery</h2><p class="admin-error">${esc(error.message)}</p></div>`; }
      return;
    }
    if (section === 'economic') {
      try {
        const data = await loadJson('/api/admin/platform/overview');
        panel.innerHTML = `<div class="card"><h2>Economic requests</h2><p class="muted">Requests, orders, disputes and payment state remain owned by their canonical services.</p>${renderList([['Open requests', data.counts?.openRequests ?? 0], ['Orders', data.counts?.orders ?? 0], ['Open disputes', data.counts?.disputes ?? 0], ['Payment state', 'Canonical payment service'], ['Escrow / payout', 'External activation required'], ['Audit', 'Required']])}</div>`;
      } catch (error) { panel.innerHTML = `<div class="card"><h2>Economic requests</h2><p class="admin-error">${esc(error.message)}</p></div>`; }
      return;
    }
    if (section === 'moderation' || section === 'conversations' || section === 'seo') {
      const titles = { moderation: ['Moderation & safety', 'Safety gates, curation and evidence remain canonical.'], conversations: ['Conversations', 'The canonical conversation service owns user/agent history and state.'], seo: ['SEO', 'SEO remains an operator-managed surface backed by the existing SEO service.'] };
      panel.innerHTML = `<div class="card"><h2>${esc(titles[section][0])}</h2><p class="muted">${esc(titles[section][1])}</p><div class="k-list"><div class="k-row"><span>Owner</span><strong>Canonical platform service</strong></div><div class="k-row"><span>Admin role</span><strong>Observe / operate</strong></div><div class="k-row"><span>Truth boundary</span><strong>Evidence-gated</strong></div></div></div>`;
      return;
    }
    panel.innerHTML = '';
  };

  refresh?.addEventListener('click', () => { void loadPlatform(); void renderSection(); });
  void loadPlatform();
  void renderSection();
})();
