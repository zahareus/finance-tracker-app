'use client';

import React, { useState, useEffect, useMemo } from 'react';
// Не імпортуємо Metadata тут, бо вона не експортується з Client Component
import { Inter } from 'next/font/google';
import Link from 'next/link';
import Image from 'next/image';
import './globals.css';

// --- Типи даних ---
interface Transaction {
  date: string | null;
  amount: number;
  type: string;
  account: string;
  category: string;
  description: string;
}
interface BalanceDetails {
    [account: string]: number;
}
// --- Кінець типів ---

// --- Хелпери (ПОВНІ ВЕРСІЇ) ---
const formatNumber = (num: number): string => {
    if (typeof num !== 'number' || isNaN(num)) { return '0,00'; }
    return num.toLocaleString('uk-UA', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

const parseDate = (dateString: string | null): Date | null => {
    if (!dateString) return null;
    // Спочатку спробуємо '-':MM-DD
    let parts = dateString.split('-');
    if (parts.length === 3) {
        const date = new Date(Date.UTC(+parts[0], +parts[1] - 1, +parts[2]));
        if (!isNaN(date.getTime())) { return date; }
    }
    // Потім спробуємо DD.MM.'':''
    parts = dateString.split('.');
    if (parts.length === 3) {
        const date = new Date(Date.UTC(+parts[2], +parts[1] - 1, +parts[0]));
        if (!isNaN(date.getTime())) { return date; }
    }
    return null;
};
// --- Кінець хелперів ---

const inter = Inter({ subsets: ['latin'] });

// Не експортуємо metadata звідси
// export const metadata: Metadata = { ... };

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // --- Стан для даних хедера ---
  const [headerAllTransactions, setHeaderAllTransactions] = useState<Transaction[]>([]);
  const [headerAccounts, setHeaderAccounts] = useState<string[]>([]);
  const [headerIsLoading, setHeaderIsLoading] = useState<boolean>(true);
  // --- Кінець стану ---

  // --- Завантаження даних для хедера ---
  // Повний useEffect
  useEffect(() => {
    // Встановлюємо title документа тут
    document.title = 'Місцеві гроші: фінансова звітність';

    const fetchHeaderData = async () => {
       setHeaderIsLoading(true);
       try {
         // Запит даних
         const response = await fetch('/api/sheet-data');
         if (!response.ok) {
             let errorText = `HTTP error! status: ${response.status}`;
             try { const errorData = await response.json(); errorText = errorData.error || errorText; } catch (e) {}
             throw new Error(errorText);
          }
         const data = await response.json();
         if (!Array.isArray(data.transactions) || !Array.isArray(data.accounts)) {
             console.error("Invalid data structure received for header:", data);
             throw new Error("Invalid data structure.");
          }
         setHeaderAllTransactions(data.transactions);
         setHeaderAccounts(data.accounts);
       } catch (err) {
           console.error("Failed to fetch header data:", err);
           // Тут можна додати setError для відображення помилки в хедері, якщо треба
       } finally {
         setHeaderIsLoading(false);
       }
    };
    fetchHeaderData();
  }, []); // Виконується один раз при завантаженні макету

  // --- Розрахунок Показників для Хедера ---
  // Повний useMemo
  const headerMetrics = useMemo(() => {
      const today = new Date();
      today.setUTCHours(23, 59, 59, 999);
      const currentBalanceDetails: BalanceDetails = {};
      // Ініціалізуємо по ВСІХ рахунках, отриманих з API
      headerAccounts.forEach(acc => currentBalanceDetails[acc] = 0);

      headerAllTransactions.forEach(tx => {
          const txDate = parseDate(tx.date);
          // Рахуємо баланс по всіх транзакціях до сьогодні
          if (currentBalanceDetails.hasOwnProperty(tx.account) && txDate && txDate <= today) {
              currentBalanceDetails[tx.account] += (tx.type === 'Надходження' ? tx.amount : -tx.amount);
          }
      });
      const currentTotalBalance = Object.values(currentBalanceDetails).reduce((sum, bal) => sum + bal, 0);

      // Розрахунок Ранвею
      const threeMonthsAgo = new Date(today.getUTCFullYear(), today.getUTCMonth() - 3, 1);
      const lastMonthEnd = new Date(today.getUTCFullYear(), today.getUTCMonth(), 0);
      lastMonthEnd.setUTCHours(23,59,59,999);
      let totalExpensesLast3Months = 0;
      headerAllTransactions.forEach(tx => {
          const txDate = parseDate(tx.date);
          // Враховуємо витрати за останні 3 повних місяці по ВСІХ рахунках
          if (tx.type === 'Витрата' && txDate && txDate >= threeMonthsAgo && txDate <= lastMonthEnd) {
              totalExpensesLast3Months += tx.amount;
          }
      });
      const avgMonthlyExpense = totalExpensesLast3Months > 0 ? totalExpensesLast3Months / 3 : 0;
      let runwayMonths: number | null | typeof Infinity = null;
      if (avgMonthlyExpense > 0) { runwayMonths = currentTotalBalance / avgMonthlyExpense; }
      else if (currentTotalBalance >= 0) { runwayMonths = Infinity; }

      const balanceTooltipText = headerAccounts
           .map(acc => `${acc}: ${formatNumber(currentBalanceDetails[acc] || 0)} ₴`)
           .join('\n');

      return { currentTotalBalance, runwayMonths, balanceTooltipText };
  }, [headerAllTransactions, headerAccounts]);
  // --- Кінець розрахунку ---


  return (
    <html lang="uk">
      {/* <head /> Тег head не потрібен, Next.js генерує його */}
      <body className={`${inter.className} bg-gray-100`}>
        {/* Хедер з логотипом та показниками */}
        <header className="bg-white shadow sticky top-0 z-20">
          {/* Повний JSX хедера */}
          <nav className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
             {/* Логотип (зліва) */}
             <div className="flex-shrink-0">
                <Link href="/transactions" className="flex items-center">
                    <Image
                       src="/logo.png"
                       alt="Логотип Місцеві гроші"
                       width={300} // Твої розміри
                       height={75} // Твої розміри
                       priority
                       className="h-12 w-auto" // Висота відображення
                    />
                </Link>
             </div>

             {/* Показники (по центру) */}
             <div className="flex-grow flex justify-center items-center gap-x-6 gap-y-1 flex-wrap px-4">
                {headerIsLoading ? (
                    <span className="text-sm text-gray-500">Завантаження даних...</span>
                ) : (
                   <>
                       <div title={headerMetrics.balanceTooltipText}>
                           <span className="text-sm font-medium text-gray-500">Кошти: </span>
                           <span className="text-lg font-semibold text-[#8884d8]">
                               {formatNumber(headerMetrics.currentTotalBalance)} ₴
                           </span>
                       </div>
                       <div>
                           <span className="text-sm font-medium text-gray-500">Ранвей: </span>
                           <span className="text-lg font-semibold text-[#8884d8]">
                               {headerMetrics.runwayMonths === null ? 'N/A' :
                                headerMetrics.runwayMonths === Infinity ? '∞' :
                                headerMetrics.runwayMonths.toFixed(1)} міс.
                           </span>
                       </div>
                   </>
                )}
             </div>

             {/* Посилання на Джерело (праворуч) */}
             <div className="flex-shrink-0">
                <a
                   href="https://docs.google.com/spreadsheets/d/1jl54qnar1R0nDdAIxJF6uN4eMPXacOfqasNAuwm8BNk/edit" // Скоротив посилання до основного ID
                   target="_blank"
                   rel="noopener noreferrer"
                   className="text-sm font-medium text-blue-600 hover:text-blue-800 hover:underline whitespace-nowrap"
                >
                   Джерело (Таблиця)
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
