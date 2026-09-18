'use client';

import { useEffect, useState } from 'react';

import { initStore, syncProductsFromServer } from './repo';
import { syncEngine } from './sync';
import { getSession } from './session';

// Initialise le store local + démarre la synchro, puis renvoie un compteur qui
// s'incrémente à chaque changement de données (sync, capture sur une autre
// page…). Les écrans relisent leurs données à chaque changement de version.
export function useData(): number {
  const [version, setVersion] = useState(0);

  useEffect(() => {
    let alive = true;
    void (async () => {
      await initStore();
      if (!alive) return;
      setVersion((v) => v + 1);
      if (getSession()) {
        void syncProductsFromServer().then(() => alive && setVersion((v) => v + 1));
        syncEngine.start();
      }
    })();
    const offData = syncEngine.onDataChanged(() => {
      if (alive) setVersion((v) => v + 1);
    });
    return () => {
      alive = false;
      offData();
    };
  }, []);

  return version;
}