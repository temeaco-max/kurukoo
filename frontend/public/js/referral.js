async function shareWithContacts() {
    try {
        const props = ['name', 'tel'];
        const opts = { multiple: true };
        
        // This requires HTTPS and supported browsers (Chrome for Android usually)
        if ('contacts' in navigator && 'ContactsManager' in window) {
            const contacts = await navigator.contacts.select(props, opts);
            if (contacts.length > 0) {
                const tracking = 'PROMO_' + Math.random().toString(36).substr(2, 6).toUpperCase();
                const text = encodeURIComponent(`I'm using Kurukoo to sort my everyday needs. Join using my code: ${tracking}`);
                
                // Open WA for the first contact as an example, since we can't deep-link a blast easily without enterprise WA APIs.
                // We'll award points based on the selection.
                
                fetch('/api/points/topup', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ phone: window.appPhone, amount: 10 * contacts.length })
                }).then(r => r.json()).then(data => {
                    alert(`Selected ${contacts.length} contacts! Earned ${10 * contacts.length} Points.`);
                    window.location.href = `https://wa.me/?text=${text}`;
                });
            }
        } else {
            alert('Contact Picker API is not supported on this device/browser.');
        }
    } catch (ex) {
        console.error('Contact picker error', ex);
    }
}
window.shareWithContacts = shareWithContacts;
