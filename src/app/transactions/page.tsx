'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';

// --- Типи даних ---
interface Transaction { /*...*/ }
interface CategoryInfo { /*...*/ }

// --- Хелпери ---
const formatNumber = (num: number) => { /*...*/ };

// Виправлена функція parseDate
const parseDate = (dateString: string | null): Date | null => {
    if (!dateString) return null;
    // Спочатку спробуємо YYYY-MM-DD
    let parts = dateString.split('-');
    if (parts.length === 3) {
        const date = new Date(+parts[0], +parts[1] - 1, +parts[2]);
        if (!isNaN(date.getTime())) { return date; }
    }
    // Потім спробуємо DD.MM.YYYY
    parts = dateString.split('.');
    if (parts.length === 3) {
        const date = new Date(+parts[2], +parts[1] - 1, +parts[0]);
        if (!isNaN(date.getTime())) { return date; }
    }
    // Якщо жоден формат не підійшов, повертаємо null
    return null;
};

// Функція форматування дати в YYYY-MM-DD
const formatDateForInput = (date: Date) => { /*...*/ };

const TransactionsPage: React.FC = () => {
  // --- Стан для даних ---
  const [allTransactions, setAllTransactions] = useState<Transaction[]>([]);
  const [accounts, setAccounts] = useState<string[]>([]);
  const [categories, setCategories] = useState<CategoryInfo[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // --- Стан для ФІЛЬТРІВ ---
  const getInitialDates = () => { /*...*/ };
  const initialDates = getInitialDates();
  const [startDate, setStartDate] = useState<string>(initialDates.start);
  const [endDate, setEndDate] = useState<string>(initialDates.end);
  const [selectedAccounts, setSelectedAccounts] = useState<string[]>([]);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [selectedType, setSelectedType] = useState<string>('Всі');

  // --- Завантаження даних ---
  useEffect(() => { /*...*/ }, []);

  // --- ЛОГІКА ФІЛЬТРАЦІЇ (з логуванням) ---
  const filteredTransactions = useMemo(() => {
    // console.log("--- Running Filter ---");
    // console.log("Filters:", { startDate, endDate, selectedType, selectedAccounts, selectedCategories });
    const start = startDate ? new Date(startDate) : null;
    const end = endDate ? new Date(endDate) : null;
    if (start) start.setHours(0, 0, 0, 0);
    if (end) end.setHours(23, 59, 59, 999);
    // console.log("Parsed Date Range:", { start, end });

    return allTransactions.filter((tx, index) => {
      // console.log(`\nChecking transaction #${index}:`, tx);
      const typeMatch = selectedType === 'Всі' || tx.type === selectedType;
      if (!typeMatch) { /* console.log(` -> Failed Type Filter`); */ return false; }
      const accountMatch = selectedAccounts.length === 0 || selectedAccounts.includes(tx.account);
       if (!accountMatch) { /* console.log(` -> Failed Account Filter`); */ return false; }
      const categoryMatch = selectedCategories.length === 0 || selectedCategories.includes(tx.category);
       if (!categoryMatch) { /* console.log(` -> Failed Category Filter`); */ return false; }
      const txDate = parseDate(tx.date); // Використовуємо виправлену функцію
      // console.log(` -> Parsed txDate: ${txDate}`);
      if (!txDate) { /* console.log(` -> Failed Date Filter (Invalid date)`); */ return false; }
      const startDateMatch = !start || txDate >= start;
      if (!startDateMatch) { /* console.log(` -> Failed Start Date Filter`); */ return false; }
      const endDateMatch = !end || txDate <= end;
       if (!endDateMatch) { /* console.log(` -> Failed End Date Filter`); */ return false; }
      // console.log(" -> Transaction Passed All Filters!");
      return true;
    });
  }, [allTransactions, startDate, endDate, selectedAccounts, selectedCategories, selectedType]);

  // --- Обробники змін фільтрів (без змін) ---
   const handleAccountChange = useCallback((account: string) => {/*...*/}, []);
   const handleSelectAllAccounts = useCallback(() => {/*...*/}, [accounts]);
   const handleCategoryChange = useCallback((category: string) => {/*...*/}, []);
   const handleSelectAllCategories = useCallback(() => {/*...*/}, [categories]);


  // --- РЕНДЕР КОМПОНЕНТА ---
  // console.log("--- Before Table Render ---");
  // console.log("filteredTransactions length:", filteredTransactions.length);

  return (
    <div>
      <h1 className="text-xl font-semibold mb-4">Транзакції</h1>

      {/* Фільтри (код розмітки без змін) */}
      <div className="mb-6 p-4 border rounded bg-gray-50 space-y-4">
          {/* Перший рядок */}
          <div className="flex flex-wrap gap-4 items-end">{/* ...Дати та Тип... */}</div>
          {/* Другий рядок */}
          <div className="flex flex-wrap gap-4 items-start">{/* ...Рахунки та Категорії... */}</div>
      </div>

      {/* Таблиця транзакцій (використовуємо СПРОЩЕНИЙ варіант поки що) */}
      {isLoading && <p className="mt-4">Завантаження транзакцій...</p>}
      {error && <p className="mt-4 text-red-600">Помилка завантаження: {error}</p>}

      {!isLoading && !error && (
        <div className="overflow-x-auto mt-4">
           <table className="min-w-full divide-y divide-gray-200">
             <thead className="bg-gray-50">
               <tr>
                 <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Дата</th>
                 <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Рахунок</th>
                 <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Категорія</th>
                 <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Опис</th>
                 <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Сума</th>
               </tr>
             </thead>
             <tbody className="bg-white divide-y divide-gray-200">
               {filteredTransactions.length === 0 ? (
                 <tr> <td colSpan={5} className="px-4 py-4 text-center text-gray-500">Транзакцій за обраними фільтрами не знайдено</td> </tr>
               ) : (
                 filteredTransactions.map((tx, index) => (
                   // ЗАЛИШАЄМО СПРОЩЕНИЙ РЯДОК ДЛЯ ТЕСТУ
                   <tr key={index} className="bg-yellow-100">
                       <td colSpan={5} className="px-4 py-2 text-center text-sm">
                           Знайдено транзакцію: {tx.date} - {tx.category} - {tx.amount}
                       </td>
                   </tr>
                 ))
               )}
             </tbody>
           </table>
        </div>
      )}
    </div>
  );
};

export default TransactionsPage;
