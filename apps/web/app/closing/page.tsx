'use client';

import { useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle2 } from 'lucide-react';

import { useData } from '../../lib/useData';
import { addDailyClosing, getExpectedCashForDateLocal, getLastClosings, DailyClosingRow } from '../../lib/repo';
import { syncEngine } from '../../lib/sync';
import { fetchExpectedCash } from '../../lib/api';
import { formatDate, formatFcfa, localDateKey } from '../../lib/format';

export default function ClosingPage() {
  const version = useData();
  const [dateKey, setDateKey] = useState(localDateKey(new Date()));
  const [expected, setExpected] = useState(0);
  const [expectedSource, setExpectedSource] = useState<'server' | 'local'>('local');
  const [actual, setActual] = useState('');
  const [note, setNote] = useState('');
  const [history, setHistory] = useState<DailyClosingRow[]>([]);
  const [saved, setSaved] = useState<{ difference: number; actual: number } | null>(null);

  useEffect(() => {
    let alive = true;
    void (async () => {
      const hist = await getLastClosings(10);
      if (!alive) return;
      setHistory(hist);
      try {
        const server = await fetchExpectedCash(dateKey);
        if (!alive) return;
        setExpected(server.expected_cash);
        setExpectedSource('server');
      } catch {
        const local = await getExpectedCashForDateLocal(dateKey);
        if (!alive) return;
        setExpected(local);
        setExpectedSource('local');
      }
    })();
    return () => {
      alive = false;
    };
  }, [dateKey, version]);

  const actualNum = Math.round(Number(actual));
  const valid = actual.trim() !== '' && Number.isFinite(actualNum) && actualNum >= 0;
  const difference = valid ? actualNum - expected : 0;

  const submit = async () => {
    if (!valid) return;
    await addDailyClosing(dateKey, expected, actualNum, note.trim() || null);
    setSaved({ difference, actual: actualNum });
    setActual('');
    setNote('');
    // Push immédiat (best-effort) pour que le patron voie la clôture au plus vite.
    void syncEngine.syncNow();
  };

  return (
    <>
      <div className="mb-5">
        <h1 className="text-2xl font-extrabold text-background">Clôture de fin de journée</h1>
        <p className="text-sm text-text-muted">Caisse attendue (calculée) vs caisse réelle (comptée) → écart affiché.</p>
      </div>

      <div className="kpi-card">
        <label className="field-label" htmlFor="closing_date">
          Journée concernée
        </label>
        <input
          id="closing_date"
          type="date"
          className="field-input mb-4 max-w-[200px]"
          value={dateKey}
          onChange={(e) => setDateKey(e.target.value)}
        />

        <p className="field-label">Caisse attendue</p>
        <p className="mb-1 font-heading text-3xl font-extrabold">{formatFcfa(expected)}</p>
        <p className="mb-4 flex items-center gap-1.5 text-xs text-text-muted">
          {expectedSource === 'server' ? (
            <>
              <CheckCircle2 size={14} className="text-success" /> Calculée par le serveur à partir des mouvements du jour.
            </>
          ) : (
            <>
              <AlertTriangle size={14} className="text-warning" /> Hors-ligne : calcul local temporaire, à réconcilier à la sync.
            </>
          )}
        </p>

        <label className="field-label" htmlFor="actual_cash">
          Caisse réelle comptée (FCFA)
        </label>
        <input
          id="actual_cash"
          type="number"
          inputMode="numeric"
          min={0}
          className="field-input mb-4"
          value={actual}
          onChange={(e) => setActual(e.target.value)}
          placeholder="ex. 94000"
        />

        {valid && (
          <div
            className={`mb-4 rounded-field border px-3 py-3 ${
              difference === 0
                ? 'border-success/30 bg-success/5'
                : difference > 0
                  ? 'border-primary/30 bg-primary/5'
                  : 'border-danger/30 bg-danger/5'
            }`}
          >
            <p className="field-label">Écart</p>
            <p className="font-heading text-xl font-bold">
              {difference > 0 ? '+' : ''}
              {formatFcfa(difference)}
            </p>
            <p className="text-sm text-text-muted">
              {difference === 0 ? 'Caisse exacte.' : difference > 0 ? 'Excédent de caisse à expliquer.' : 'Manquant de caisse à expliquer.'}
            </p>
          </div>
        )}

        <label className="field-label" htmlFor="note">
          Motif de l&rsquo;écart (optionnel)
        </label>
        <input
          id="note"
          className="field-input mb-5"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="ex. 6000 payés au fournisseur non saisi"
        />

        <button type="button" className="btn-accent w-full" onClick={() => void submit()} disabled={!valid}>
          Valider la clôture (hors-ligne)
        </button>

        {saved && (
          <div className="mt-3 flex items-center gap-2 rounded-field bg-success px-3 py-3 text-sm font-medium text-white">
            <CheckCircle2 size={18} />
            Clôture enregistrée : comptée {formatFcfa(saved.actual)}, écart {saved.difference > 0 ? '+' : ''}
            {formatFcfa(saved.difference)}.
          </div>
        )}
      </div>

      <h2 className="mb-2 mt-6 font-heading text-base font-bold text-background">Historique des clôtures</h2>
      {history.length === 0 ? (
        <p className="text-sm text-text-muted">Aucune clôture enregistrée.</p>
      ) : (
        <div className="overflow-hidden rounded-card border border-border">
          <table className="w-full text-sm">
            <thead className="bg-[#FAFAFA] text-text-muted">
              <tr>
                <th className="px-3 py-2 text-left font-semibold">Jour</th>
                <th className="px-3 py-2 text-left font-semibold">Attendue</th>
                <th className="px-3 py-2 text-left font-semibold">Comptée</th>
                <th className="px-3 py-2 text-left font-semibold">Écart</th>
                <th className="px-3 py-2 text-left font-semibold">Motif</th>
              </tr>
            </thead>
            <tbody>
              {history.map((c) => (
                <tr key={c.id} className="border-t border-border">
                  <td className="px-3 py-2">{formatDate(c.closing_date)}</td>
                  <td className="px-3 py-2">{formatFcfa(c.expected_cash)}</td>
                  <td className="px-3 py-2">{formatFcfa(c.actual_cash)}</td>
                  <td className={`px-3 py-2 font-semibold ${c.difference === 0 ? '' : c.difference > 0 ? 'text-primary' : 'text-danger'}`}>
                    {c.difference > 0 ? '+' : ''}
                    {formatFcfa(c.difference)}
                  </td>
                  <td className="px-3 py-2">{c.note ?? ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
