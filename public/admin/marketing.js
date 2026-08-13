(() => {
  'use strict';

  const byId = (id) => document.getElementById(id);
  const form = byId('campaign-form');
  const status = byId('campaign-status');
  const list = byId('campaign-list');
  const categorySelect = byId('campaign-categories');

  const request = async (path, options = {}) => {
    const response = await fetch(`/api/admin${path}`, { credentials: 'same-origin', headers: { 'Content-Type': 'application/json', ...(options.headers || {}) }, ...options });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.error || 'Unable to complete the campaign action');
    return payload;
  };
  const element = (tag, text, className) => { const node = document.createElement(tag); if (className) node.className = className; if (text !== undefined) node.textContent = text; return node; };
  const clear = (node) => node.replaceChildren();
  const money = (value) => `${Number(value || 0).toLocaleString()} credits`;
  const categoryLabel = (value) => String(value || '').split('-').map((part) => part ? `${part[0].toUpperCase()}${part.slice(1)}` : '').join(' ');
  let categoriesLoaded = false;
  const populateCategories = (values) => {
    if (categoriesLoaded || !Array.isArray(values)) return;
    values.forEach((value) => { const option = document.createElement('option'); option.value = String(value); option.textContent = categoryLabel(value); categorySelect.append(option); });
    categoriesLoaded = true;
  };

  function metricsCard(value, label, detail) {
    const card = element('article', undefined, 'admin-stat-card');
    card.append(element('span', label), element('strong', value), element('small', detail));
    return card;
  }

  async function loadMetrics() {
    const grid = byId('mkt-grid'); const boundary = byId('marketing-boundary');
    try {
      const data = await request('/marketing');
      grid.replaceChildren(
        metricsCard(Number(data.referrals || 0).toLocaleString(), 'Recorded referrals', 'Recorded referral records only.'),
        metricsCard(Number(data.activeCampaigns || 0).toLocaleString(), 'Active campaigns', 'A campaign record is not charged media or a commercial outcome.'),
        metricsCard(data.measuredAdImpressions === null ? 'Not measured' : Number(data.measuredAdImpressions || 0).toLocaleString(), 'Impressions', 'No impression tracker is configured when this is not measured.'),
        metricsCard(data.measuredAdClicks === null ? 'Not measured' : Number(data.measuredAdClicks || 0).toLocaleString(), 'Clicks', 'No click tracker is configured when this is not measured.'),
      );
      boundary.textContent = data.boundary || 'Only recorded marketing activity is shown.';
    } catch (error) {
      grid.replaceChildren(metricsCard('Unavailable', 'Marketing evidence', 'Metrics could not be loaded. No marketing status change is implied.'));
      boundary.textContent = error instanceof Error ? error.message : 'Marketing evidence is currently unavailable.';
    }
  }

  async function changeStatus(id, next) {
    status.textContent = 'Updating campaign status…';
    try { await request(`/marketing/campaigns/${encodeURIComponent(id)}/status`, { method: 'POST', body: JSON.stringify({ status: next }) }); status.textContent = 'Campaign status updated.'; await loadCampaigns(); await loadMetrics(); }
    catch (error) { status.textContent = error instanceof Error ? error.message : 'Unable to update campaign.'; }
  }

  function renderCampaigns(campaigns) {
    clear(list);
    if (!campaigns.length) { const row = element('tr'); const cell = element('td', 'No campaign records. Create a disclosed campaign only when you have an approved placement and evidence policy.'); cell.colSpan = 6; cell.className = 'admin-empty-state'; row.append(cell); list.append(row); return; }
    campaigns.forEach((campaign) => {
      const row = element('tr');
      const campaignCell = element('td'); campaignCell.append(element('strong', campaign.title), element('small', campaign.desc));
      const targeting = element('td'); targeting.append(element('span', campaign.targetKeyword || 'No keyword'), element('small', Array.isArray(campaign.targetCategories) && campaign.targetCategories.length ? campaign.targetCategories.join(', ') : 'No category target'));
      const disclosure = element('td'); disclosure.append(element('span', campaign.disclosure), element('small', campaign.placementSource === 'kurukoo_sponsored' ? 'Kurukoo-sponsored placement' : 'External advertising inventory'));
      const budget = element('td'); budget.append(element('span', money(campaign.creditsBudget)), element('small', `${money(campaign.creditsSpent)} recorded spend`));
      const state = element('td', campaign.status, `admin-status admin-status--${campaign.status}`);
      const controls = element('td');
      if (campaign.status === 'active') { const pause = element('button', 'Pause', 'admin-button admin-button--secondary'); pause.type = 'button'; pause.addEventListener('click', () => { void changeStatus(campaign.id, 'paused'); }); controls.append(pause); }
      else if (campaign.status === 'paused' || campaign.status === 'inactive') { const activate = element('button', 'Activate', 'admin-button admin-button--primary'); activate.type = 'button'; activate.addEventListener('click', () => { void changeStatus(campaign.id, 'active'); }); controls.append(activate); }
      else controls.textContent = 'Completed';
      row.append(campaignCell, targeting, disclosure, budget, state, controls); list.append(row);
    });
  }

  async function loadCampaigns() {
    try { const data = await request('/marketing/campaigns'); populateCategories(data.categories); renderCampaigns(Array.isArray(data.campaigns) ? data.campaigns : []); }
    catch (error) { clear(list); const row = element('tr'); const cell = element('td', error instanceof Error ? error.message : 'Campaign records are unavailable.'); cell.colSpan = 6; cell.className = 'admin-empty-state'; row.append(cell); list.append(row); }
  }

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const data = new FormData(form);
    const targetCategories = Array.from(categorySelect.selectedOptions).map((option) => option.value);
    const payload = { title: String(data.get('title') || ''), desc: String(data.get('desc') || ''), imageUrl: '', targetKeyword: String(data.get('targetKeyword') || ''), targetCategories, creditsBudget: Number(data.get('creditsBudget') || 0), placementSource: String(data.get('placementSource') || 'external_inventory'), disclosure: String(data.get('disclosure') || '') };
    status.textContent = 'Creating campaign…';
    try { await request('/marketing/campaigns', { method: 'POST', body: JSON.stringify(payload) }); form.reset(); byId('campaign-categories').selectedIndex = -1; status.textContent = 'Campaign created. It remains a disclosed record, not a provider or commercial-outcome claim.'; await loadCampaigns(); await loadMetrics(); }
    catch (error) { status.textContent = error instanceof Error ? error.message : 'Unable to create campaign.'; }
  });

  byId('campaign-refresh').addEventListener('click', () => { void loadCampaigns(); });
  const hasAdminSession = ['kurukoo_admin', 'kurukoo_admin_token'].some((key) => Boolean(window.localStorage.getItem(key)));
  if (!hasAdminSession) {
    byId('marketing-boundary').textContent = 'Sign in as an administrator to view or manage campaign records.';
    byId('mkt-grid').replaceChildren(metricsCard('Sign in required', 'Marketing evidence', 'Campaign metrics and controls are protected platform data.'));
    clear(list); const row = element('tr'); const cell = element('td', 'Sign in as an administrator to view campaign records.'); cell.colSpan = 6; cell.className = 'admin-empty-state'; row.append(cell); list.append(row);
    form.querySelectorAll('input, textarea, select, button').forEach((control) => { control.disabled = true; });
  } else { void loadMetrics(); void loadCampaigns(); }
})();
