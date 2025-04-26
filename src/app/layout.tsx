'use client'; // Робимо Клієнтським Компонентом для використання хуків

import React, { useState, useEffect, useMemo } from 'react'; // Додали хуки
import type { Metadata } from 'next'; // Metadata тут може не працювати для клієнтського компонента, але залишимо для title
import { Inter } from 'next/font/google';
import Link from 'next/link';
import Image from 'next/image';
import './globals.css';

// --- Типи даних (скопійовано з transactions/page) ---
interface Transaction { date: string | null; amount: number; type: string; account: string; category: string; description: string;}
interface BalanceDetails { [account: string]: number; }

// --- Хелпери (скопійовано з transactions/page) ---
const formatNumber = (num: number): string => {
    if (typeof num !== 'number' || isNaN(num)) { return '0,00'; }
    return num.toLocaleString('uk-UA', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};
const parseDate = (dateString: string | null): Date | null => {
    if (!dateString) return null;
    let parts = dateString.split('-');
    if (parts.length === 3) { const date = new Date(Date.UTC(+parts[0], +parts[1] - 1, +parts[2])); if (!isNaN(date.getTime())) { return date; } }
    parts = dateString.split('.');
    if (parts.length === 3) { const date = new Date(Date.UTC(+parts[2], +parts[1] - 1, +parts[0])); if (!isNaN(date.getTime())) { return date; } }
    return null;
};
// --- Кінець хелперів ---


// Metadata - зауваження: для динамічного title/description в клієнтських компонентах
// краще використовувати document.title або спеціальні бібліотеки (напр. next-seo)
// export const metadata: Metadata = { // Цей експорт може не працювати як очікувалось
//   title: 'Місцеві гроші: фінансова звітність',
//   description: 'Ультра-мінімалістичний фінансовий трекер',
// };

const inter = Inter({ subsets: ['latin'] });

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
  useEffect(() => {
    // Встановлюємо title документа тут
    document.title = 'Місцеві гроші: фінансова звітність';

    const fetchHeaderData = async () => {
       setHeaderIsLoading(true);
       try {
         // Запит даних (такий самий, як на сторінці транзакцій)
         const response = await fetch('/api/sheet-data');
         if (!response.ok) { throw new Error(`HTTP error! status: ${response.status}`); }
         const data = await response.json();
         if (!Array.isArray(data.transactions) || !Array.isArray(data.accounts)) { throw new Error("Invalid data structure."); }
         setHeaderAllTransactions(data.transactions);
         setHeaderAccounts(data.accounts);
       } catch (err) {
           console.error("Failed to fetch header data:", err);
           // Можна додати обробку помилки для хедера
       } finally {
         setHeaderIsLoading(false);
       }
    };
    fetchHeaderData();
  }, []); // Виконується один раз при завантаженні макету

  // --- Розрахунок Показників для Хедера ---
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
      {/* Встановлюємо title через head, хоча це менш надійно в Client Component */}
      <head>
         <title>Місцеві гроші: фінансова звітність</title>
      </head>
      <body className={`${inter.className} bg-gray-100`}>
        {/* Хедер з логотипом та показниками */}
        <header className="bg-white shadow sticky top-0 z-20"> {/* Збільшив z-index */}
          {/* Змінюємо структуру nav для розміщення показників */}
          <nav className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4"> {/* Збільшив висоту, додав gap */}

             {/* Логотип (зліва) */}
             <div className="flex-shrink-0">
                <Link href="/transactions" className="flex items-center">
                    <Image
                       src="/logo.png"
                       alt="Логотип Місцеві гроші"
                       width={300} // Нові розміри
                       height={75} // Нові розміри
                       priority
                       className="h-12 w-auto" // Задаємо висоту відображення (h-12 = 48px)
                    />
                </Link>
             </div>

             {/* Показники (по центру) */}
             {/* Використовуємо flex-grow для заповнення простору та justify-center */}
             <div className="flex-grow flex justify-center items-center gap-x-6 gap-y-1 flex-wrap px-4">
                {headerIsLoading ? (
                    <span className="text-sm text-gray-500">Завантаження...</span>
                ) : (
                   <>
                       <div title={headerMetrics.balanceTooltipText}>
                           <span className="text-sm font-medium text-gray-500">Кошти: </span>
                           {/* Лавандовий колір */}
                           <span className="text-lg font-semibold text-[#8884D8]">
                               {formatNumber(headerMetrics.currentTotalBalance)} ₴
                           </span>
                       </div>
                       <div>
                           <span className="text-sm font-medium text-gray-500">Ранвей: </span>
                           {/* Лавандовий колір */}
                           <span className="text-lg font-semibold text-[#8884D8]">
                               {headerMetrics.runwayMonths === null ? 'N/A' :
                                headerMetrics.runwayMonths === Infinity ? '∞' :
                                headerMetrics.runwayMonths.toFixed(1)} міс.
                           </span>
                       </div>
                   </>
                )}
             </div>

             {/* Пустий div справа для симетрії (можна додати кнопки пізніше) */}
             <div className="flex-shrink-0 w-[calc(200px*0.6)]"> {/* Займаємо приблизно стільки ж місця, скільки лого */}
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
