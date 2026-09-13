(() => {
  'use strict';
  if (document.body?.dataset.appSection !== 'discover') return;
  let started = false;
  const start = () => {
    if (started || !document.getElementById('discover-map')) return;
    started = true;
    const loadMap = () => {
      const script = document.createElement('script');
      script.src = '/js/kurukoo-discover-map.js?v=5';
      script.defer = true;
      document.head.appendChild(script);
    };
    if (window.L) return loadMap();
    const leaflet = document.createElement('script');
    leaflet.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
    leaflet.crossOrigin = '';
    leaflet.onload = loadMap;
    document.head.appendChild(leaflet);
  };
  const observer = new MutationObserver(start);
  observer.observe(document.body, { childList: true, subtree: true });
  start();
})();
