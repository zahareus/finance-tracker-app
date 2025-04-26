'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';

// --- Типи даних (без змін) ---
interface Transaction { /* ... */ }
interface CategoryInfo { /* ... */ }

// --- Хелпери (без змін) ---
const formatNumber = (num: number) => { /* ... */ };
const parseDate = (dateString: string | null): Date | null => { /* ... */ };

// Нова функція для форматування дати в YYYY-MM-DD
const formatDateForInput = (date: Date) => {
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    return `<span class="math-inline">\{year\}\-</span>{month}-${day}`;
};

const TransactionsPage: React.FC = () => {
  // --- Стан для даних (без змін) ---
  const [allTransactions, setAllTransactions] = useState<Transaction[]>([]);
  const [accounts, setAccounts] = useState<string[]>([]);
  const [categories, setCategories] = useState<CategoryInfo[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // --- Стан для ФІЛЬТРІВ (Використовуємо нову функцію форматування дати) ---
  const getInitialDates = () => {
      const today = new Date();
      const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
      const lastDayOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);
      return {
          start: formatDateForInput(firstDayOfMonth), // Використовуємо нову функцію
          end: formatDateForInput(lastDayOfMonth)   // Використовуємо нову функцію
      }
  }
  const initialDates = getInitialDates();
  const [startDate, setStartDate] = useState<string>(initialDates.start);
  const [endDate, setEndDate] = useState<string>(initialDates.end);
  const [selectedAccounts, setSelectedAccounts] = useState<string[]>([]);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [selectedType, setSelectedType] = useState<string>('Всі');

  // --- Завантаження даних (без змін) ---
  useEffect(() => { /* ... */ }, []);

  // --- ЛОГІКА ФІЛЬТРАЦІЇ (Видаляємо старі console.log) ---
  const filteredTransactions = useMemo(() => {
    const start = startDate ? new Date(startDate) : null;
    const end = endDate ? new Date(endDate) : null;
    if (start) start.setHours(0, 0, 0, 0);
    if (end) end.setHours(23, 59, 59, 999);

    return allTransactions.filter(tx => {
      const typeMatch = selectedType === 'Всі' || tx.type === selectedType;
      if (!typeMatch) return false;
      const accountMatch = selectedAccounts.length === 0 || selectedAccounts.includes(tx.account);
      if (!accountMatch) return false;
      const categoryMatch = selectedCategories.length === 0 || selectedCategories.includes(tx.category);
      if (!categoryMatch) return false;
      const txDate = parseDate(tx.date);
      if (!txDate) return false;
      const startDateMatch = !start || txDate >= start;
      if (!startDateMatch) return false;
      const endDateMatch = !end || txDate <= end;
      if (!endDateMatch) return false;
      return true;
    });
  }, [allTransactions, startDate, endDate, selectedAccounts, selectedCategories, selectedType]);

  // --- Обробники змін фільтрів (без змін) ---
   const handleAccountChange = useCallback((account: string) => {/*...*/}, []);
   const handleSelectAllAccounts = useCallback(() => {/*...*/}, [accounts]);
   const handleCategoryChange = useCallback((category: string) => {/*...*/}, []);
   const handleSelectAllCategories = useCallback(() => {/*...*/}, [categories]);


  // --- РЕНДЕР КОМПОНЕНТА ---

  // ДОДАЄМО ЛОГ ПЕРЕД РЕНДЕРОМ ТАБЛИЦІ
  console.log("--- Before Table Render ---");
  console.log("isLoading:", isLoading);
  console.log("error:", error);
  console.log("filteredTransactions:", filteredTransactions); // Дивимось, що тут у масиві
  console.log("filteredTransactions length:", filteredTransactions.length);

  return (
    <div>
      <h1 className="text-xl font-semibold mb-4">Транзакції</h1>

      {/* Фільтри (код без змін) */}
      <div className="mb-6 p-4 border rounded bg-gray-50 space-y-4">
          {/* Перший рядок */}
          <div className="flex flex-wrap gap-4 items-end">{/* Дати та Тип */}</div>
          {/* Другий рядок */}
          <div className="flex flex-wrap gap-4 items-start">{/* Рахунки та Категорії */}</div>
      </div>

      {/* --- Таблиця транзакцій (З ТИМЧАСОВО СПРОЩЕНИМ РЕНДЕРОМ РЯДКА) --- */}
      {isLoading && <p className="mt-4">Завантаження транзакцій...</p>}
      {error && <p className="mt-4 text-red-600">Помилка завантаження: {error}</p>}

      {!isLoading && !error && (
        <div className="overflow-x-auto mt-4">
           <table className="min-w-full divide-y divide-gray-200">
             <thead className="bg-gray-50">
               <tr>
                 <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Дата</th>
                 {/* ... інші заголовки ... */}
                 <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Сума</th>
               </tr>
             </thead>
             <tbody className="bg-white divide-y divide-gray-200">
               {filteredTransactions.length === 0 ? (
                 <tr> <td colSpan={5} className="px-4 py-4 text-center text-gray-500">Транзакцій за обраними фільтрами не знайдено</td> </tr>
               ) : (
                 // Ітеруємо по filteredTransactions
                 filteredTransactions.map((tx, index) => (
                   // ***** ТИМЧАСОВО СПРОЩЕНИЙ РЯДОК *****
                   <tr key={index} className="bg-yellow-100">
                       <td colSpan={5} className="px-4 py-2 text-center text-sm">
                           Знайдено транзакцію: {tx.date} - {tx.category} - {tx.amount}
                       </td>
                   </tr>
                   // ***** КІНЕЦЬ СПРОЩЕНОГО РЯДКА *****

                   /*
                   // ***** ОРИГІНАЛЬНИЙ РЯДОК (Закоментовано) *****
                   <tr key={`<span class="math-inline">\{tx\.date\}\-</span>{tx.account}-<span class="math-inline">\{tx\.amount\}\-</span>{index}`} className={`${tx.type === 'Витрата' ? 'bg-red-50 hover:bg-red-100' : 'bg-green-50 hover:bg-green-100'} transition-colors duration-150 ease-in-out`}>
                     <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-900">{tx.date}</td>
                     <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-500">{tx.account}</td>
                     <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-500">{tx.category}</td>
                     <td className="px-4 py-2 text-sm text-gray-500">{tx.description}</td>
                     <td className={`px-4 py-2 whitespace-nowrap text-sm text-right font-medium ${tx.type === 'Витрата' ? 'text-red-600' : 'text-green-600'}`}>
                       {tx.type === 'Витрата' ? '-' : '+'} {formatNumber(tx.amount)} ₴
                     </td>
                   </tr>
                   */
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
