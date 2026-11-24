import { useEffect, useState } from 'react';

export function OfflineAppStatus() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const workers = navigator.serviceWorker;
    if (!workers) return;
    const scriptURL = new URL(`${import.meta.env.BASE_URL}inkio-offline-sw.js`, location.origin).href;
    const update = () => setReady(workers.controller?.scriptURL === scriptURL);
    workers.addEventListener('controllerchange', update);
    update();
    return () => workers.removeEventListener('controllerchange', update);
  }, []);

  return <p className="draft-note" aria-live="polite">{ready ? 'App ready to reopen offline.' : ''}</p>;
}
