'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { Inter } from 'next/font/google';
import Link from 'next/link';
import Image from 'next/image';
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
    if (!dateString || typeof dateString !== 'string') return null; try { let parts = dateString.split('-'); if (parts.length === 3) { const date = new Date(Date.UTC(+parts[0], +parts[1] - 1, +parts[2])); if (!isNaN(date.getTime())) return date; } parts = dateString.split('.'); if (parts.length === 3) { const date = new Date(Date.UTC(+parts[2], +parts[1] - 1, +parts[0])); if (!isNaN(date.getTime())) return date; } } catch (e) {} return null;
};

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
    document.title = 'Місцеві гроші: фінансова звітність';
    const fetchHeaderData = async () => {
       setHeaderIsLoading(true);
       try {
         // ВИКОРИСТОВУЄМО НОВИЙ ПАРОЛЬНИЙ ЗАХИСТ - ТУТ ПАРОЛЬ НЕ ПОТРІБЕН
         // Запит даних буде йти тільки зі сторінки після автентифікації
         // Але нам потрібні акаунти для розрахунку, отримаємо їх хоча б
         const response = await fetch('/api/sheet-data', {
             // Надсилаємо "тестовий" запит БЕЗ пароля або з тим, що в сесії,
             // щоб отримати хоча б список рахунків, якщо сесія є.
             // API все одно перевірить пароль перед віддачею транзакцій.
             headers: { 'X-App-Password': sessionStorage.getItem('app_session_pwd_token') || '' }
         });
         // Не перевіряємо response.ok тут, бо запит може бути неавторизованим
         const data = await response.json();

         // Навіть якщо помилка (немає транзакцій), спробуємо отримати рахунки
         if (Array.isArray(data.accounts)) {
             setHeaderAccounts(data.accounts.flat().map(String).filter(Boolean));
         } else {
             console.warn("Header data fetch couldn't retrieve accounts.");
             setHeaderAccounts([]);
         }
         // Транзакції для хедера нам більше не потрібні напряму тут,
         // бо розрахунок буде на сторінці або в API (якщо розширювати)
         // setHeaderAllTransactions(Array.isArray(data.transactions) ? data.transactions : []);

         // ---- !! ВАЖЛИВО: Розрахунок КОШТИ і РАНВЕЙ переїжджає в page.tsx !! ----
         // Оскільки ці показники залежать від ВСІХ транзакцій, а ми тепер
         // отримуємо транзакції тільки ПІСЛЯ введення паролю на page.tsx,
         // логіку розрахунку headerMetrics треба перенести в page.tsx
         // або створити окремий API endpoint для них, який теж перевіряє пароль.
         // Зараз простіше перенести в page.tsx. Тому цей useMemo видаляємо звідси.

       } catch (err) { console.error("Failed to fetch initial header data:", err); }
       finally { setHeaderIsLoading(false); } // Закінчуємо завантаження в будь-якому випадку
    };
    fetchHeaderData();
  }, []);


  return (
    <html lang="uk">
      <head />
      <body className={`${inter.className} bg-gray-100`}>
        <header className="bg-white shadow sticky top-0 z-20">
          <nav className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 min-h-16 flex items-center justify-between gap-4 flex-wrap">
             {/* Логотип */}
             <div className="flex-shrink-0 py-2">
                 {/* **ОНОВЛЕНО HREF НА "/"** */}
                <Link href="/" className="flex items-center">
                    <Image src="/logo.png" alt="Логотип Місцеві гроші" width={300} height={75} priority className="h-12 w-auto" />
                </Link>
             </div>

             {/* **ВИДАЛЕНО БЛОК ПОКАЗНИКІВ З ХЕДЕРА** */}
             {/* Порожній div для заповнення простору */}
             <div className="flex-grow"></div>

             {/* **ВИДАЛЕНО БЛОК З ПОСИЛАННЯМ "Джерело"** */}

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
