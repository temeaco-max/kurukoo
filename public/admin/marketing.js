(() => {
  'use strict';
  const byId = (id) => document.getElementById(id);
  const form = byId('campaign-form');
  const status = byId('campaign-status');
  const campaignList = byId('campaign-list');
  const placementList = byId('placement-list');
  const categorySelect = byId('campaign-categories');
  const countrySelect = byId('campaign-countries');
  const placementChoices = byId('campaign-placements');
  const placementBoundary = byId('placement-boundary');
  let categoriesLoaded = false;
  let knownPlacements = [];

  const request = async (path, options = {}) => {
    const response = await fetch(`/api/admin${path}`, { credentials: 'same-origin', headers: { 'Content-Type': 'application/json', ...(options.headers || {}) }, ...options });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.error || 'Unable to complete the marketing action');
    return payload;
  };
  const element = (tag, text, className) => { const node = document.createElement(tag); if (className) node.className = className; if (text !== undefined) node.textContent = text; return node; };
  const clear = (node) => node.replaceChildren();
  const money = (value) => `${Number(value || 0).toLocaleString()} delivery units`;
  const label = (value) => String(value || '').split(/[-_]/).map((part) => part ? `${part[0].toUpperCase()}${part.slice(1)}` : '').join(' ');
  const selectedPlacementIds = () => Array.from(placementChoices.querySelectorAll('input[type="checkbox"]:checked')).map((input) => input.value);

  function metricsCard(value, title, detail) {
    const card = element('article', undefined, 'admin-stat-card');
    card.append(element('span', title), element('strong', value), element('small', detail));
    return card;
  }
  function populateCategories(values) {
    if (categoriesLoaded || !Array.isArray(values)) return;
    values.forEach((value) => { const option = document.createElement('option'); option.value = String(value); option.textContent = label(value); categorySelect.append(option); });
    categoriesLoaded = true;
  }
  function populatePlacementChoices(placements) {
    knownPlacements = Array.isArray(placements) ? placements : [];
    clear(placementChoices);
    knownPlacements.forEach((placement) => {
      const labelEl = element('label', undefined, 'admin-choice');
      const input = document.createElement('input'); input.type = 'checkbox'; input.value = String(placement.id); input.checked = placement.id === 'explore_inline'; input.disabled = !placement.active;
      const detail = element('span'); detail.append(element('strong', label(placement.id)), element('small', `${label(placement.surface)} · ${label(placement.format)} · ${placement.active ? 'Active inventory' : 'Inactive inventory'}`));
      labelEl.append(input, detail); placementChoices.append(labelEl);
    });
  }
  async function loadMetrics() {
    const grid = byId('mkt-grid'); const boundary = byId('marketing-boundary');
    try {
      const data = await request('/marketing');
      grid.replaceChildren(
        metricsCard(Number(data.referrals || 0).toLocaleString(), 'Recorded referrals', 'Recorded referral records only.'),
        metricsCard(Number(data.activeCampaigns || 0).toLocaleString(), 'Active campaigns', 'An active campaign is not charged media or a commercial outcome.'),
        metricsCard(Number(data.measuredAdImpressions || 0).toLocaleString(), 'Placement impressions', 'Deduplicated placement-event evidence only.'),
        metricsCard(Number(data.measuredAdClicks || 0).toLocaleString(), 'Placement clicks', 'Recorded explicit CTA interactions only.'),
      );
      boundary.textContent = data.boundary || 'Only recorded marketing activity is shown.';
    } catch (error) {
      grid.replaceChildren(metricsCard('Unavailable', 'Marketing evidence', 'Metrics could not be loaded. No marketing status change is implied.'));
      boundary.textContent = error instanceof Error ? error.message : 'Marketing evidence is currently unavailable.';
    }
  }
  async function changeCampaignStatus(id, next) {
    status.textContent = 'Updating campaign status…';
    try { await request(`/marketing/campaigns/${encodeURIComponent(id)}/status`, { method: 'POST', body: JSON.stringify({ status: next }) }); status.textContent = 'Campaign status updated.'; await refresh(); }
    catch (error) { status.textContent = error instanceof Error ? error.message : 'Unable to update campaign.'; }
  }
  async function setCampaignSlot(id, placementIds) {
    status.textContent = 'Updating campaign placement assignment…';
    try { await request(`/marketing/campaigns/${encodeURIComponent(id)}/placements`, { method: 'POST', body: JSON.stringify({ placementIds }) }); status.textContent = 'Campaign placement assignment updated.'; await refresh(); }
    catch (error) { status.textContent = error instanceof Error ? error.message : 'Unable to update campaign placement assignment.'; }
  }
  async function updatePlacement(id, patch) {
    try { await request(`/marketing/placements/${encodeURIComponent(id)}`, { method: 'POST', body: JSON.stringify(patch) }); await refresh(); }
    catch (error) { placementBoundary.textContent = error instanceof Error ? error.message : 'Unable to update placement inventory.'; }
  }
  function renderCampaigns(campaigns, campaignMetrics = []) {
    const metricByCampaignId = new Map((campaignMetrics || []).map((metric) => [Number(metric.campaignId), metric]));
    clear(campaignList);
    if (!campaigns.length) { const row = element('tr'); const cell = element('td', 'No campaign records. Create a disclosed campaign only when you have approved placement content and evidence policy.'); cell.colSpan = 6; cell.className = 'admin-empty-state'; row.append(cell); campaignList.append(row); return; }
    campaigns.forEach((campaign) => {
      const row = element('tr');
      const campaignCell = element('td'); campaignCell.append(element('strong', campaign.title), element('small', campaign.desc));
      const targeting = element('td'); targeting.append(element('span', campaign.targetKeyword || 'No keyword'), element('small', `Categories: ${Array.isArray(campaign.targetCategories) && campaign.targetCategories.length ? campaign.targetCategories.join(', ') : 'none'} · Markets: ${Array.isArray(campaign.targetCountries) && campaign.targetCountries.length ? campaign.targetCountries.map(label).join(', ') : 'all active'} · Slots: ${Array.isArray(campaign.placementIds) && campaign.placementIds.length ? campaign.placementIds.map(label).join(', ') : 'none'}`));
      const disclosure = element('td'); disclosure.append(element('span', campaign.disclosure), element('small', campaign.placementSource === 'kurukoo_sponsored' ? 'Kurukoo-sponsored placement' : 'External advertising inventory'));
      const budget = element('td'); const metric = metricByCampaignId.get(Number(campaign.id)); const ctr = metric?.ctr == null ? 'CTR pending exposure' : `${(Number(metric.ctr) * 100).toFixed(1)}% CTR`; budget.append(element('span', money(campaign.creditsBudget)), element('small', `${money(campaign.creditsSpent)} measured exposure cap used · ${Number(metric?.impressions || 0)} impressions · ${Number(metric?.clicks || 0)} clicks · ${ctr}`));
      const state = element('td', campaign.status, `admin-status admin-status--${campaign.status}`);
      const controls = element('td');
      const slotButton = element('button', 'Apply selected slots', 'admin-button admin-button--secondary'); slotButton.type = 'button'; slotButton.addEventListener('click', () => {
        status.textContent = `Applying the currently selected canonical slots to ${campaign.title}.`;
        void setCampaignSlot(campaign.id, selectedPlacementIds());
      });
      if (campaign.status === 'active') { const pause = element('button', 'Pause', 'admin-button admin-button--secondary'); pause.type = 'button'; pause.addEventListener('click', () => { void changeCampaignStatus(campaign.id, 'paused'); }); controls.append(pause); }
      else if (campaign.status === 'paused' || campaign.status === 'inactive') { const activate = element('button', 'Activate', 'admin-button admin-button--primary'); activate.type = 'button'; activate.addEventListener('click', () => { void changeCampaignStatus(campaign.id, 'active'); }); controls.append(activate); }
      else controls.append(element('span', 'Completed'));
      controls.append(slotButton); row.append(campaignCell, targeting, disclosure, budget, state, controls); campaignList.append(row);
    });
  }
  function renderPlacements(placements, metrics) {
    clear(placementList);
    const metricById = new Map((metrics || []).map((metric) => [metric.placementId, metric]));
    if (!placements.length) { const row = element('tr'); const cell = element('td', 'No canonical placement records are configured.'); cell.colSpan = 5; cell.className = 'admin-empty-state'; row.append(cell); placementList.append(row); return; }
    placements.forEach((placement) => {
      const metric = metricById.get(placement.id) || {};
      const row = element('tr');
      const inventory = element('td'); inventory.append(element('strong', label(placement.id)), element('small', placement.active ? 'Available for eligible campaigns' : 'Inactive; no campaigns can resolve'));
      const surface = element('td'); surface.append(element('span', `${label(placement.surface)} · ${label(placement.format)}`), element('small', `${(placement.deviceEligibility || []).join(', ')} · ${placement.contextKinds || []}`));
      const safety = element('td'); safety.append(element('span', `${placement.frequencyCap} impression/session cap`), element('small', `Exclusions: ${(placement.safetyExclusions || []).join(', ') || 'none'}`));
      const evidence = element('td'); evidence.append(element('span', `${Number(metric.impressions || 0)} impressions · ${Number(metric.clicks || 0)} clicks`), element('small', 'Deduplicated event evidence; not billed media or revenue.'));
      const controls = element('td');
      const toggle = element('button', placement.active ? 'Deactivate' : 'Activate', placement.active ? 'admin-button admin-button--secondary' : 'admin-button admin-button--primary'); toggle.type = 'button'; toggle.addEventListener('click', () => { void updatePlacement(placement.id, { active: !placement.active }); });
      const cap = document.createElement('input'); cap.type = 'number'; cap.min = '0'; cap.max = '20'; cap.value = String(placement.frequencyCap); cap.className = 'admin-inline-number'; cap.setAttribute('aria-label', `${label(placement.id)} session frequency cap`); cap.addEventListener('change', () => { void updatePlacement(placement.id, { frequencyCap: Number(cap.value) }); });
      controls.append(toggle, cap); row.append(inventory, surface, safety, evidence, controls); placementList.append(row);
    });
  }
  async function loadCampaigns() {
    try { const data = await request('/marketing/campaigns'); populateCategories(data.categories); populatePlacementChoices(data.placements); renderCampaigns(Array.isArray(data.campaigns) ? data.campaigns : [], Array.isArray(data.campaignMetrics) ? data.campaignMetrics : []); }
    catch (error) { clear(campaignList); const row = element('tr'); const cell = element('td', error instanceof Error ? error.message : 'Campaign records are unavailable.'); cell.colSpan = 6; cell.className = 'admin-empty-state'; row.append(cell); campaignList.append(row); }
  }
  async function loadPlacements() {
    try { const data = await request('/marketing/placements'); renderPlacements(Array.isArray(data.placements) ? data.placements : [], Array.isArray(data.metrics) ? data.metrics : []); const programmatic = data.programmatic; placementBoundary.textContent = `${data.boundary || 'Only approved canonical placement inventory is shown.'} ${programmatic?.boundary || ''}`.trim(); }
    catch (error) { clear(placementList); const row = element('tr'); const cell = element('td', error instanceof Error ? error.message : 'Placement inventory is unavailable.'); cell.colSpan = 5; cell.className = 'admin-empty-state'; row.append(cell); placementList.append(row); placementBoundary.textContent = 'Placement evidence is unavailable.'; }
  }
  async function refresh() { await Promise.all([loadMetrics(), loadCampaigns(), loadPlacements()]); }
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const data = new FormData(form);
    const targetCategories = Array.from(categorySelect.selectedOptions).map((option) => option.value);
    const targetCountries = Array.from(countrySelect.selectedOptions).map((option) => option.value);
    const payload = { title: String(data.get('title') || ''), desc: String(data.get('desc') || ''), imageUrl: '', targetKeyword: String(data.get('targetKeyword') || ''), targetCategories, targetCountries, placementIds: selectedPlacementIds(), creditsBudget: Number(data.get('creditsBudget') || 0), placementSource: String(data.get('placementSource') || 'external_inventory'), disclosure: String(data.get('disclosure') || '') };
    status.textContent = 'Creating campaign…';
    try { await request('/marketing/campaigns', { method: 'POST', body: JSON.stringify(payload) }); form.reset(); categorySelect.selectedIndex = -1; countrySelect.selectedIndex = -1; status.textContent = 'Campaign created with canonical inventory assignment. It remains disclosed advertising, not provider or commercial-outcome evidence.'; await refresh(); }
    catch (error) { status.textContent = error instanceof Error ? error.message : 'Unable to create campaign.'; }
  });
  byId('campaign-refresh').addEventListener('click', () => { void refresh(); });
  const hasAdminSession = ['kurukoo_admin', 'kurukoo_admin_token'].some((key) => Boolean(window.localStorage.getItem(key)));
  if (!hasAdminSession) {
    byId('marketing-boundary').textContent = 'Sign in as an administrator to view or manage canonical campaign records.';
    placementBoundary.textContent = 'Sign in as an administrator to view placement inventory and aggregate evidence.';
    byId('mkt-grid').replaceChildren(metricsCard('Sign in required', 'Marketing evidence', 'Campaign metrics and controls are protected platform data.'));
    [campaignList, placementList].forEach((list, index) => { clear(list); const row = element('tr'); const cell = element('td', 'Sign in as an administrator to view protected marketing controls.'); cell.colSpan = index ? 5 : 6; cell.className = 'admin-empty-state'; row.append(cell); list.append(row); });
    form.querySelectorAll('input, textarea, select, button').forEach((control) => { control.disabled = true; });
  } else void refresh();
})();
