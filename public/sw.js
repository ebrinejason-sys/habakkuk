importScripts('https://storage.googleapis.com/workbox-cdn/releases/6.5.4/workbox-sw.js');

workbox.routing.registerRoute(
  ({ request }) => request.destination === 'document',
  new workbox.strategies.NetworkFirst()
);

workbox.routing.registerRoute(
  ({ url }) => url.pathname.startsWith('/api/'),
  new workbox.strategies.NetworkFirst()
);

self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-transactions') {
    event.waitUntil(syncTransactions());
  }
});

async function syncTransactions() {
  const db = await openDB('habakkuk-offline', 1);
  const transactions = await db.getAll('transactions');
  for (const tx of transactions) {
    if (!tx.synced) {
      try {
        const response = await fetch('/api/admin/pos/transaction', {
          method: 'POST',
          body: JSON.stringify(tx),
          headers: { 'Content-Type': 'application/json' },
        });
        if (response.ok) {
          await db.put('transactions', { ...tx, synced: true });
        }
      } catch (error) {
        console.error('Sync failed for transaction:', tx.id, error);
      }
    }
  }
}