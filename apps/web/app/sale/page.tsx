'use client';

import { useEffect, useState } from 'react';
import { ArrowLeft, CheckCircle2, Minus, Plus } from 'lucide-react';

import { useData } from '../../lib/useData';
import { addSale, listProducts, ProductRow, SaleRow } from '../../lib/repo';
import { PAYMENT_METHODS, PaymentMethod } from '../../lib/config';
import { formatFcfa } from '../../lib/format';

export default function SalePage() {
  const version = useData();
  const [products, setProducts] = useState<ProductRow[]>([]);
  const [selected, setSelected] = useState<ProductRow | null>(null);
  const [qty, setQty] = useState(1);
  const [payment, setPayment] = useState<PaymentMethod>('cash');
  const [last, setLast] = useState<SaleRow | null>(null);

  useEffect(() => {
    let alive = true;
    void listProducts().then((p) => {
      if (alive) setProducts(p);
    });
    return () => {
      alive = false;
    };
  }, [version]);

  const total = (selected?.selling_price ?? 0) * qty;

  const confirm = async () => {
    if (!selected || total <= 0) return;
    const sale = await addSale(selected.id, qty, selected.selling_price, payment);
    if (sale) {
      setLast(sale);
      setSelected(null);
      setQty(1);
    }
  };

  if (!selected) {
    return (
      <>
        <div className="mb-5">
          <h1 className="text-2xl font-extrabold text-background">Vente rapide</h1>
          <p className="text-sm text-text-muted">
            Touchez un produit : la vente met à jour ventes, caisse et stock en un seul geste.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {products.map((p) => (
            <button
              key={p.id}
              type="button"
              className="kpi-card text-left transition hover:border-accent"
              onClick={() => setSelected(p)}
            >
              <strong className="block text-sm">{p.name}</strong>
              <div className="mt-1 font-heading text-lg font-bold text-success">{formatFcfa(p.selling_price)}</div>
              <div className="mt-1 text-xs text-text-muted">
                stock {p.quantity} · seuil {p.minimum_stock}
              </div>
            </button>
          ))}
        </div>
        {products.length === 0 && (
          <p className="text-sm text-text-muted">Aucun produit disponible — ajoute des produits depuis le web.</p>
        )}
        {last && (
          <div className="mt-4 flex items-center gap-2 rounded-field bg-success px-3 py-3 text-sm font-medium text-white">
            <CheckCircle2 size={18} />
            Vente enregistrée hors-ligne : {last.quantity} × {formatFcfa(last.unit_price)} = {formatFcfa(last.total_amount)} (
            {last.payment_method === 'cash' ? 'cash' : 'Mobile Money'})
          </div>
        )}
      </>
    );
  }

  return (
    <>
      <div className="mb-5 flex items-center justify-between">
        <h1 className="text-2xl font-extrabold text-background">Vente</h1>
        <button type="button" className="btn-secondary" onClick={() => setSelected(null)}>
          <ArrowLeft size={16} /> Autre produit
        </button>
      </div>

      <div className="mb-4">
        <h2 className="font-heading text-lg font-bold">{selected.name}</h2>
        <p className="text-sm text-text-muted">
          Stock : {selected.quantity} — une vente n&rsquo;est jamais bloquée pour un stock insuffisant.
        </p>
      </div>

      <div className="kpi-card">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="field-label">Quantité</p>
            <div className="flex items-center gap-3">
              <button
                type="button"
                className="flex h-10 w-10 items-center justify-center rounded-field border border-border text-primary"
                onClick={() => setQty(Math.max(1, qty - 1))}
              >
                <Minus size={18} />
              </button>
              <strong className="w-8 text-center text-lg">{qty}</strong>
              <button
                type="button"
                className="flex h-10 w-10 items-center justify-center rounded-field border border-border text-primary"
                onClick={() => setQty(qty + 1)}
              >
                <Plus size={18} />
              </button>
            </div>
          </div>
          <div>
            <p className="field-label">Paiement</p>
            <div className="inline-flex overflow-hidden rounded-field border border-border">
              {PAYMENT_METHODS.map((m) => (
                <button
                  key={m}
                  type="button"
                  className={`px-3 py-2 text-sm font-semibold ${payment === m ? 'bg-background text-white' : 'text-text-muted'}`}
                  onClick={() => setPayment(m)}
                >
                  {m === 'cash' ? 'Cash' : 'Mobile Money'}
                </button>
              ))}
            </div>
          </div>
        </div>

        <p className="field-label mt-5">Prix unitaire</p>
        <p className="font-heading text-lg font-bold">{formatFcfa(selected.selling_price)}</p>

        <p className="field-label mt-3">Total à encaisser</p>
        <p className="mb-4 font-heading text-3xl font-extrabold">{formatFcfa(total)}</p>

        <button type="button" className="btn-accent w-full" onClick={() => void confirm()} disabled={total <= 0}>
          Encaisser (hors-ligne)
        </button>
      </div>
    </>
  );
}
