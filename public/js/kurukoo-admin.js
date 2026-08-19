(() => {
  const queue = document.getElementById('admin-queue');
  const refresh = document.getElementById('load-admin');
  const panel = document.getElementById('admin-section-panel');
  const section = new URLSearchParams(location.search).get('section') || 'overview';
  const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const render = (text) => { if (queue) queue.innerHTML = `<div class="k-row"><span>${esc(text)}</span><span class="k-muted">Authenticated admin API required</span></div>`; };

  const loadJson = async (url) => {
    const response = await fetch(url, { credentials: 'same-origin', headers: { Accept: 'application/json' } });
    if (!response.ok) throw new Error(`Admin API ${response.status}`);
    return response.json();
  };

  const renderList = (items) => `<div class="k-list">${items.map(([label, value]) => `<div class="k-row"><span>${esc(label)}</span><strong>${esc(value)}</strong></div>`).join('')}</div>`;

  const renderSection = async () => {
    if (!panel) return;
    if (section === 'providers') {
      panel.innerHTML = '<div class="card"><h2>Provider readiness</h2><p class="muted">This view is a control surface over existing provider entities, trust evidence and external-integration readiness. It does not create a second provider registry.</p><div id="provider-panel">Loading…</div></div>';
      try {
        const data = await loadJson('/api/admin/trust/readiness');
        const evidence = Object.entries(data.channelEvidence || {}).reduce((sum, [, statuses]) => sum + Object.values(statuses || {}).reduce((n, value) => n + Number(value || 0), 0), 0);
        document.getElementById('provider-panel').innerHTML = renderList([
          ['Trusted devices active', data.trustedDevices?.active ?? 0],
          ['Channel evidence records', evidence],
          ['WhatsApp linked state', data.connectors?.whatsappLinkedDevice?.status ?? 'unknown'],
          ['Telegram linked state', data.connectors?.telegramLinkedDevice?.status ?? 'unknown'],
          ['Provider verification', 'Evidence-gated'],
          ['External fulfilment', 'Activation-dependent'],
        ]);
      } catch (error) { document.getElementById('provider-panel').innerHTML = `<p class="muted">Provider readiness unavailable: ${esc(error.message)}</p>`; }
      return;
    }

    if (section === 'compliance' || section === 'settings') {
      panel.innerHTML = `<div class="card"><h2>${section === 'compliance' ? 'Compliance & safety' : 'Platform settings'}</h2><p class="muted">${section === 'compliance' ? 'Review canonical safety, trust, privacy and activation gates. No UI state here is evidence of live external fulfilment.' : 'Review non-secret feature/activation state through the canonical readiness projection. Credential values are never exposed.'}</p><div id="settings-panel">Loading…</div></div>`;
      try {
        const data = await loadJson('/api/admin/trust/readiness');
        if (section === 'compliance') {
          document.getElementById('settings-panel').innerHTML = renderList([
            ['Progressive trust', data.featureFlags?.progressiveTrust ? 'Enabled' : 'Disabled'],
            ['Channel evidence', data.featureFlags?.channelEvidence ? 'Enabled' : 'Disabled'],
            ['Push approval', data.featureFlags?.pushApproval ? 'Enabled' : 'Disabled'],
            ['Email OTP', data.featureFlags?.emailOtp ? 'Enabled' : 'Disabled'],
            ['Private number masking', data.featureFlags?.privateNumberMasking ? 'Enabled' : 'Disabled'],
            ['Privacy number bridge', data.privacyNumberMasking?.status ?? 'Unknown'],
            ['Delivery claims', data.deliveryClaims ?? 'Internal states only'],
          ]);
        } else {
          document.getElementById('settings-panel').innerHTML = renderList([
            ['Configured feature flags', Object.keys(data.featureFlags || {}).length],
            ['Trusted devices', `${data.trustedDevices?.active ?? 0} active / ${data.trustedDevices?.revoked ?? 0} revoked`],
            ['Trust challenges pending', data.trustChallenges?.pending ?? 0],
            ['Local model state', data.brain?.localModel?.mode ?? data.brain?.localModel?.executionMode ?? 'Unknown'],
            ['Context arbitration telemetry', data.brain?.contextArbitration ? 'Available' : 'Unavailable'],
            ['External delivery truth', 'Fail-closed'],
            ['Credentials', 'Never exposed in UI'],
          ]);
        }
      } catch (error) { document.getElementById('settings-panel').innerHTML = `<p class="muted">Readiness unavailable: ${esc(error.message)}</p>`; }
      return;
    }

    if (panel) panel.innerHTML = '';
  };

  refresh?.addEventListener('click', () => render(`${section} queue ready`));
  renderSection();
})();