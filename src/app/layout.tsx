'use client';

import React, { useState, useEffect, useMemo } from 'react';
import type { Metadata } from 'next'; // Можемо залишити, хоча title встановлюється інакше
import { Inter } from 'next/font/google';
import Link from 'next/link';
import Image from 'next/image';
import './globals.css';

// --- Типи даних ---
interface Transaction { /*...*/ }
interface BalanceDetails { /*...*/ }
// --- Хелпери ---
const formatNumber = (num: number): string => { /*...*/ };
const parseDate = (dateString: string | null): Date | null => { /*...*/ };

// export const metadata: Metadata = { // Видаляємо або коментуємо цей статичний експорт
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

  // --- Завантаження даних для хедера ---
  useEffect(() => {
    document.title = 'Місцеві гроші: фінансова звітність'; // Встановлюємо title
    const fetchHeaderData = async () => { /* ... */ };
    fetchHeaderData();
  }, []);

  // --- Розрахунок Показників для Хедера ---
  const headerMetrics = useMemo(() => { /* ... */ }, [headerAllTransactions, headerAccounts]);

  return (
    <html lang="uk">
      {/* Тег head можна залишити порожнім, Next.js сам додасть favicon */}
      <head />
      <body className={`${inter.className} bg-gray-100`}>
        {/* Хедер з логотипом, показниками та посиланням на джерело */}
        <header className="bg-white shadow sticky top-0 z-20">
          <nav className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">

             {/* Логотип (зліва) */}
             <div className="flex-shrink-0">
                <Link href="/transactions" className="flex items-center">
                    <Image src="/logo.png" alt="Логотип Місцеві гроші" width={300} height={75} priority className="h-12 w-auto" />
                </Link>
             </div>

             {/* Показники (по центру) */}
             <div className="flex-grow flex justify-center items-center gap-x-6 gap-y-1 flex-wrap px-4">
               {/* ... JSX показників ... */}
             </div>

             {/* Посилання на Джерело (праворуч) */}
             {/* Додаємо посилання на Google Sheet */}
             <div className="flex-shrink-0">
                <a
                   href="https://docs.google.com/spreadsheets/d/1jl54qnar1R0nDdAIxJF6uN4eMPXacOfqasNAuwm8BNk/edit?gid=745472546#gid=745472546" // Твоє посилання
                   target="_blank" // Відкривати в новій вкладці
                   rel="noopener noreferrer" // Рекомендація для безпеки зовнішніх посилань
                   className="text-sm font-medium text-blue-600 hover:text-blue-800 hover:underline whitespace-nowrap" // Стилі
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
