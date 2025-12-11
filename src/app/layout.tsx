'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { Inter } from 'next/font/google';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import './globals.css';

// --- Типи даних ---
interface Transaction { date: string | null; amount: number; type: string; account: string; category: string; description: string;}
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
  const pathname = usePathname();

  // --- Стан для даних хедера ---
  const [headerAllTransactions, setHeaderAllTransactions] = useState<Transaction[]>([]);
  const [headerAccounts, setHeaderAccounts] = useState<string[]>([]);
  const [headerIsLoading, setHeaderIsLoading] = useState<boolean>(true);

  // --- Завантаження даних для хедера ---
  useEffect(() => {
    document.title = 'Місцеві гроші: фінансова звітність';
    const fetchHeaderData = async () => {
       setHeaderIsLoading(true);
       try {
         const response = await fetch('/api/sheet-data');
         if (!response.ok) { throw new Error(`HTTP error! status: ${response.status}`); }
         const data = await response.json();
         if (!Array.isArray(data.transactions) || !Array.isArray(data.accounts)) { throw new Error("Invalid data structure for header."); }
         setHeaderAllTransactions(Array.isArray(data.transactions) ? data.transactions : []);
         setHeaderAccounts(Array.isArray(data.accounts) ? data.accounts.flat().map(String).filter(Boolean) : []);
       } catch (err) { console.error("Failed to fetch header data:", err); }
       finally { setHeaderIsLoading(false); }
    };
    fetchHeaderData();
  }, []);

  // --- Розрахунок Показників для Хедера ---
  const headerMetrics = useMemo(() => {
        const today = new Date(); today.setUTCHours(23, 59, 59, 999);
        const currentBalanceDetails: BalanceDetails = {};
        if (!Array.isArray(headerAccounts)) return { currentTotalBalance: 0, runwayMonths: null, balanceTooltipText: "..." };
        headerAccounts.forEach(acc => currentBalanceDetails[acc] = 0);
        if (!Array.isArray(headerAllTransactions)) return { currentTotalBalance: 0, runwayMonths: null, balanceTooltipText: "..." };
        headerAllTransactions.forEach(tx => { const txDate = parseDate(tx.date); if (currentBalanceDetails.hasOwnProperty(tx.account) && txDate && txDate <= today) { const amount = typeof tx.amount === 'number' && !isNaN(tx.amount) ? tx.amount : 0; currentBalanceDetails[tx.account] += (tx.type === 'Надходження' ? amount : -amount); }});
        const currentTotalBalance = Object.values(currentBalanceDetails).reduce((sum, bal) => sum + (typeof bal === 'number' ? bal : 0), 0);
        const threeMonthsAgo = new Date(today.getUTCFullYear(), today.getUTCMonth() - 3, 1);
        const lastMonthEnd = new Date(today.getUTCFullYear(), today.getUTCMonth(), 0); lastMonthEnd.setUTCHours(23,59,59,999);
        let totalExpensesLast3Months = 0;
        headerAllTransactions.forEach(tx => { const txDate = parseDate(tx.date); const amount = typeof tx.amount === 'number' ? tx.amount : 0; if (tx.type === 'Витрата' && txDate && txDate >= threeMonthsAgo && txDate <= lastMonthEnd) { totalExpensesLast3Months += amount; } });
        const avgMonthlyExpense = totalExpensesLast3Months > 0 ? totalExpensesLast3Months / 3 : 0;
        let runwayMonths: number | null | typeof Infinity = null;
        if (avgMonthlyExpense > 0 && currentTotalBalance > 0) { runwayMonths = currentTotalBalance / avgMonthlyExpense; }
        else if (currentTotalBalance >= 0 && avgMonthlyExpense <= 0) { runwayMonths = Infinity; }
        const balanceTooltipText = headerAccounts.map(acc => `${acc}: ${formatNumber(currentBalanceDetails[acc] || 0)} ₴`).join('\n');
        return { currentTotalBalance, runwayMonths, balanceTooltipText };
    }, [headerAllTransactions, headerAccounts]);

  return (
    <html lang="uk">
      <head />
      <body className={`${inter.className} bg-gray-100`}>
        <header className="bg-white shadow sticky top-0 z-20">
          {/* Змінив h-16 на h-auto та додав min-h-16 для гнучкості */}
          <nav className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 min-h-16 flex items-center justify-between gap-4 flex-wrap md:flex-nowrap"> {/* Додав flex-wrap для мобільних */}

             {/* Логотип та навігація */}
             <div className="w-full md:w-auto flex justify-center md:justify-start items-center gap-4 flex-shrink-0 py-2">
                <Link href="/" className="flex items-center">
                    <Image src="/logo.png" alt="Логотип Місцеві гроші" width={300} height={75} priority className="h-10 md:h-12 w-auto" />
                </Link>
                <nav className="flex items-center gap-1 sm:gap-2">
                  <Link
                    href="/"
                    className={`px-2 sm:px-3 py-1 rounded-md text-sm font-medium transition-colors ${
                      pathname === '/' || pathname === '/transactions'
                        ? 'bg-[#8884D8] text-white'
                        : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                    }`}
                  >
                    Баланс
                  </Link>
                  <Link
                    href="/projects"
                    className={`px-2 sm:px-3 py-1 rounded-md text-sm font-medium transition-colors ${
                      pathname === '/projects'
                        ? 'bg-[#8884D8] text-white'
                        : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                    }`}
                  >
                    Проекти
                  </Link>
                </nav>
             </div>

             {/* Показники (по центру) */}
              {/* Займає всю ширину на моб, центрується на десктопі */}
             <div className="w-full md:flex-grow flex justify-center items-center gap-x-4 sm:gap-x-6 gap-y-1 flex-wrap order-3 md:order-2 py-1 md:py-0">
               {headerIsLoading ? ( <span className="text-xs md:text-sm text-gray-500">Завантаження...</span> ) : (
                   <>
                       <div title={headerMetrics.balanceTooltipText} className="text-center md:text-left"> {/* Центрування для моб */}
                           <span className="text-xs md:text-sm font-medium text-gray-500">Кошти: </span>
                           <span className="text-base md:text-lg font-semibold text-[#8884D8]">{formatNumber(headerMetrics.currentTotalBalance)} ₴</span>
                       </div>
                       <div className="text-center md:text-left">
                           <span className="text-xs md:text-sm font-medium text-gray-500">Ранвей: </span>
                           <span className="text-base md:text-lg font-semibold text-[#8884D8]">{headerMetrics.runwayMonths === null ? 'N/A' : headerMetrics.runwayMonths === Infinity ? '∞' : headerMetrics.runwayMonths.toFixed(1)} міс.</span>
                       </div>
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
