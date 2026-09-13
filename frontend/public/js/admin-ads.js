(() => {
  const form = document.getElementById('ads-form');
  const formTitle = document.getElementById('ads-form-title');
  const submit = document.getElementById('ads-submit');
  const cancelEdit = document.getElementById('ads-cancel-edit');
  const tableBody = document.getElementById('ads-tbody');
  const status = document.getElementById('ads-status');
  const refresh = document.getElementById('ads-refresh');
  const idField = document.getElementById('ad-id');

  const fields = ['title', 'desc', 'imageUrl', 'targetKeyword', 'creditsBudget', 'disclosure', 'advertiserName', 'ctaText', 'destination', 'placement', 'category', 'country', 'region', 'targeting', 'status', 'assetStatus'];

  const setStatus = (message, tone = '') => {
    status.textContent = message;
    status.className = `admin-status ${tone}`.trim();
  };

  const cell = (value) => {
    const td = document.createElement('td');
    td.textContent = value == null || value === '' ? '—' : String(value);
    return td;
  };

  const formValue = (field) => document.getElementById(`ad-${field}`).value.trim();

  const campaignPayload = () => {
    const payload = Object.fromEntries(fields.map((field) => [field, formValue(field)]));
    payload.creditsBudget = Number(payload.creditsBudget);
    payload.frequencyCap = 3;
    payload.priority = 0;
    return payload;
  };

  const resetForm = () => {
    form.reset();
    idField.value = '';
    document.getElementById('ad-disclosure').value = 'Sponsored';
    document.getElementById('ad-ctaText').value = 'Learn more';
    document.getElementById('ad-destination').value = '/advertise';
    document.getElementById('ad-category').value = 'community';
    document.getElementById('ad-country').value = 'NG';
    document.getElementById('ad-status').value = 'active';
    document.getElementById('ad-assetStatus').value = 'pending';
    formTitle.textContent = 'Create campaign';
    submit.textContent = 'Create campaign';
    cancelEdit.hidden = true;
  };

  const fillForm = (campaign) => {
    idField.value = campaign.id;
    fields.forEach((field) => {
      const element = document.getElementById(`ad-${field}`);
      if (!element) return;
      const key = field;
      const snakeKey = field.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
      const value = campaign[key] ?? campaign[snakeKey] ?? '';
      element.value = value;
    });
    formTitle.textContent = `Update campaign #${campaign.id}`;
    submit.textContent = 'Save campaign';
    cancelEdit.hidden = false;
    form.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const updateCampaign = async (campaign, overrides = {}) => {
    const payload = {
      title: campaign.title,
      desc: campaign.desc,
      imageUrl: campaign.imageUrl || campaign.image_url || '',
      targetKeyword: campaign.targetKeyword || campaign.target_keyword || '',
      creditsBudget: Number(campaign.creditsBudget || campaign.credits_budget || 0),
      status: campaign.status,
      campaignType: campaign.campaignType || campaign.campaign_type,
      disclosure: campaign.disclosure,
      advertiserName: campaign.advertiserName || campaign.advertiser_name,
      ctaText: campaign.ctaText || campaign.cta_text,
      destination: campaign.destination,
      placement: campaign.placement,
      category: campaign.category,
      country: campaign.country,
      region: campaign.region,
      targeting: campaign.targeting,
      assetStatus: campaign.assetStatus || campaign.asset_status,
      ...overrides
    };
    const response = await fetch(`/api/admin/ads/${encodeURIComponent(campaign.id)}`, {
      method: 'PATCH',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || `Request failed (${response.status})`);
    return result.campaign;
  };

  const renderCampaigns = (campaigns) => {
    tableBody.replaceChildren();
    if (!Array.isArray(campaigns) || campaigns.length === 0) {
      const row = document.createElement('tr');
      const empty = document.createElement('td');
      empty.colSpan = 8;
      empty.textContent = 'No campaigns found.';
      row.appendChild(empty);
      tableBody.appendChild(row);
      return;
    }
    campaigns.forEach((campaign) => {
      const row = document.createElement('tr');
      const actions = document.createElement('td');
      const edit = document.createElement('button');
      edit.type = 'button';
      edit.className = 'btn secondary';
      edit.textContent = 'Edit';
      edit.addEventListener('click', () => fillForm(campaign));
      actions.appendChild(edit);
      if ((campaign.assetStatus || campaign.asset_status) === 'pending') {
        const approve = document.createElement('button');
        approve.type = 'button';
        approve.className = 'btn';
        approve.textContent = 'Approve';
        approve.addEventListener('click', async () => {
          approve.disabled = true;
          setStatus(`Approving campaign #${campaign.id}…`);
          try {
            await updateCampaign(campaign, { assetStatus: 'approved', status: 'active' });
            setStatus(`Campaign #${campaign.id} approved and active.`, 'is-success');
            await loadCampaigns();
          } catch (error) {
            setStatus(`Campaign #${campaign.id} was not approved: ${error.message}`, 'is-error');
            approve.disabled = false;
          }
        });
        actions.appendChild(approve);
      }
      row.append(
        cell(campaign.title),
        cell(campaign.advertiserName || campaign.advertiser_name || 'Kurukoo'),
        cell(campaign.placement),
        cell(campaign.status),
        cell(campaign.assetStatus || campaign.asset_status),
        cell(campaign.disclosure),
        cell(campaign.destination),
        actions
      );
      tableBody.appendChild(row);
    });
  };

  const loadCampaigns = async () => {
    setStatus('Loading campaigns…');
    try {
      const response = await fetch('/api/admin/ads', { credentials: 'same-origin' });
      if (!response.ok) throw new Error(`Request failed (${response.status})`);
      renderCampaigns(await response.json());
      setStatus('Campaigns loaded.', 'is-success');
    } catch (error) {
      renderCampaigns([]);
      setStatus(`Unable to load campaigns: ${error.message}`, 'is-error');
    }
  };

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const id = Number(idField.value);
    const payload = campaignPayload();
    setStatus(id ? 'Updating campaign…' : 'Creating campaign…');
    try {
      const response = await fetch(id ? `/api/admin/ads/${encodeURIComponent(id)}` : '/api/admin/ads', {
        method: id ? 'PATCH' : 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || `Request failed (${response.status})`);
      resetForm();
      setStatus(id ? 'Campaign updated.' : 'Campaign created. It remains subject to asset, timing, disclosure, and readiness rules.', 'is-success');
      await loadCampaigns();
    } catch (error) {
      setStatus(`Campaign was not saved: ${error.message}`, 'is-error');
    }
  });

  cancelEdit.addEventListener('click', resetForm);
  refresh.addEventListener('click', loadCampaigns);
  resetForm();
  loadCampaigns();
})();
