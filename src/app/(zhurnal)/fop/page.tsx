'use client';

import React, { useMemo, useState } from 'react';
import { useSheetData } from '@/hooks/useSheetData';
import { FOP_ACCOUNTS, FOP_FEE_CAT, TAX_RATE, isTaxBase, monthKey } from '@/lib/tx';
import { Button, Checkbox, SectionCard, StatTile } from '@/components/ui';
import { copyRowsToClipboard, useCopyToast } from '@/lib/copyRows';

interface Tx {
  id?: string | null;
  date: string | null;
  amount: number;
  type: string;
  account: string;
  category: string;
  description: string;
  link?: string | null;
  noTax?: boolean;
}

const formatNumber = (n: number) => n.toLocaleString('uk-UA', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const monthLabel = (key: string) => {
  const [y, m] = key.split('-');
  return new Date(Date.UTC(+y, +m - 1, 1)).toLocaleString('uk-UA', { month: 'long', year: 'numeric', timeZone: 'UTC' });
};
const monthLabelShort = (key: string) => {
  const [y, m] = key.split('-');
  const label = new Date(Date.UTC(+y, +m - 1, 1)).toLocaleString('uk-UA', { month: 'short', timeZone: 'UTC' }).replace('.', '');
  return `${label} ${y.slice(2)}`;
};
const formatDiff = (diff: number) => `${diff > 0 ? '+ ' : diff < 0 ? '− ' : ''}${formatNumber(Math.abs(diff))}`;

// Звірка 11% по ФОП-рахунках: база (усе, що зайшло без «Без 11%», крім «через посередника»),
// очікуване = база × 11%, сплачене = рядки «Обслуговування ФОП» у тому ж місяці. Рядки податку — ручні, застосунок лише порівнює.
const FopPage: React.FC = () => {
  const { data, isLoading, error } = useSheetData();
  const [openKey, setOpenKey] = useState<string | null>(null);

  const rows = useMemo(() => {
    const txs: Tx[] = Array.isArray(data?.transactions) ? data.transactions.filter((t: Tx) => t.date && t.account) : [];
    const cells = new Map<string, { base: Tx[]; paid: Tx[] }>();
    txs.forEach(tx => {
      if (!FOP_ACCOUNTS.includes(tx.account)) return;
      const mk = monthKey(tx.date);
      if (!mk) return;
      const k = `${mk}|${tx.account}`;
      const cell = cells.get(k) || { base: [], paid: [] };
      if (isTaxBase(tx)) cell.base.push(tx);
      if (tx.type === 'Витрата' && tx.category === FOP_FEE_CAT) cell.paid.push(tx);
      cells.set(k, cell);
    });
    return Array.from(cells.entries())
      .map(([k, c]) => {
        const [month, account] = k.split('|');
        const base = c.base.reduce((s, t) => s + t.amount, 0);
        const paid = c.paid.reduce((s, t) => s + t.amount, 0);
        return { key: k, month, account, base, expected: Math.round(base * TAX_RATE * 100) / 100, paid, baseRows: c.base, paidRows: c.paid };
      })
      .filter(r => r.base > 0 || r.paid > 0)
      .sort((a, b) => b.month.localeCompare(a.month) || FOP_ACCOUNTS.indexOf(a.account) - FOP_ACCOUNTS.indexOf(b.account));
  }, [data]);

  const currentMonthKey = monthKey(new Date().toISOString().slice(0, 10));
  const currentYear = new Date().getFullYear().toString();
  const summary = useMemo(() => {
    let underpaidPast = 0;
    let underpaidRows = 0;
    let currentExpected = 0;
    let paidCurrentYear = 0;
    rows.forEach(row => {
      const diff = row.paid - row.expected;
      if (row.month !== currentMonthKey && diff < 0 && Math.abs(diff) >= 1) {
        underpaidPast += Math.abs(diff);
        underpaidRows += 1;
      }
      if (row.month === currentMonthKey) currentExpected += row.expected;
      if (row.month.startsWith(currentYear)) paidCurrentYear += row.paid;
    });
    return { underpaidPast, underpaidRows, currentExpected, paidCurrentYear };
  }, [rows, currentMonthKey, currentYear]);

  const diffView = (row: { month: string; paid: number; expected: number }) => {
    const diff = row.paid - row.expected;
    // Число різниці — завжди; суфікс лише коли поточний місяць і ще нічого не сплачено
    const cur = row.month === currentMonthKey;
    const label = <>{formatDiff(diff)}{cur && row.paid === 0 && <span className="text-ink-2"> (поточний місяць)</span>}</>;
    // Порядок як у прод-версії: ≈0 → зелений; поточний місяць → сірий (ще не платили); недоплата → червоний; переплата → жовтий
    if (Math.abs(diff) < 1) return { label, className: 'text-income', cellClassName: '' };
    if (cur) return { label, className: 'text-ink-3', cellClassName: '' };
    if (diff < 0) return { label, className: 'text-tout font-semibold', cellClassName: 'bg-tout-soft' };
    return { label, className: 'text-expense', cellClassName: '' };
  };

  // Виділення рядків місяця і «Скопіювати (N)» — той самий хелпер, що на Балансі
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());
  const { toast: copiedToast, showToast, showError } = useCopyToast();
  const toggleSelected = (key: string) => setSelectedKeys(prev => { const next = new Set(prev); if (next.has(key)) next.delete(key); else next.add(key); return next; });
  const allSelected = rows.length > 0 && rows.every(row => selectedKeys.has(row.key));
  const toggleAllSelected = () => setSelectedKeys(prev => rows.every(row => prev.has(row.key)) ? new Set() : new Set(rows.map(row => row.key)));
  const handleCopy = async () => {
    const selected = rows.filter(row => selectedKeys.has(row.key));
    if (!selected.length) return;
    const header = ['Місяць', 'Рахунок', 'База', 'Очікувано 11%', 'Сплачено', 'Різниця'];
    const tsvRows = selected.map(row => [monthLabel(row.month), row.account, row.base, row.expected, row.paid, row.paid - row.expected]);
    const { ok } = await copyRowsToClipboard(header, tsvRows);
    if (ok) showToast(selected.length); else showError();
  };

  if (isLoading) return <p className="text-sm text-ink-2 text-center py-10">Завантаження...</p>;
  if (error) return <p className="text-danger text-sm text-center py-10">Помилка завантаження: {error}</p>;

  return (
    <div className="flex flex-col gap-4">
      {/* design-md: fintracker Журнал v1 */}
      <h1 className="hidden sm:block font-display text-lg font-semibold">Обслуговування ФОП — звірка 11%</h1>
      <h1 className="sm:hidden font-display text-[15px] font-semibold">Звірка 11%</h1>

      <div className="hidden sm:grid grid-cols-3 gap-3">
        <StatTile label="Недоплачено за минулі місяці" value={formatNumber(summary.underpaidPast)} tone="tout" suffix={<span className="text-[13px] text-ink-2 font-medium"> · {summary.underpaidRows} {summary.underpaidRows === 1 ? 'рядок' : 'рядків'}</span>} />
        <StatTile label="Очікувано за поточний місяць" value={formatNumber(summary.currentExpected)} />
        <StatTile label={`Сплачено у ${currentYear}`} value={formatNumber(summary.paidCurrentYear)} />
      </div>
      <div className="sm:hidden">
        <StatTile label="Недоплачено за минулі місяці" value={formatNumber(summary.underpaidPast)} tone="tout" suffix={<span className="text-xs text-ink-2 font-medium"> · {summary.underpaidRows} {summary.underpaidRows === 1 ? 'рядок' : 'рядків'}</span>} />
      </div>

      <SectionCard
        title="Звірка по місяцях"
        aside={
          <div className="flex flex-wrap items-center gap-2">
            <Button onClick={handleCopy} disabled={selectedKeys.size === 0} variant="primary" title="Скопіювати виділені рядки текстом, як у таблиці">Скопіювати ({selectedKeys.size})</Button>
            {copiedToast && <span className="text-income text-sm">{copiedToast}</span>}
          </div>
        }
      >
        <p className="hidden sm:block text-[13px] text-ink-2 max-w-[68ch] mb-3">
          База — усе, що зайшло на ФОП-рахунок за місяць без позначки «Без 11%», крім «Гранти через посередника». Очікуване — 11% від бази. Сплачене — рядки категорії «Обслуговування ФОП» за той самий місяць. Клікни рядок, щоб побачити, з чого склалась база.
        </p>
        <p className="sm:hidden text-xs text-ink-2 mb-2">База й очікуване — у розгортанні рядка</p>

        <div className="sm:hidden overflow-x-auto">
          <table className="w-full border-collapse text-[12.5px]">
            <thead>
              <tr>
                <th className="px-2.5 py-2 text-left border-b border-line w-8"><Checkbox checked={allSelected} onChange={toggleAllSelected} label="Виділити всі" /></th>
                <th className="px-2.5 py-2 text-left border-b border-line text-[11px] uppercase tracking-[.06em] text-ink-2 font-medium whitespace-nowrap">Місяць</th>
                <th className="px-2.5 py-2 text-left border-b border-line text-[11px] uppercase tracking-[.06em] text-ink-2 font-medium whitespace-nowrap">Рах.</th>
                <th className="px-2.5 py-2 text-right border-b border-line text-[11px] uppercase tracking-[.06em] text-ink-2 font-medium whitespace-nowrap">Сплачено</th>
                <th className="px-2.5 py-2 text-right border-b border-line text-[11px] uppercase tracking-[.06em] text-ink-2 font-medium whitespace-nowrap">Різниця</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && <tr><td colSpan={5} className="px-2.5 py-4 text-center text-ink-2">Немає даних</td></tr>}
              {rows.map(row => {
                const open = openKey === row.key;
                const diff = diffView(row);
                return (
                  <React.Fragment key={row.key}>
                    <tr className="cursor-pointer" onClick={() => setOpenKey(open ? null : row.key)}>
                      <td className="px-2.5 py-2.5 border-b border-line align-top" onClick={(e) => e.stopPropagation()}><Checkbox checked={selectedKeys.has(row.key)} onChange={() => toggleSelected(row.key)} label={`Виділити ${monthLabel(row.month)} · ${row.account}`} /></td>
                      <td className="px-2.5 py-2.5 border-b border-line align-top whitespace-nowrap">{monthLabelShort(row.month)}</td>
                      <td className="px-2.5 py-2.5 border-b border-line align-top whitespace-nowrap font-medium">{row.account}</td>
                      <td className="px-2.5 py-2.5 border-b border-line align-top text-right whitespace-nowrap tabular-nums">{row.paid === 0 ? <span className="text-ink-2">—</span> : formatNumber(row.paid)}</td>
                      <td className={`px-2.5 py-2.5 border-b border-line align-top text-right whitespace-nowrap tabular-nums ${diff.cellClassName}`}><span className={diff.className}>{diff.label}</span></td>
                    </tr>
                    {open && (
                      <tr>
                        <td colSpan={5} className="px-2.5 py-3 border-b border-line bg-mute">
                          <div className="text-xs text-ink-2 mb-1">База: <span className="text-ink font-semibold tabular-nums">{formatNumber(row.base)}</span> · очікуване: <span className="text-ink font-semibold tabular-nums">{formatNumber(row.expected)}</span></div>
                          <TxList title="У базі" rows={row.baseRows} empty="рядків бази нема" />
                          <TxList title="Сплачено" rows={row.paidRows} empty="рядків «Обслуговування ФОП» за цей місяць нема" />
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="hidden sm:block overflow-x-auto">
          <table className="w-full border-collapse text-[13.5px]">
            <thead>
              <tr>
                <th className="px-2.5 py-2 text-left border-b border-line w-8"><Checkbox checked={allSelected} onChange={toggleAllSelected} label="Виділити всі" /></th>
                <th className="px-2.5 py-2 text-left border-b border-line text-[11px] uppercase tracking-[.06em] text-ink-2 font-medium whitespace-nowrap">Місяць</th>
                <th className="px-2.5 py-2 text-left border-b border-line text-[11px] uppercase tracking-[.06em] text-ink-2 font-medium whitespace-nowrap">Рахунок</th>
                <th className="px-2.5 py-2 text-right border-b border-line text-[11px] uppercase tracking-[.06em] text-ink-2 font-medium whitespace-nowrap">База</th>
                <th className="px-2.5 py-2 text-right border-b border-line text-[11px] uppercase tracking-[.06em] text-ink-2 font-medium whitespace-nowrap">Очікувано 11%</th>
                <th className="px-2.5 py-2 text-right border-b border-line text-[11px] uppercase tracking-[.06em] text-ink-2 font-medium whitespace-nowrap">Сплачено</th>
                <th className="px-2.5 py-2 text-right border-b border-line text-[11px] uppercase tracking-[.06em] text-ink-2 font-medium whitespace-nowrap">Різниця</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && <tr><td colSpan={7} className="px-2.5 py-4 text-center text-ink-2">Немає даних</td></tr>}
              {rows.map(row => {
                const open = openKey === row.key;
                const diff = diffView(row);
                return (
                  <React.Fragment key={row.key}>
                    <tr className="cursor-pointer" onClick={() => setOpenKey(open ? null : row.key)}>
                      <td className="px-2.5 py-2.5 border-b border-line align-top" onClick={(e) => e.stopPropagation()}><Checkbox checked={selectedKeys.has(row.key)} onChange={() => toggleSelected(row.key)} label={`Виділити ${monthLabel(row.month)} · ${row.account}`} /></td>
                      <td className="px-2.5 py-2.5 border-b border-line align-top whitespace-nowrap">{monthLabel(row.month)}</td>
                      <td className="px-2.5 py-2.5 border-b border-line align-top whitespace-nowrap font-medium">{row.account}</td>
                      <td className="px-2.5 py-2.5 border-b border-line align-top text-right whitespace-nowrap tabular-nums">{formatNumber(row.base)}</td>
                      <td className="px-2.5 py-2.5 border-b border-line align-top text-right whitespace-nowrap tabular-nums">{formatNumber(row.expected)}</td>
                      <td className="px-2.5 py-2.5 border-b border-line align-top text-right whitespace-nowrap tabular-nums">{row.paid === 0 ? <span className="text-ink-2">—</span> : formatNumber(row.paid)}</td>
                      <td className={`px-2.5 py-2.5 border-b border-line align-top text-right whitespace-nowrap tabular-nums ${diff.cellClassName}`}><span className={diff.className}>{diff.label}</span></td>
                    </tr>
                    {open && (
                      <tr>
                        <td colSpan={7} className="px-6 py-3 border-b border-line bg-mute">
                          <TxList title="У базі" rows={row.baseRows} empty="рядків бази нема" />
                          <TxList title="Сплачено" rows={row.paidRows} empty="рядків «Обслуговування ФОП» за цей місяць нема" />
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </SectionCard>
    </div>
  );
};

const TxList = ({ title, rows, empty }: { title: string; rows: Tx[]; empty: string }) => (
  <div className="mb-2 last:mb-0">
    <div className="text-xs text-ink-2 uppercase tracking-[.06em] mb-1">{title}</div>
    <ul className="text-xs space-y-0.5">
      {rows.length === 0 ? <li className="text-ink-3">{empty}</li> : rows.map((tx, index) => (
        <li key={`${tx.id || ''}-${tx.date}-${index}`}>
          <span className="font-mono text-[11px] text-ink-3">{tx.id || 'без ID'}</span> {tx.date} · {tx.category} · <strong>{formatNumber(tx.amount)}</strong> · {tx.description}
        </li>
      ))}
    </ul>
  </div>
);

export default FopPage;
