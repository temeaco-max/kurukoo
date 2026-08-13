(() => {
  'use strict';

  const TOKEN_KEYS = ['kurukoo_admin', 'kurukoo_admin_token'];
  const REFRESH_MS = 30_000;
  const OPEN_REQUEST_STATUSES = new Set([
    'requested', 'awaiting_match', 'quoting', 'quoted', 'partially_matched', 'matched', 'in_progress', 'in_fulfillment', 'disputed',
  ]);
  const STATE_LABELS = {
    requested: 'Requested',
    awaiting_match: 'Awaiting match',
    quoting: 'Quoting',
    quoted: 'Quoted',
    partially_matched: 'Partially matched',
    matched: 'Matched',
    paid: 'Payment verified',
    in_progress: 'In progress',
    in_fulfillment: 'In fulfilment',
    fulfilled: 'Fulfilled',
    completed: 'Completed',
    disputed: 'Disputed',
    cancelled: 'Cancelled',
    expired: 'Expired',
  };

  const byId = (id) => document.getElementById(id);
  const adminToken = () => TOKEN_KEYS.map((key) => window.localStorage.getItem(key)).find(Boolean) || null;
  const asNumber = (value) => (Number.isFinite(Number(value)) ? Number(value) : 0);
  const formatNumber = (value) => new Intl.NumberFormat('en').format(asNumber(value));
  const safeText = (value, fallback = 'Not recorded') => {
    if (typeof value !== 'string') return fallback;
    const trimmed = value.trim();
    return trimmed || fallback;
  };

  function setText(id, value, fallback = 'Not recorded') {
    const element = byId(id);
    if (element) element.textContent = value === undefined || value === null || value === '' ? fallback : String(value);
  }

  function createElement(tag, className, text) {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (text !== undefined) element.textContent = text;
    return element;
  }

  function replaceChildren(element, children) {
    if (!element) return;
    element.replaceChildren(...children);
  }

  function renderEmpty(element, message) {
    replaceChildren(element, [createElement('p', 'admin-empty-state', message)]);
  }

  function handleAuthFailure(response) {
    if (response.status === 401 || response.status === 403) {
      TOKEN_KEYS.forEach((key) => window.localStorage.removeItem(key));
      window.location.replace('/admin/login');
      return true;
    }
    return false;
  }

  async function adminFetch(path) {
    const token = adminToken();
    if (!token) {
      window.location.replace('/admin/login');
      throw new Error('Admin authentication is required');
    }
    const response = await fetch(path, {
      credentials: 'same-origin',
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
    });
    if (handleAuthFailure(response)) throw new Error('Admin session expired');
    if (!response.ok) throw new Error(`Request failed (${response.status})`);
    return response.json();
  }

  function renderRequestState(requests) {
    const list = byId('request-state-list');
    const entries = Object.entries(requests && typeof requests === 'object' ? requests : {})
      .map(([status, count]) => [status, asNumber(count)])
      .sort(([, left], [, right]) => right - left);
    if (!entries.length) {
      renderEmpty(list, 'No Economic Request state has been recorded yet.');
      return;
    }
    const rows = entries.map(([status, count]) => {
      const row = createElement('div', 'admin-state-row');
      const label = createElement('span', 'admin-state-row__label', STATE_LABELS[status] || safeText(status, 'Unclassified'));
      const value = createElement('strong', 'admin-state-row__value', formatNumber(count));
      row.append(label, value);
      return row;
    });
    replaceChildren(list, rows);
  }

  function renderSkillFlows(flows) {
    const target = byId('skill-flow-list');
    if (!Array.isArray(flows) || !flows.length) {
      replaceChildren(target, [createEmptyRow(3, 'No custom skill flows are configured.')]);
      return;
    }
    const rows = flows.map((flow) => {
      const row = document.createElement('tr');
      row.append(
        createCell(safeText(flow?.skill)),
        createCell(safeText(flow?.post_match_action)),
        createCell(safeText(flow?.payment_model)),
      );
      return row;
    });
    replaceChildren(target, rows);
  }

  function createCell(value) {
    return createElement('td', '', value);
  }

  function createEmptyRow(columnCount, message) {
    const row = document.createElement('tr');
    const cell = createElement('td', 'admin-empty-state', message);
    cell.colSpan = columnCount;
    row.append(cell);
    return row;
  }

  function renderPresence(sessions) {
    const list = byId('presence-list');
    if (!Array.isArray(sessions) || !sessions.length) {
      renderEmpty(list, 'No active, unexpired provider presence signals are recorded.');
      return;
    }
    const cards = sessions.map((session) => {
      const item = createElement('div', 'admin-presence-item');
      const name = createElement('strong', '', safeText(session?.name, 'Profile'));
      const details = createElement('span', '', `${safeText(session?.skill, 'Capability')} · ${safeText(session?.location, 'Location not recorded')}`);
      const expiry = createElement('small', '', session?.expires_at ? `Signal expires ${new Date(session.expires_at).toLocaleString()}` : 'Signal expiry not recorded');
      item.append(name, details, expiry);
      return item;
    });
    replaceChildren(list, cards);
  }

  function minorToCurrency(amount, currency) {
    const minor = asNumber(amount);
    const code = typeof currency === 'string' && /^[A-Z]{3}$/.test(currency) ? currency : null;
    if (!code) return formatNumber(minor);
    try {
      return new Intl.NumberFormat('en', { style: 'currency', currency: code }).format(minor / 100);
    } catch {
      return `${code} ${formatNumber(minor)}`;
    }
  }

  function formatCollections(collections) {
    if (!collections || collections.status !== 'recorded' || !Array.isArray(collections.byCurrency) || !collections.byCurrency.length) {
      return 'No verified collection recorded';
    }
    return collections.byCurrency
      .map((entry) => `${minorToCurrency(entry?.amountMinor, entry?.currency)} (${formatNumber(entry?.count)} request${asNumber(entry?.count) === 1 ? '' : 's'})`)
      .join(', ');
  }

  function renderPublishingSignals(contentRecords, seo) {
    const records = Array.isArray(contentRecords) ? contentRecords : [];
    const publicResources = records.filter((record) => ['help', 'page', 'legal'].includes(String(record?.type || ''))).length;
    const score = seo?.health_score;
    const hasRecordedScore = score !== null && score !== undefined && score !== '' && Number.isFinite(Number(score));
    setText('publishing-content-count', formatNumber(records.length));
    setText('publishing-resource-count', formatNumber(publicResources));
    setText('publishing-seo-pages', formatNumber(seo?.total_pages_indexed));
    setText('publishing-seo-health', hasRecordedScore ? `${Number(score)}/100${seo?.grade ? ` · ${seo.grade}` : ''}` : 'Not recorded');
    const note = byId('publishing-seo-note');
    if (note) note.textContent = hasRecordedScore ? `Last recorded internal audit: ${seo?.health_recorded_at ? new Date(seo.health_recorded_at).toLocaleString() : 'time unavailable'}. Search ranking data is not inferred.` : 'No internal SEO audit has been recorded. Run one in SEO studio; saved records are not ranking, crawler, or publication guarantees.';
  }

  function renderStatsUnavailable() {
    ['metric-profiles', 'metric-providers', 'metric-open-requests', 'metric-notifications', 'queue-profiles', 'queue-messages', 'queue-points'].forEach((id) => setText(id, 'Unavailable'));
    setText('queue-summary', 'Platform summary is unavailable. Refresh to retry.');
    renderEmpty(byId('request-state-list'), 'Economic Request state is unavailable. Refresh to retry.');
  }

  function renderPublishingUnavailable() {
    setText('publishing-content-count', 'Unavailable');
    setText('publishing-resource-count', 'Unavailable');
    setText('publishing-seo-health', 'Unavailable');
    setText('publishing-seo-pages', 'Unavailable');
    setText('publishing-seo-note', 'Publishing signals are unavailable. Refresh to retry.');
  }

  function renderCommercialEvidence(metrics) {
    const commercial = metrics && typeof metrics === 'object' ? metrics : {};
    const advertising = commercial.advertising && typeof commercial.advertising === 'object' ? commercial.advertising : {};
    const affiliate = commercial.affiliate && typeof commercial.affiliate === 'object' ? commercial.affiliate : {};
    setText('commercial-collections', formatCollections(commercial.verifiedCustomerCollections));
    setText('commercial-campaigns', `${formatNumber(advertising.activeCampaigns)} active; billing ${safeText(advertising.billingStatus, 'not configured')}`);
    const confirmed = affiliate.conversions && typeof affiliate.conversions === 'object' ? asNumber(affiliate.conversions.confirmed) : 0;
    const commission = asNumber(affiliate.confirmedCommissionMinor);
    const currency = typeof affiliate.currency === 'string' ? affiliate.currency : null;
    setText('commercial-affiliate', commission > 0 && currency ? `${confirmed} confirmed · ${minorToCurrency(commission, currency)}` : `${confirmed} confirmed conversion${confirmed === 1 ? '' : 's'} recorded`);
  }

  function updateStats(stats) {
    const summary = stats?.summary && typeof stats.summary === 'object' ? stats.summary : {};
    const requests = stats?.economic_requests && typeof stats.economic_requests === 'object' ? stats.economic_requests : {};
    const openRequests = Object.entries(requests).reduce((total, [status, value]) => total + (OPEN_REQUEST_STATUSES.has(status) ? asNumber(value) : 0), 0);
    const profiles = asNumber(summary.profiles ?? stats?.users);
    const providers = asNumber(summary.availableProviders ?? stats?.providers);
    const messages = asNumber(summary.messages ?? stats?.messages);
    const points = asNumber(summary.pointsLedgerEntries ?? stats?.credits);
    const notices = asNumber(stats?.unread_internal_notifications);

    setText('metric-profiles', formatNumber(profiles));
    setText('metric-providers', formatNumber(providers));
    setText('metric-open-requests', formatNumber(openRequests));
    setText('metric-notifications', formatNumber(notices));
    setText('queue-profiles', formatNumber(profiles));
    setText('queue-messages', formatNumber(messages));
    setText('queue-points', formatNumber(points));
    setText('queue-summary', `${formatNumber(notices)} unread internal notice${notices === 1 ? '' : 's'} · ${formatNumber(openRequests)} open request${openRequests === 1 ? '' : 's'}`);
    renderRequestState(requests);
  }

  function setRuntimeStatus(message, isError = false) {
    const status = byId('admin-runtime-status');
    if (!status) return;
    status.textContent = message;
    status.classList.toggle('is-error', isError);
  }

  async function loadDashboard() {
    const refresh = byId('admin-refresh');
    if (refresh) { refresh.disabled = true; refresh.textContent = 'Refreshing…'; }
    setRuntimeStatus('Refreshing authenticated records…');
    try {
      const snapshot = await adminFetch('/api/admin/dashboard');
      updateStats(snapshot?.stats);
      renderCommercialEvidence(snapshot?.revenue?.metrics);
      renderSkillFlows(snapshot?.skillFlows);
      renderPresence(snapshot?.presence);
      renderPublishingSignals(snapshot?.content, snapshot?.seo);
      const refreshedAt = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      setRuntimeStatus(`Authenticated records refreshed ${refreshedAt}`);
    } catch {
      renderStatsUnavailable();
      setText('commercial-collections', 'Commercial evidence is unavailable');
      setText('commercial-campaigns', 'Commercial evidence is unavailable');
      setText('commercial-affiliate', 'Commercial evidence is unavailable');
      replaceChildren(byId('skill-flow-list'), [createEmptyRow(3, 'Skill flows are unavailable. Refresh to retry.')]);
      renderEmpty(byId('presence-list'), 'Provider presence is unavailable. Refresh to retry.');
      renderPublishingUnavailable();
      setRuntimeStatus('Dashboard snapshot is unavailable. Refresh to retry.', true);
    } finally {
      if (refresh) { refresh.disabled = false; refresh.textContent = 'Refresh records'; }
    }
  }

  function initialize() {
    if (!adminToken()) {
      window.location.replace('/admin/login');
      return;
    }
    byId('admin-refresh')?.addEventListener('click', () => { void loadDashboard(); });
    void loadDashboard();
    window.setInterval(() => { void loadDashboard(); }, REFRESH_MS);
  }

  document.addEventListener('DOMContentLoaded', initialize, { once: true });
})();
