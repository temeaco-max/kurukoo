(() => {
  'use strict';
  const root = document.querySelector('[data-topics-page]');
  if (!root) return;

  let taxonomy = { types: [], categories: [], skillsByCategory: {} };

  const byId = (id) => document.getElementById(id);
  const node = (tag, className, text) => { const item = document.createElement(tag); if (className) item.className = className; if (text != null) item.textContent = String(text); return item; };
  const pretty = (value) => String(value || '').replace(/_/g, ' ').replace(/-/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
  const date = (value) => { const parsed = new Date(value); return Number.isNaN(parsed.getTime()) ? '' : parsed.toLocaleDateString(undefined, { year:'numeric', month:'short', day:'numeric' }); };
  const excerpt = (value, maximum = 250) => value.length > maximum ? `${value.slice(0, maximum).trimEnd()}…` : value;
  const escapePrompt = (value) => String(value || '').replace(/[\r\n]+/g, ' ').slice(0, 600);

  function option(select, value, label) { const item = document.createElement('option'); item.value = value; item.textContent = label; select.append(item); }
  async function populateSelects() {
    try { taxonomy = await api('/api/topics/taxonomy'); } catch { taxonomy = { types: [], categories: [], skillsByCategory: {} }; }
    const categoryFilters = byId('topics-category'); const categoryCreate = byId('topics-create-category'); const typeFilter = byId('topics-type'); const typeCreate = byId('topics-create-type');
    if (categoryFilters) taxonomy.categories.forEach((value) => option(categoryFilters, value, pretty(value)));
    if (categoryCreate) taxonomy.categories.forEach((value) => option(categoryCreate, value, pretty(value)));
    if (typeFilter) taxonomy.types.forEach((value) => option(typeFilter, value, pretty(value)));
    if (typeCreate) taxonomy.types.forEach((value) => option(typeCreate, value, pretty(value)));
  }

  function renderSkills() {
    const category = byId('topics-create-category'); const skills = byId('topics-create-skills'); if (!category || !skills) return;
    skills.replaceChildren(); const values = taxonomy.skillsByCategory[category.value] || [];
    if (!values.length) { option(skills, '', 'No linked skill available for this category'); skills.disabled = true; return; }
    skills.disabled = false; values.forEach((value) => option(skills, value, pretty(value)));
  }

  async function api(path, options = {}) {
    const response = await fetch(path, { headers: { 'Content-Type':'application/json', ...(options.headers || {}) }, ...options });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.error || 'The request could not be completed');
    return payload;
  }

  function renderTopicCard(topic) {
    const card = node('article', 'topic-card');
    const link = node('a'); link.href = `/topics/${encodeURIComponent(topic.slug)}`;
    const tags = node('div', 'topic-meta'); tags.append(node('span', 'topic-tag', pretty(topic.type)));
    if (topic.category) tags.append(node('span', null, pretty(topic.category)));
    if (topic.city) tags.append(node('span', null, topic.city));
    tags.append(node('span', null, `${topic.replyCount || 0} moderated ${topic.replyCount === 1 ? 'reply' : 'replies'}`));
    tags.append(node('span', null, date(topic.publishedAt || topic.createdAt)));
    link.append(tags, node('h3', null, topic.title), node('p', null, excerpt(topic.body)));
    card.append(link); return card;
  }

  async function loadIndex() {
    const list = byId('topics-list'); const summary = byId('topics-list-summary'); const category = byId('topics-category')?.value || ''; const type = byId('topics-type')?.value || '';
    if (!list || !summary) return; list.replaceChildren(node('div', 'topics-loading', 'Loading public Topics…'));
    const query = new URLSearchParams(); if (category) query.set('category', category); if (type) query.set('type', type);
    try {
      const { topics } = await api(`/api/topics${query.toString() ? `?${query}` : ''}`); list.replaceChildren();
      if (!topics.length) list.append(node('div', 'topics-empty', 'No public Topics match this view yet. This is intentionally quiet: Kurukoo does not fabricate community activity.'));
      else topics.forEach((topic) => list.append(renderTopicCard(topic)));
      summary.textContent = `${topics.length} public ${topics.length === 1 ? 'Topic' : 'Topics'} shown`;
    } catch (error) { list.replaceChildren(node('div', 'topics-empty', 'Public Topics are unavailable right now. Please try again.')); summary.textContent = error instanceof Error ? error.message : 'Unable to load Topics'; }
  }

  async function setupComposer() {
    const form = byId('topics-create-form'); const compose = byId('create-topic'); if (!form || !compose) return;
    try { await api('/api/auth/me'); compose.hidden = false; } catch { return; }
    byId('topics-create-category')?.addEventListener('change', renderSkills); renderSkills();
    form.addEventListener('submit', async (event) => {
      event.preventDefault(); const status = byId('topics-create-status'); const submit = form.querySelector('button[type="submit"]');
      const data = new FormData(form); const selectedSkills = [...byId('topics-create-skills').selectedOptions].map((item) => item.value).filter(Boolean);
      if (selectedSkills.length > 3) { status.textContent = 'Choose no more than three existing skills.'; return; }
      const message = 'Submit this text for moderator review? Kurukoo will not publish your chat content automatically, and this Topic does not verify any provider, price, or availability.';
      if (!window.confirm(message)) return;
      status.textContent = 'Submitting for review…'; submit.disabled = true;
      try {
        const { topic } = await api('/api/topics', { method:'POST', headers: { 'Idempotency-Key': crypto.randomUUID().replace(/-/g, '') }, body: JSON.stringify({ title:data.get('title'), body:data.get('body'), type:data.get('type'), category:data.get('category'), skills:selectedSkills, city:data.get('city'), lga:data.get('lga') }) });
        form.reset(); renderSkills(); status.textContent = `Submitted for review. Your Topic is private until it is made public.`; form.dataset.topicId = topic.id;
      } catch (error) { status.textContent = error instanceof Error ? error.message : 'Unable to submit Topic'; } finally { submit.disabled = false; }
    });
  }

  function reportButton(topic) {
    const button = node('button', 'btn btn-ghost', 'Report'); button.type = 'button';
    button.addEventListener('click', async () => {
      const reason = window.prompt('Briefly state why this Topic needs review (for example, safety, privacy, impersonation, or misinformation).'); if (!reason) return;
      try { await api(`/api/topics/${encodeURIComponent(topic.id)}/report`, { method:'POST', body:JSON.stringify({ reason }) }); button.textContent = 'Reported for review'; button.disabled = true; }
      catch (error) { window.alert(error instanceof Error ? error.message : 'Unable to submit report'); }
    }); return button;
  }

  async function relationshipControls(topic) {
    try { await api('/api/auth/me'); } catch { return null; }
    const group = node('span', 'topic-relationship-actions');
    const follow = node('button', 'btn btn-ghost', 'Follow'); follow.type = 'button';
    const mute = node('button', 'btn btn-ghost', 'Mute updates'); mute.type = 'button'; mute.hidden = true;
    let relationship = null;
    try { relationship = (await api(`/api/relationships/topic/${encodeURIComponent(topic.id)}`)).relationship; } catch (error) { console.warn('Relationship state unavailable', error); }
    const render = () => {
      const following = Boolean(relationship);
      const muted = relationship?.notificationPreference === 'muted';
      follow.textContent = following ? 'Unfollow' : 'Follow';
      mute.hidden = !following;
      mute.textContent = muted ? 'Unmute updates' : 'Mute updates';
      mute.setAttribute('aria-pressed', muted ? 'true' : 'false');
    };
    follow.addEventListener('click', async () => {
      follow.disabled = true; mute.disabled = true;
      try {
        if (relationship) {
          await api(`/api/relationships/topic/${encodeURIComponent(topic.id)}`, { method:'DELETE' }); relationship = null;
        } else {
          relationship = (await api('/api/relationships', { method:'POST', body:JSON.stringify({ targetType:'topic', targetId:topic.id, relationshipType:'follow' }) })).relationship;
        }
        render();
      } catch (error) { window.alert(error instanceof Error ? error.message : 'Unable to update follow status'); }
      finally { follow.disabled = false; mute.disabled = false; }
    });
    mute.addEventListener('click', async () => {
      if (!relationship) return;
      follow.disabled = true; mute.disabled = true;
      try {
        const nextPreference = relationship.notificationPreference === 'muted' ? 'all' : 'muted';
        relationship = (await api(`/api/relationships/topic/${encodeURIComponent(topic.id)}/preferences`, { method:'PATCH', body:JSON.stringify({ relationshipType:'follow', notificationPreference:nextPreference }) })).relationship;
        render();
      } catch (error) { window.alert(error instanceof Error ? error.message : 'Unable to update notification preference'); }
      finally { follow.disabled = false; mute.disabled = false; }
    });
    render(); group.append(follow, mute); return group;
  }

  async function loadDetail() {
    const slug = root.dataset.topicSlug; const detail = byId('topic-detail'); if (!slug || !detail) return;
    try {
      const { topic } = await api(`/api/topics/${encodeURIComponent(slug)}`); detail.replaceChildren(); byId('topic-breadcrumb-title').textContent = topic.title;
      const meta = node('div', 'topic-meta'); meta.append(node('span', 'topic-tag', pretty(topic.type))); if (topic.category) meta.append(node('span', null, pretty(topic.category))); if (topic.city) meta.append(node('span', null, topic.city)); meta.append(node('span', null, `Published ${date(topic.publishedAt || topic.createdAt)}`));
      const actionRow = node('div', 'topic-detail-actions'); const chat = node('a', 'btn btn-primary', 'Discuss with Kurukoo'); chat.href = `/chat?topic=${encodeURIComponent(topic.slug)}`; actionRow.append(chat); const controls = await relationshipControls(topic); if (controls) actionRow.append(controls); actionRow.append(reportButton(topic));
      detail.append(meta, node('h1', null, topic.title), node('p', 'topic-detail-body', topic.body), actionRow);
      if (Array.isArray(topic.relatedResources) && topic.relatedResources.length) {
        const resources = node('section', 'topic-related-resources'); resources.append(node('h2', null, 'Related Kurukoo resources'));
        const list = node('ul'); topic.relatedResources.forEach((resource) => { const item = node('li'); const link = node('a', null, resource.title); link.href = `/resources/${encodeURIComponent(resource.slug)}`; item.append(link); list.append(item); });
        resources.append(node('p', 'topic-resource-disclosure', 'These editorial guides are linked by a Kurukoo moderator. They do not verify the Topic statement.'), list); detail.append(resources);
      }
      renderReplies(topic);
    } catch (error) { detail.replaceChildren(node('div', 'topics-empty', error instanceof Error ? error.message : 'This Topic is unavailable.')); }
  }

  async function renderReplies(topic) {
    const section = byId('topic-replies'); const list = byId('topic-replies-list'); const form = byId('topic-reply-form'); if (!section || !list || !form) return; section.hidden = false; list.replaceChildren();
    if (!topic.replies.length) list.append(node('div', 'topics-empty', 'No moderated replies yet. Kurukoo does not fabricate community activity.'));
    else topic.replies.forEach((reply) => { const item = node('article', 'topic-reply'); item.append(node('div', 'topic-meta', `Community member · ${date(reply.createdAt)}`), node('p', null, reply.body)); list.append(item); });
    try { await api('/api/auth/me'); form.hidden = false; } catch { return; }
    form.addEventListener('submit', async (event) => { event.preventDefault(); const status = byId('topic-reply-status'); const button = form.querySelector('button[type="submit"]'); const data = new FormData(form); if (!window.confirm('Submit this reply for review? Replies are not published automatically.')) return; status.textContent = 'Submitting for review…'; button.disabled = true; try { await api(`/api/topics/${encodeURIComponent(topic.id)}/replies`, { method:'POST', body:JSON.stringify({ body:data.get('body') }) }); form.reset(); status.textContent = 'Reply submitted for review.'; } catch (error) { status.textContent = error instanceof Error ? error.message : 'Unable to submit reply'; } finally { button.disabled = false; } });
  }

  async function initialize() {
    await populateSelects();
    if (root.dataset.topicsPage === 'index') { byId('topics-category')?.addEventListener('change', loadIndex); byId('topics-type')?.addEventListener('change', loadIndex); byId('topics-clear-filters')?.addEventListener('click', () => { byId('topics-category').value = ''; byId('topics-type').value = ''; loadIndex(); }); loadIndex(); setupComposer(); }
    if (root.dataset.topicsPage === 'detail') loadDetail();
  }
  void initialize();
})();
