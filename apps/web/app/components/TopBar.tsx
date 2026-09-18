'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { CheckCircle2, LogOut, Menu, RefreshCw, TriangleAlert } from 'lucide-react';

import { syncEngine, SyncState } from '../../lib/sync';
import { formatTime } from '../../lib/format';
import { clearSession, Session } from '../../lib/session';
import Logo from './Logo';

function SyncStatus() {
  const [state, setState] = useState<SyncState>(syncEngine.state);

  useEffect(() => {
    const off = syncEngine.onSync(setState);
    return off;
  }, []);

  if (state.phase === 'ok') {
    return (
      <span className="hidden items-center gap-1.5 text-xs text-success sm:flex">
        <CheckCircle2 size={16} strokeWidth={2} />
        Sync {formatTime(state.lastSyncAt)} · {state.pushed} envoyé / {state.pulled} reçu
      </span>
    );
  }
  if (state.phase === 'error') {
    return (
      <span className="flex items-center gap-1.5 text-xs text-danger" title={state.message}>
        <TriangleAlert size={16} strokeWidth={2} />
        <span className="hidden sm:inline">{state.message}</span>
      </span>
    );
  }
  if (state.phase === 'syncing') {
    return (
      <span className="hidden items-center gap-1.5 text-xs text-text-muted sm:flex">
        <RefreshCw size={16} strokeWidth={2} className="animate-spin" />
        Synchronisation…
      </span>
    );
  }
  return null;
}

export default function TopBar({
  onOpenMenu,
  session,
}: {
  onOpenMenu: () => void;
  session: Session | null;
}) {
  const router = useRouter();

  return (
    <header className="sticky top-0 z-30 mb-4 -mx-4 flex items-center justify-between gap-2 border-b border-border bg-[#F7F7F8]/95 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6">
      <button
        type="button"
        onClick={onOpenMenu}
        className="flex items-center gap-2.5 rounded-field py-1.5 pl-1 pr-3 text-left transition hover:bg-[#F3F4F6]"
        title="Ouvrir le menu"
      >
        <Menu size={22} strokeWidth={2} className="text-background" />
        <Logo variant="icon" className="h-7 w-7 rounded-md" />
        <span className="font-heading text-base font-extrabold text-background">BizFlow</span>
      </button>

      <div className="flex min-w-0 items-center gap-2 sm:gap-3">
        <SyncStatus />
        <button
          type="button"
          className="btn-secondary !px-3 !py-2"
          onClick={() => void syncEngine.syncNow()}
          title="Synchroniser maintenant"
        >
          <RefreshCw size={16} />
        </button>
        {session && (
          <button
            type="button"
            className="flex items-center gap-1.5 text-xs font-semibold text-text-muted hover:text-danger"
            onClick={() => {
              clearSession();
              router.replace('/login');
            }}
            title={`Déconnecter ${session.full_name}`}
          >
            <LogOut size={16} />
          </button>
        )}
      </div>
    </header>
  );
}
