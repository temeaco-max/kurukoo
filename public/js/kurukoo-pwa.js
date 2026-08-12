if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').then(registration => {
      console.log('Kurukoo PWA ServiceWorker registered');
    }).catch(err => {
      console.log('Kurukoo PWA ServiceWorker registration failed: ', err);
    });
  });
}
