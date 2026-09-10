'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Golos_Text, Unbounded } from 'next/font/google';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import './globals.css';
import { SheetDataProvider, useSheetData } from '@/hooks/useSheetData';
import { signedAmount, parseDate, RUNWAY_EXCLUDED_DEFAULT } from '@/lib/tx';
import { usePersistedState } from '@/hooks/usePersistedState';

// --- Типи даних ---
interface Transaction { date: string | null; amount: number; type: string; account: string; category: string; description: string; link?: string | null; noTax?: boolean; }
interface BalanceDetails { [account: string]: number; }

// --- Хелпери ---
const formatNumber = (num: number): string => {
    if (typeof num !== 'number' || isNaN(num)) { return '0,00'; }
    return num.toLocaleString('uk-UA', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

// design-md: fintracker Журнал v1 — шрифти як CSS-змінні; класи font-sans / font-display беруть їх із tailwind.config.ts
const golos = Golos_Text({ subsets: ['latin', 'cyrillic'], weight: ['400', '500', '600'], variable: '--font-golos' });
const unbounded = Unbounded({ subsets: ['latin', 'cyrillic'], weight: ['500', '700'], variable: '--font-unbounded' });

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <SheetDataProvider>
      <AppShell>{children}</AppShell>
    </SheetDataProvider>
  );
}

