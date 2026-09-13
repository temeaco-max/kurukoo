(() => {
  const boot = async () => {
    const main = document.querySelector('.admin-main, .k-main, main, .control-room, .admin-content');
    if (!main || document.getElementById('admin-fcm-readiness')) return;
    try {
      const response = await fetch('/api/admin/fcm/readiness', { credentials: 'same-origin', headers: { Accept: 'application/json' } });
      if (!response.ok) return;
      const data = await response.json();
      const server = data.server || {};
      const web = data.web || {};
      const card = document.createElement('section');
      card.id = 'admin-fcm-readiness';
      card.className = 'k-card k-span-12 card';
      const state = data.delivery === 'ready_for_runtime_device_validation' ? 'Configured — device validation pending' : 'Needs configuration';
      card.innerHTML = `<div class="k-section-heading"><div><p class="k-muted">Push delivery</p><h2>Firebase Cloud Messaging</h2></div><span class="k-status">${state}</span></div><div class="k-list"><div class="k-row"><span>Server credentials</span><strong>${server.configured ? 'Configured' : 'Not configured'}</strong></div><div class="k-row"><span>Web client + VAPID</span><strong>${web.configured ? 'Configured' : 'Not configured'}</strong></div><div class="k-row"><span>Registered devices</span><strong>${Number(data.registeredDevices || 0)}</strong></div><div class="k-row"><span>Delivery worker</span><strong>Canonical queue · 15s drain</strong></div><div class="k-row"><span>Truth boundary</span><strong>Accepted ≠ displayed</strong></div></div><p class="k-muted">${server.reason || web.reason || 'FCM readiness unavailable.'}</p><form id="admin-fcm-test-form" class="k-top-actions admin-fcm-test-form"><label><span class="k-muted">Account phone</span><input id="admin-fcm-test-phone" name="phone" type="tel" autocomplete="tel" placeholder="+234…" required></label><label><span class="k-muted">Message</span><input id="admin-fcm-test-body" name="body" type="text" maxlength="500" value="Firebase delivery test from Kurukoo." required></label><button class="k-btn" type="submit">Send test</button><span id="admin-fcm-test-status" class="k-muted" aria-live="polite"></span></form>`;
      main.insertBefore(card, main.firstChild);

      const form = document.getElementById('admin-fcm-test-form');
      form?.addEventListener('submit', async (event) => {
        event.preventDefault();
        const phone = String(document.getElementById('admin-fcm-test-phone')?.value || '').trim();
        const body = String(document.getElementById('admin-fcm-test-body')?.value || '').trim();
        const status = document.getElementById('admin-fcm-test-status');
        if (status) status.textContent = 'Sending…';
        try {
          const result = await fetch('/api/admin/fcm/test', {
            method: 'POST',
            credentials: 'same-origin',
            headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
            body: JSON.stringify({ phone, body }),
          });
          const payload = await result.json().catch(() => ({}));
          if (!result.ok) throw new Error(payload.error || `Request failed (${result.status})`);
          if (status) status.textContent = payload.accepted ? 'Firebase accepted the message for delivery.' : 'Message queued/not accepted; inspect delivery state.';
        } catch (error) {
          if (status) status.textContent = `Test failed: ${error instanceof Error ? error.message : 'unknown error'}`;
        }
      });
    } catch (error) {
      console.warn('[Kurukoo Admin FCM] readiness unavailable', error);
    }
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else void boot();
})();
