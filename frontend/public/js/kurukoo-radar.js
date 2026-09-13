(() => {
  const list = document.getElementById('radar-list');
  const map = document.getElementById('radar-map');
  const refresh = document.querySelector('[data-radar-refresh]');
  const layerButtons = document.querySelectorAll('[data-layer]');
  const render = (label = 'Nearby activity') => {
    if (!list) return;
    const row = document.createElement('div'); row.className = 'k-row';
    const title = document.createElement('span'); title.textContent = label;
    const detail = document.createElement('span'); detail.className = 'k-muted'; detail.textContent = 'Live data appears here';
    row.append(title, detail); list.replaceChildren(row);
  };
  refresh?.addEventListener('click', async () => {
    render('Refreshing nearby activity…');
    if (!navigator.geolocation) return render('Location unavailable');
    navigator.geolocation.getCurrentPosition(
      () => render('Nearby activity refreshed'),
      () => render('Location permission is off — chat can still search by area'),
      {enableHighAccuracy:false, maximumAge:120000, timeout:5000}
    );
  });
  layerButtons.forEach(button => button.addEventListener('click', () => {
    layerButtons.forEach(b => b.setAttribute('aria-pressed', 'false'));
    button.setAttribute('aria-pressed', 'true');
    render(button.dataset.layer + ' layer selected');
  }));
  map?.setAttribute('role', 'img');
})();