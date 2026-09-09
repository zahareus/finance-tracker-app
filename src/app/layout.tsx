'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Inter } from 'next/font/google';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import './globals.css';
import { SheetDataProvider, useSheetData } from '@/hooks/useSheetData';
import { signedAmount } from '@/lib/tx';
import { usePersistedState } from '@/hooks/usePersistedState';

// --- Типи даних ---
interface Transaction { date: string | null; amount: number; type: string; account: string; category: string; description: string; link?: string | null; noTax?: boolean; }
interface BalanceDetails { [account: string]: number; }

// --- Хелпери ---
const formatNumber = (num: number): string => {
    if (typeof num !== 'number' || isNaN(num)) { return '0,00'; }
    return num.toLocaleString('uk-UA', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};
const parseDate = (dateString: string | null): Date | null => {
    if (!dateString || typeof dateString !== 'string') return null;
    try {
        let parts = dateString.split('-');
        if (parts.length === 3) { const date = new Date(Date.UTC(+parts[0], +parts[1] - 1, +parts[2])); if (!isNaN(date.getTime())) return date; }
        parts = dateString.split('.');
        if (parts.length === 3) { const date = new Date(Date.UTC(+parts[2], +parts[1] - 1, +parts[0])); if (!isNaN(date.getTime())) return date; }
    } catch (e) { console.error("Error parsing date:", dateString, e); }
    return null;
};

const inter = Inter({ subsets: ['latin'] });

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

  useEffect(() => { document.title = 'Місцеві гроші: фінансова звітність'; }, []);

  // Налаштування ранвею: які витратні категорії НЕ входять у знаменник (зберігається в браузері)
  const [runwayExcluded, setRunwayExcluded] = usePersistedState<string[]>('finance-tracker-runway-excluded', []);
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
        const today = new Date(); today.setUTCHours(23, 59, 59, 999);
        const currentBalanceDetails: BalanceDetails = {};
        if (!Array.isArray(headerAccounts)) return { currentTotalBalance: 0, runwayMonths: null, balanceTooltipText: "...", expenseCategories: [] as { category: string; sum: number; included: boolean }[], avgMonthlyExpense: 0, totalExpensesLast3Months: 0, includedExpenses: 0 };
        headerAccounts.forEach(acc => currentBalanceDetails[acc] = 0);
        if (!Array.isArray(headerAllTransactions)) return { currentTotalBalance: 0, runwayMonths: null, balanceTooltipText: "...", expenseCategories: [] as { category: string; sum: number; included: boolean }[], avgMonthlyExpense: 0, totalExpensesLast3Months: 0, includedExpenses: 0 };
        headerAllTransactions.forEach(tx => { const txDate = parseDate(tx.date); if (currentBalanceDetails.hasOwnProperty(tx.account) && txDate && txDate <= today) { const amount = typeof tx.amount === 'number' && !isNaN(tx.amount) ? tx.amount : 0; currentBalanceDetails[tx.account] += signedAmount({ ...tx, amount }); }});
        const currentTotalBalance = Object.values(currentBalanceDetails).reduce((sum, bal) => sum + (typeof bal === 'number' ? bal : 0), 0);
        // Межі в UTC, як і дати транзакцій: локальний конструктор у Києві (+3) зсував вікно і губив останній день місяця
        const threeMonthsAgo = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() - 3, 1));
        const lastMonthEnd = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 0, 23, 59, 59, 999));
        // Витрати за 3 повні місяці по категоріях — з них користувач вибирає, що входить у ранвей
        const expenseByCategory: { [category: string]: number } = {};
        headerAllTransactions.forEach(tx => { const txDate = parseDate(tx.date); const amount = typeof tx.amount === 'number' ? tx.amount : 0; if (tx.type === 'Витрата' && txDate && txDate >= threeMonthsAgo && txDate <= lastMonthEnd) { expenseByCategory[tx.category] = (expenseByCategory[tx.category] || 0) + amount; } });
        const expenseCategories = Object.entries(expenseByCategory).map(([category, sum]) => ({ category, sum, included: !runwayExcluded.includes(category) })).sort((a, b) => b.sum - a.sum);
        const totalExpensesLast3Months = expenseCategories.reduce((acc, c) => acc + c.sum, 0);
        const includedExpenses = expenseCategories.filter(c => c.included).reduce((acc, c) => acc + c.sum, 0);
        const avgMonthlyExpense = includedExpenses > 0 ? includedExpenses / 3 : 0;
        let runwayMonths: number | null | typeof Infinity = null;
        if (avgMonthlyExpense > 0 && currentTotalBalance > 0) { runwayMonths = currentTotalBalance / avgMonthlyExpense; }
        else if (currentTotalBalance >= 0 && avgMonthlyExpense <= 0) { runwayMonths = Infinity; }
        const balanceTooltipText = headerAccounts.map(acc => `${acc}: ${formatNumber(currentBalanceDetails[acc] || 0)} ₴`).join('\n');
        return { currentTotalBalance, runwayMonths, balanceTooltipText, expenseCategories, avgMonthlyExpense, totalExpensesLast3Months, includedExpenses };
    }, [headerAllTransactions, headerAccounts, runwayExcluded]);

  return (
    <html lang="uk">
      <head />
      <body className={`${inter.className} bg-gray-100`}>
        <header className="bg-white shadow sticky top-0 z-20">
          {/* Змінив h-16 на h-auto та додав min-h-16 для гнучкості */}
          <nav className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 min-h-16 flex items-center justify-between gap-4 flex-wrap md:flex-nowrap"> {/* Додав flex-wrap для мобільних */}

             {/* Логотип та навігація */}
             <div className="w-full md:w-auto flex justify-center md:justify-start items-center gap-2 sm:gap-4 flex-shrink-0 py-2">
                <Link href="/" className="flex items-center flex-shrink-0">
                    <Image src="/logo.png" alt="Логотип Місцеві гроші" width={300} height={75} priority className="h-8 sm:h-10 md:h-12 w-auto" />
                </Link>
                <nav className="flex items-center gap-1 sm:gap-2">
                  <Link
                    href="/"
                    className={`px-2 sm:px-3 py-1 rounded-md text-xs sm:text-sm font-medium transition-colors ${
                      pathname === '/' || pathname === '/transactions'
                        ? 'bg-[#8884D8] text-white'
                        : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                    }`}
                  >
                    Баланс
                  </Link>
                  <Link
                    href="/earn"
                    className={`px-2 sm:px-3 py-1 rounded-md text-xs sm:text-sm font-medium transition-colors ${
                      pathname === '/earn'
                        ? 'bg-[#8884D8] text-white'
                        : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                    }`}
                  >
                    Зароблено
                  </Link>
                  <Link
                    href="/projects"
                    className={`px-2 sm:px-3 py-1 rounded-md text-xs sm:text-sm font-medium transition-colors ${
                      pathname === '/projects'
                        ? 'bg-[#8884D8] text-white'
                        : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                    }`}
                  >
                    Проекти
                  </Link>
                  <Link
                    href="/fop"
                    className={`px-2 sm:px-3 py-1 rounded-md text-xs sm:text-sm font-medium transition-colors ${
                      pathname === '/fop'
                        ? 'bg-[#8884D8] text-white'
                        : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                    }`}
                  >
                    ФОП
                  </Link>
                </nav>
             </div>

             {/* Показники (по центру) */}
              {/* Займає всю ширину на моб, центрується на десктопі */}
             <div className="w-full md:flex-grow flex justify-center items-center gap-x-4 sm:gap-x-6 gap-y-1 flex-wrap order-3 md:order-2 py-1 md:py-0">
               {headerIsLoading ? ( <span className="text-xs md:text-sm text-gray-500">Завантаження...</span> )
                : headerError ? ( <span className="text-xs md:text-sm font-medium text-red-600" title={headerError}>Помилка завантаження даних</span> ) : (
                   <>
                       <div title={headerMetrics.balanceTooltipText} className="text-center md:text-left"> {/* Центрування для моб */}
                           <span className="text-xs md:text-sm font-medium text-gray-500">Кошти: </span>
                           <span className="text-base md:text-lg font-semibold text-[#8884D8]">{formatNumber(headerMetrics.currentTotalBalance)} ₴</span>
                       </div>
                       <div className="text-center md:text-left relative" ref={runwayRef}>
                           <button type="button" onClick={() => setRunwayOpen(o => !o)} className="hover:underline decoration-dotted underline-offset-4" title="Налаштувати, які витрати входять у ранвей">
                               <span className="text-xs md:text-sm font-medium text-gray-500">Ранвей: </span>
                               <span className="text-base md:text-lg font-semibold text-[#8884D8]">{headerMetrics.runwayMonths === null ? 'N/A' : headerMetrics.runwayMonths === Infinity ? '∞' : headerMetrics.runwayMonths.toFixed(1)} міс.</span>
                               {runwayExcluded.length > 0 && <span className="ml-1 text-xs text-gray-400" title={`Без: ${runwayExcluded.join(', ')}`}>−{runwayExcluded.length}</span>}
                           </button>
                           {runwayOpen && (
                               <div className="absolute left-1/2 -translate-x-1/2 md:left-auto md:right-0 md:translate-x-0 top-full mt-2 z-30 w-80 bg-white border border-gray-200 rounded shadow-lg p-3 text-left">
                                   <div className="text-xs text-gray-500 mb-2">Ранвей = кошти / (обрані витрати за 3 повні місяці / 3). Зніми галочку, щоб виключити категорію.</div>
                                   <ul className="max-h-72 overflow-y-auto divide-y divide-gray-100">
                                       {headerMetrics.expenseCategories.map(c => (
                                           <li key={c.category} className="flex items-center gap-2 py-1 text-sm">
                                               <input type="checkbox" id={`rw-${c.category}`} checked={c.included} onChange={() => setRunwayExcluded(prev => c.included ? [...prev, c.category] : prev.filter(x => x !== c.category))} className="accent-[#8884D8]" />
                                               <label htmlFor={`rw-${c.category}`} className={`flex-1 cursor-pointer ${c.included ? 'text-gray-800' : 'text-gray-400 line-through'}`}>{c.category}</label>
                                               <span className={`font-mono text-xs ${c.included ? 'text-gray-600' : 'text-gray-400'}`}>{formatNumber(c.sum / 3)}/міс</span>
                                           </li>
                                       ))}
                                   </ul>
                                   <div className="mt-2 pt-2 border-t border-gray-200 text-xs text-gray-600 flex justify-between">
                                       <span>У знаменнику: <strong>{formatNumber(headerMetrics.avgMonthlyExpense)}</strong>/міс</span>
                                       <span className="text-gray-400">усього {formatNumber(headerMetrics.totalExpensesLast3Months / 3)}/міс</span>
                                   </div>
                                   {runwayExcluded.length > 0 && <button type="button" onClick={() => setRunwayExcluded([])} className="mt-2 text-xs text-[#8884D8] hover:underline">Включити все</button>}
                               </div>
                           )}
                       </div>
                       <button
                           type="button"
                           onClick={refresh}
                           className="text-xs md:text-sm font-medium text-[#8884D8] hover:text-[#6c63b8] hover:underline"
                           title="Перечитати дані з Google Таблиці"
                       >
                           Оновити
                       </button>
                       {/* Посилання на Джерело (показується в рядку на мобільних) */}
                       <div className="md:hidden">
                          <a href="https://docs.google.com/spreadsheets/d/1jl54qnar1R0nDdAIxJF6uN4eMPXacOfqasNAuwm8BNk/edit" target="_blank" rel="noopener noreferrer"
                             className="text-xs font-medium text-[#8884D8] hover:text-[#6c63b8] hover:underline whitespace-nowrap"
                          >
                             Джерело
                          </a>
                       </div>
                   </>
               )}
             </div>

             {/* Посилання на Джерело (праворуч на десктопі) */}
             <div className="hidden md:block flex-shrink-0 py-2 order-2 md:order-3"> {/* Змінив порядок для flex-wrap */}
                <a href="https://docs.google.com/spreadsheets/d/1jl54qnar1R0nDdAIxJF6uN4eMPXacOfqasNAuwm8BNk/edit" target="_blank" rel="noopener noreferrer"
                   className="text-sm font-medium text-[#8884D8] hover:text-[#6c63b8] hover:underline whitespace-nowrap"
                >
                   Джерело
                </a>
             </div>

          </nav>
        </header>
        {/* Основний контент */}
        <main className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
          {children}
        </main>
      </body>
    </html>
  );
}
