(() => {
  const mapElement = document.getElementById('discover-map');
  const list = document.getElementById('discover-list');
  const status = document.getElementById('discover-status');
  const locationButton = document.getElementById('use-my-location');
  const communityContext = document.getElementById('discover-community-context');
  if (!mapElement || !list || !status || !locationButton || typeof L === 'undefined') return;

  const map = L.map('discover-map').setView([6.5244, 3.3792], 12);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; OpenStreetMap contributors',
  }).addTo(map);

  const activeLayers = { mobile: true, stationary: true };
  const layerGroups = {};
  const layerNames = { mobile: 'Mobile providers', stationary: 'Stationary providers' };
  let locationSelected = false;
  let refreshTimer = null;

  function setStatus(message, isError = false) {
    status.textContent = message;
    status.setAttribute('role', isError ? 'alert' : 'status');
  }

  function clearLayers() {
    Object.values(layerGroups).forEach((group) => map.removeLayer(group));
    Object.keys(layerGroups).forEach((key) => delete layerGroups[key]);
  }

  function formatDistance(metres) {
    const amount = Number(metres);
    if (!Number.isFinite(amount)) return '';
    return amount >= 1000 ? `${(amount / 1000).toFixed(1)} km away` : `${Math.round(amount)} m away`;
  }

  async function loadCommunityContext() {
    if (!communityContext) return;
    try {
      const response = await fetch('/api/discover/community-context?limit=6', { credentials: 'same-origin' });
      if (!response.ok) throw new Error('Community context unavailable');
      const data = await response.json(); const items = Array.isArray(data?.items) ? data.items : [];
      communityContext.replaceChildren();
      if (!items.length) { const empty = document.createElement('div'); empty.className = 'muted-info-text'; empty.textContent = 'No moderated shared Topics are available yet. Kurukoo does not fabricate community activity.'; communityContext.appendChild(empty); return; }
      items.forEach((item) => {
        const card = document.createElement('article'); card.className = 'topic-card';
        const link = document.createElement('a'); link.href = `/topics/${encodeURIComponent(item.slug)}`;
        const meta = document.createElement('div'); meta.className = 'topic-meta'; meta.textContent = `Community statement · ${String(item.type || '').replace(/_/g, ' ')}${item.category ? ` · ${String(item.category).replace(/-/g, ' ')}` : ''}${item.city ? ` · ${item.city}` : ''}`;
        const heading = document.createElement('h3'); heading.textContent = String(item.title || 'Shared Topic');
        const excerpt = document.createElement('p'); excerpt.textContent = String(item.excerpt || '');
        const chat = document.createElement('a'); chat.className = 'text-link'; chat.href = `/chat?topic=${encodeURIComponent(item.slug)}`; chat.textContent = 'Discuss with Kurukoo';
        link.append(meta, heading, excerpt); card.append(link, chat); communityContext.appendChild(card);
      });
    } catch {
      communityContext.replaceChildren(); const empty = document.createElement('div'); empty.className = 'muted-info-text'; empty.textContent = 'Shared community context is unavailable right now.'; communityContext.appendChild(empty);
    }
  }

  function addUnavailableNote(reason) {
    const note = document.createElement('p');
    note.className = 'unavailable-layer-note';
    note.textContent = reason;
    list.appendChild(note);
  }

  function render(data) {
    clearLayers();
    list.replaceChildren();
    const features = Array.isArray(data?.features) ? data.features : [];
    const unavailable = Object.values(data?.meta?.layers || {}).filter((layer) => layer && layer.available === false);
    unavailable.forEach((layer) => addUnavailableNote(`${layer.label}: ${layer.reason || 'Unavailable.'}`));

    if (!features.length && !unavailable.length) {
      const empty = document.createElement('div');
      empty.className = 'muted-info-text';
      empty.textContent = 'No verified providers are actively visible in this area yet.';
      list.appendChild(empty);
    }

    features.forEach((feature) => {
      const properties = feature?.properties || {};
      const coordinates = feature?.geometry?.type === 'Point' && Array.isArray(feature.geometry.coordinates) ? feature.geometry.coordinates : [];
      const lng = Number(coordinates[0]);
      const lat = Number(coordinates[1]);
      const layer = properties.layer === 'stationary' ? 'stationary' : 'mobile';
      if (!Number.isFinite(lat) || !Number.isFinite(lng) || activeLayers[layer] === false) return;

      const group = layerGroups[layer] || (layerGroups[layer] = L.layerGroup());
      const popup = document.createElement('div');
      const popupTitle = document.createElement('strong');
      popupTitle.textContent = String(properties.name || 'Verified provider');
      const popupDetail = document.createElement('div');
      popupDetail.textContent = String(properties.detail || 'Service provider');
      popup.append(popupTitle, popupDetail);
      L.circleMarker([lat, lng], {
        radius: 8,
        color: layer === 'mobile' ? '#25D366' : '#E67E22',
        fillColor: layer === 'mobile' ? '#25D366' : '#E67E22',
        fillOpacity: 0.8,
      }).bindPopup(popup).addTo(group);
      group.addTo(map);

      const item = document.createElement('div');
      item.className = 'discover-list-item-node';
      const indicator = document.createElement('span');
      indicator.className = `dot-indicator dot-indicator--${layer}`;
      const text = document.createElement('div');
      const title = document.createElement('div');
      title.className = 'item-title-bold';
      title.textContent = String(properties.name || 'Verified provider');
      const detail = document.createElement('div');
      detail.className = 'item-detail-muted';
      const distance = formatDistance(properties.distanceMetres);
      detail.textContent = [String(properties.detail || 'Service provider'), distance].filter(Boolean).join(' · ');
      text.append(title, detail);
      item.append(indicator, text);
      list.appendChild(item);
    });
  }

  async function loadDiscover() {
    if (!locationSelected) return;
    const center = map.getCenter();
    const layers = Object.keys(activeLayers).filter((key) => activeLayers[key]).join(',');
    setStatus('Loading approximate nearby presence…');
    try {
      const response = await fetch(`/api/discover/map?lat=${encodeURIComponent(center.lat)}&lng=${encodeURIComponent(center.lng)}&radius=10000&layers=${encodeURIComponent(layers)}`, { credentials: 'same-origin' });
      if (!response.ok) throw new Error('Discovery response was not successful');
      render(await response.json());
      setStatus('Showing approximate locations only. Exact provider coordinates are not displayed.');
    } catch (_error) {
      list.replaceChildren();
      const error = document.createElement('div');
      error.className = 'muted-info-text';
      error.textContent = 'Nearby map data could not be loaded. Please try again.';
      list.appendChild(error);
      setStatus('Nearby map data could not be loaded.', true);
    }
  }

  document.querySelectorAll('.layer-chip[data-layer]').forEach((chip) => {
    const layer = chip.dataset.layer;
    if (!layer || !(layer in activeLayers)) return;
    chip.addEventListener('click', () => {
      activeLayers[layer] = !activeLayers[layer];
      chip.classList.toggle('active', activeLayers[layer]);
      chip.setAttribute('aria-pressed', String(activeLayers[layer]));
      loadDiscover();
    });
  });

  locationButton.addEventListener('click', () => {
    if (!navigator.geolocation) {
      setStatus('This browser cannot provide a location. Nearby presence cannot be loaded without one.', true);
      return;
    }
    locationButton.disabled = true;
    setStatus('Requesting your location…');
    navigator.geolocation.getCurrentPosition(
      (position) => {
        locationSelected = true;
        map.setView([position.coords.latitude, position.coords.longitude], 13);
        locationButton.disabled = false;
        loadDiscover();
        if (refreshTimer) window.clearInterval(refreshTimer);
        refreshTimer = window.setInterval(loadDiscover, 30000);
      },
      () => {
        locationButton.disabled = false;
        setStatus('Location permission is needed to load nearby presence. No fallback location has been used.', true);
      },
      { enableHighAccuracy: false, maximumAge: 60_000, timeout: 10_000 },
    );
  });

  map.on('moveend', () => { if (locationSelected) loadDiscover(); });
  setStatus('Choose “Use my location” to view nearby verified providers.');
  void loadCommunityContext();
})();
