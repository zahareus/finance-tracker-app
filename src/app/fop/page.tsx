'use client';

import React, { useMemo, useState } from 'react';
import { useSheetData } from '@/hooks/useSheetData';
import { FOP_ACCOUNTS, FOP_FEE_CAT, TAX_RATE, isTaxBase } from '@/lib/tx';

interface Tx { id?: string | null; date: string | null; amount: number; type: string; account: string; category: string; description: string; link?: string | null; noTax?: boolean; }

const formatNumber = (n: number) => n.toLocaleString('uk-UA', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const monthKey = (date: string | null): string | null => {
    if (!date) return null;
    let p = date.split('-'); if (p.length === 3) return `${p[0]}-${p[1]}`;           // YYYY-MM-DD
    p = date.split('.'); if (p.length === 3) return `${p[2]}-${p[1].padStart(2, '0')}`; // DD.MM.YYYY
    return null;
};
const monthLabel = (key: string) => { const [y, m] = key.split('-'); return new Date(Date.UTC(+y, +m - 1, 1)).toLocaleString('uk-UA', { month: 'long', year: 'numeric', timeZone: 'UTC' }); };

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
            const mk = monthKey(tx.date); if (!mk) return;
            const k = `${mk}|${tx.account}`;
            const cell = cells.get(k) || { base: [], paid: [] };
            if (isTaxBase(tx)) cell.base.push(tx);
            if (tx.type === 'Витрата' && tx.category === FOP_FEE_CAT) cell.paid.push(tx);
            cells.set(k, cell);
        });
        return Array.from(cells.entries())
            .map(([k, c]) => { const [month, account] = k.split('|'); const base = c.base.reduce((s, t) => s + t.amount, 0); const paid = c.paid.reduce((s, t) => s + t.amount, 0); return { key: k, month, account, base, expected: Math.round(base * TAX_RATE * 100) / 100, paid, baseRows: c.base, paidRows: c.paid }; })
            .filter(r => r.base > 0 || r.paid > 0)
            .sort((a, b) => b.month.localeCompare(a.month) || FOP_ACCOUNTS.indexOf(a.account) - FOP_ACCOUNTS.indexOf(b.account));
    }, [data]);

    if (isLoading) return <p className="text-center">Завантаження...</p>;
    if (error) return <p className="text-red-600 text-center">Помилка завантаження: {error}</p>;

    return (
        <div>
            <h1 className="text-2xl font-bold mb-1">Обслуговування ФОП — звірка 11%</h1>
            <p className="text-sm text-gray-600 mb-4 max-w-3xl">База — усе, що зайшло на ФОП-рахунок за місяць без позначки «Без 11%», крім «Гранти через посередника». Очікуване — 11% від бази. Сплачене — рядки категорії «Обслуговування ФОП» за той самий місяць. Клікни рядок, щоб побачити, з чого склалась база.</p>
            <div className="overflow-x-auto border rounded bg-white shadow">
                <table className="min-w-full divide-y divide-gray-200 text-sm">
                    <thead className="bg-gray-50 text-xs uppercase tracking-wider text-gray-500">
                        <tr><th className="px-4 py-2 text-left">Місяць</th><th className="px-4 py-2 text-left">Рахунок</th><th className="px-4 py-2 text-right">База</th><th className="px-4 py-2 text-right">Очікувано 11%</th><th className="px-4 py-2 text-right">Сплачено</th><th className="px-4 py-2 text-right">Різниця</th></tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                        {rows.length === 0 && <tr><td colSpan={6} className="px-4 py-4 text-center text-gray-500">Немає даних</td></tr>}
                        {rows.map(r => {
                            const diff = r.paid - r.expected;
                            const cur = monthKey(new Date().toISOString().slice(0, 10)) === r.month;
                            const tone = Math.abs(diff) < 1 ? 'text-green-700' : cur ? 'text-gray-400' : diff < 0 ? 'text-red-700 font-medium' : 'text-amber-700';
                            const open = openKey === r.key;
                            return (
                                <React.Fragment key={r.key}>
                                    <tr className="hover:bg-gray-50 cursor-pointer" onClick={() => setOpenKey(open ? null : r.key)}>
                                        <td className="px-4 py-2 whitespace-nowrap">{monthLabel(r.month)}</td>
                                        <td className="px-4 py-2 whitespace-nowrap font-medium">{r.account}</td>
                                        <td className="px-4 py-2 text-right whitespace-nowrap">{formatNumber(r.base)}</td>
                                        <td className="px-4 py-2 text-right whitespace-nowrap">{formatNumber(r.expected)}</td>
                                        <td className="px-4 py-2 text-right whitespace-nowrap">{formatNumber(r.paid)}</td>
                                        <td className={`px-4 py-2 text-right whitespace-nowrap ${tone}`}>{diff > 0 ? '+' : ''}{formatNumber(diff)}{cur && r.paid === 0 ? ' (поточний місяць)' : ''}</td>
                                    </tr>
                                    {open && (
                                        <tr className="bg-gray-50"><td colSpan={6} className="px-6 py-3">
                                            <div className="text-xs text-gray-500 uppercase tracking-wider mb-1">У базі</div>
                                            <ul className="text-xs space-y-0.5 mb-2">{r.baseRows.map(t => <li key={t.id || t.date}><span className="font-mono text-gray-400">{t.id}</span> {t.date} · {t.category} · <strong>{formatNumber(t.amount)}</strong> · {t.description}</li>)}</ul>
                                            <div className="text-xs text-gray-500 uppercase tracking-wider mb-1">Сплачено</div>
                                            <ul className="text-xs space-y-0.5">{r.paidRows.length === 0 ? <li className="text-gray-400">рядків «Обслуговування ФОП» за цей місяць нема</li> : r.paidRows.map(t => <li key={t.id || t.date}><span className="font-mono text-gray-400">{t.id}</span> {t.date} · <strong>{formatNumber(t.amount)}</strong> · {t.description}</li>)}</ul>
                                        </td></tr>
                                    )}
                                </React.Fragment>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default FopPage;