// Шапка + main; винесено, щоб мати доступ до контексту даних
function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { data, isLoading: headerIsLoading, error: headerError, refresh } = useSheetData();
  const [lastUpdatedAt, setLastUpdatedAt] = useState<Date | null>(null);

  useEffect(() => { document.title = 'Місцеві гроші: фінансова звітність'; }, []);
  useEffect(() => { if (data) setLastUpdatedAt(new Date()); }, [data]);

  // Налаштування ранвею: які витратні категорії НЕ входять у знаменник (зберігається в браузері)
  const [runwayExcluded, setRunwayExcluded] = usePersistedState<string[]>('finance-tracker-runway-excluded', RUNWAY_EXCLUDED_DEFAULT);
  const [runwayOpen, setRunwayOpen] = useState(false);
  const runwayRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!runwayOpen) return;
    const onDown = (e: MouseEvent) => { if (runwayRef.current && !runwayRef.current.contains(e.target as Node)) setRunwayOpen(false); };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [runwayOpen]);

  const headerAllTransactions: Transaction[] = useMemo(() => Array.isArray(data?.transactions) ? data.transactions : [], [data]);
  const headerAccounts: string[] = useMemo(() => Array.isArray(data?.accounts) ? data.accounts.flat().map(String).filter(Boolean) : [], [data]);

  // --- Розрахунок Показників для Хедера ---
  const headerMetrics = useMemo(() => {
        const now = new Date(); const today = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999)); // «сьогодні» за локальним календарем, межа в UTC як і дати транзакцій
        const currentBalanceDetails: BalanceDetails = {};
        if (!Array.isArray(headerAccounts)) return { currentTotalBalance: 0, runwayMonths: null, balanceTooltipText: "...", expenseCategories: [] as { category: string; sum: number; included: boolean }[], avgMonthlyExpense: 0, totalExpensesLast3Months: 0, includedExpenses: 0, monthsDivisor: 3 };
        headerAccounts.forEach(acc => currentBalanceDetails[acc] = 0);
        if (!Array.isArray(headerAllTransactions)) return { currentTotalBalance: 0, runwayMonths: null, balanceTooltipText: "...", expenseCategories: [] as { category: string; sum: number; included: boolean }[], avgMonthlyExpense: 0, totalExpensesLast3Months: 0, includedExpenses: 0, monthsDivisor: 3 };
        headerAllTransactions.forEach(tx => { const txDate = parseDate(tx.date); if (currentBalanceDetails.hasOwnProperty(tx.account) && txDate && txDate <= today) { const amount = typeof tx.amount === 'number' && !isNaN(tx.amount) ? tx.amount : 0; currentBalanceDetails[tx.account] += signedAmount({ ...tx, amount }); }});
        const currentTotalBalance = Object.values(currentBalanceDetails).reduce((sum, bal) => sum + (typeof bal === 'number' ? bal : 0), 0);
        // Межі в UTC, як і дати транзакцій: локальний конструктор у Києві (+3) зсував вікно і губив останній день місяця
        const threeMonthsAgo = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() - 3, 1));
        const lastMonthEnd = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 0, 23, 59, 59, 999));
        // Витрати за 3 повні місяці по категоріях — з них користувач вибирає, що входить у ранвей
        const expenseByCategory: { [category: string]: number } = {};
        const monthsWithData = new Set<string>();
        headerAllTransactions.forEach(tx => { const txDate = parseDate(tx.date); const amount = typeof tx.amount === 'number' ? tx.amount : 0; if (tx.type === 'Витрата' && txDate && txDate >= threeMonthsAgo && txDate <= lastMonthEnd) { expenseByCategory[tx.category] = (expenseByCategory[tx.category] || 0) + amount; monthsWithData.add(`${txDate.getUTCFullYear()}-${txDate.getUTCMonth()}`); } });
        const monthsDivisor = Math.max(1, Math.min(3, monthsWithData.size)); // менше трьох місяців даних — ділимо на скільки є
        const expenseCategories = Object.entries(expenseByCategory).map(([category, sum]) => ({ category, sum, included: !runwayExcluded.includes(category) })).sort((a, b) => b.sum - a.sum);
        const totalExpensesLast3Months = expenseCategories.reduce((acc, c) => acc + c.sum, 0);
        const includedExpenses = expenseCategories.filter(c => c.included).reduce((acc, c) => acc + c.sum, 0);
        const avgMonthlyExpense = includedExpenses > 0 ? includedExpenses / monthsDivisor : 0;
        let runwayMonths: number | null | typeof Infinity = null;
        if (avgMonthlyExpense > 0 && currentTotalBalance > 0) { runwayMonths = currentTotalBalance / avgMonthlyExpense; }
        else if (currentTotalBalance >= 0 && avgMonthlyExpense <= 0) { runwayMonths = Infinity; }
        const balanceTooltipText = headerAccounts.map(acc => `${acc}: ${formatNumber(currentBalanceDetails[acc] || 0)} ₴`).join('\n');
        return { currentTotalBalance, runwayMonths, balanceTooltipText, expenseCategories, avgMonthlyExpense, totalExpensesLast3Months, includedExpenses, monthsDivisor };
    }, [headerAllTransactions, headerAccounts, runwayExcluded]);

  const navItems = [
    { href: '/', label: 'Баланс', active: pathname === '/' || pathname === '/transactions' },
    { href: '/earn', label: 'Зароблено', active: pathname === '/earn' },
    { href: '/projects', label: 'Проекти', active: pathname === '/projects' },
    { href: '/fop', label: 'ФОП', active: pathname === '/fop' },
  ];
  const runwayValue = headerMetrics.runwayMonths === null ? 'N/A' : headerMetrics.runwayMonths === Infinity ? '∞' : headerMetrics.runwayMonths.toFixed(1).replace('.', ',');
  const runwaySuffix = runwayExcluded.length > 0 ? `міс · без ${runwayExcluded.length} ${runwayExcluded.length === 1 ? 'категорії' : 'категорій'}` : 'міс';
  const updatedLabel = lastUpdatedAt
    ? `Оновлено ${lastUpdatedAt.toLocaleTimeString('uk-UA', { hour: '2-digit', minute: '2-digit' })}`
    : 'Оновлено --:--';

  return (
    <html lang="uk">
      <head />
      <body className={`${golos.variable} ${unbounded.variable} font-sans bg-paper text-ink`}>
        <header className="sticky top-0 z-20 bg-paper">
          {/* design-md: fintracker Журнал v1 */}
          <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-12">
            <div className="flex items-center justify-between gap-4 pt-4 md:pt-5 pb-2">
              <Link href="/" className="font-display font-bold text-sm md:text-base whitespace-nowrap">
                Місцеві гроші
              </Link>
              <nav className="hidden md:flex items-center gap-1">
                {navItems.map(item => (
                  <Link key={item.href} href={item.href} className={`px-4 py-2 rounded-full text-[13px] font-medium ${item.active ? 'bg-ink text-white' : 'text-ink-2 hover:text-ink'}`}>
                    {item.label}
                  </Link>
                ))}
              </nav>
              <div className="flex items-center gap-[18px]">
                <button
                  type="button"
                  onClick={refresh}
                  className={`text-[13px] underline underline-offset-[3px] ${headerIsLoading && data ? 'text-ink-3 no-underline' : 'text-ink-2 hover:text-ink'}`}
                  title="Перечитати дані з Google Таблиці"
                >
                  {headerIsLoading && data ? 'Оновлюю...' : 'Оновити'}
                </button>
                <a href="https://docs.google.com/spreadsheets/d/1jl54qnar1R0nDdAIxJF6uN4eMPXacOfqasNAuwm8BNk/edit" target="_blank" rel="noopener noreferrer" className="text-[13px] text-ink-2 underline underline-offset-[3px] hover:text-ink whitespace-nowrap">
                  Джерело
                </a>
              </div>
            </div>
            <nav className="flex md:hidden items-center gap-1 pb-1 overflow-x-auto">
              {navItems.map(item => (
                <Link key={item.href} href={item.href} className={`px-3 py-[7px] rounded-full text-[13px] font-medium whitespace-nowrap ${item.active ? 'bg-ink text-white' : 'text-ink-2 hover:text-ink'}`}>
                  {item.label}
                </Link>
              ))}
            </nav>
            <div className="py-3 md:pt-[22px] md:pb-[26px] flex flex-col md:flex-row md:items-end md:justify-between gap-3">
              {headerError ? (
                <span className="text-danger text-sm" title={headerError}>Помилка завантаження даних</span>
              ) : headerIsLoading && !data ? (
                <span className="text-sm text-ink-2">Завантаження...</span>
              ) : (
                <div className="flex gap-6 md:gap-9 items-end flex-wrap">
                  <div title={headerMetrics.balanceTooltipText}>
                    <div className="text-[11px] uppercase tracking-[.08em] text-ink-2">Кошти</div>
                    <div className="font-display text-[22px] md:text-[30px] font-bold leading-[1.1] whitespace-nowrap">
                      {formatNumber(headerMetrics.currentTotalBalance).replace(',00', '')} <span className="text-[14px] md:text-[18px] font-medium text-ink-2">₴</span>
                    </div>
                  </div>
                  <div className="relative min-w-0" ref={runwayRef}>
                    <button type="button" onClick={() => setRunwayOpen(o => !o)} className="text-left" title="Налаштувати, які витрати входять у ранвей">
                      <div className="text-[11px] uppercase tracking-[.08em] text-ink-2">Ранвей</div>
                      <div className="font-display text-[22px] md:text-[30px] font-bold leading-[1.1] whitespace-nowrap">
                        {runwayValue} <span className="text-[13px] md:text-[18px] font-medium text-ink-2 whitespace-normal" title={runwayExcluded.length > 0 ? `Без: ${runwayExcluded.join(', ')}` : undefined}>{runwaySuffix}</span>
                      </div>
                    </button>
                    {runwayOpen && (
                      <div className="absolute left-0 md:right-0 md:left-auto top-full mt-2 z-30 w-[320px] max-w-[calc(100vw-32px)] bg-panel border border-line rounded-card p-3 text-left">
                        <div className="text-xs text-ink-2 mb-2">Ранвей = кошти / (обрані витрати за 3 повні місяці / 3). Зніми галочку, щоб виключити категорію.</div>
                        <ul className="max-h-72 overflow-y-auto divide-y divide-line">
                          {headerMetrics.expenseCategories.map(c => (
                            <li key={c.category} className="flex items-center gap-2 py-1 text-sm">
                              <input type="checkbox" id={`rw-${c.category}`} checked={c.included} onChange={() => setRunwayExcluded(prev => c.included ? [...prev, c.category] : prev.filter(x => x !== c.category))} className="h-4 w-4 rounded-[5px] border-[1.5px] border-line bg-panel accent-ink" />
                              <label htmlFor={`rw-${c.category}`} className={`flex-1 cursor-pointer ${c.included ? 'text-ink' : 'text-ink-3 line-through'}`}>{c.category}</label>
                              <span className={`text-xs tabular-nums ${c.included ? 'text-ink-2' : 'text-ink-3'}`}>{formatNumber(c.sum / headerMetrics.monthsDivisor)}/міс</span>
                            </li>
                          ))}
                        </ul>
                        <div className="mt-2 pt-2 border-t border-line text-xs text-ink-2 flex justify-between gap-3">
                          <span>У знаменнику: <strong>{formatNumber(headerMetrics.avgMonthlyExpense)}</strong>/міс</span>
                          <span className="text-ink-3">усього {formatNumber(headerMetrics.totalExpensesLast3Months / headerMetrics.monthsDivisor)}/міс</span>
                        </div>
                        {runwayExcluded.length > 0 && <button type="button" onClick={() => setRunwayExcluded([])} className="mt-2 text-xs text-ink-2 underline underline-offset-[3px] hover:text-ink">Включити все</button>}
                      </div>
                    )}
                  </div>
                </div>
              )}
              {!headerError && data && <span className="hidden md:inline text-xs text-ink-2">{updatedLabel}</span>}
            </div>
          </div>
        </header>
        <main className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-12 pb-10">
          {children}
        </main>
      </body>
    </html>
  );
}
