'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';

// --- Типи даних ---
interface Transaction {
  date: string | null;
  amount: number;
  type: string;
  account: string;
  category: string;
  description: string;
}
interface CategoryInfo {
    name: string;
    type: string;
}
// --- Кінець типів ---

// --- Хелпери ---
const formatNumber = (num: number) => {
    if (typeof num !== 'number' || isNaN(num)) { return '0,00'; }
    return num.toLocaleString('uk-UA', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};
const parseDate = (dateString: string | null): Date | null => {
    if (!dateString) return null;
    let parts = dateString.split('-');
    if (parts.length === 3) {
        const date = new Date(+parts[0], +parts[1] - 1, +parts[2]);
        if (!isNaN(date.getTime())) { return date; }
    }
    parts = dateString.split('.');
    if (parts.length === 3) {
        const date = new Date(+parts[2], +parts[1] - 1, +parts[0]);
        if (!isNaN(date.getTime())) { return date; }
    }
    // console.warn("Could not parse date string:", dateString);
    return null;
};
 // --- Кінець хелперів ---


const TransactionsPage: React.FC = () => {
  // --- Стан для даних ---
  const [allTransactions, setAllTransactions] = useState<Transaction[]>([]);
  const [accounts, setAccounts] = useState<string[]>([]);
  const [categories, setCategories] = useState<CategoryInfo[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // --- Стан для ФІЛЬТРІВ ---
  const getInitialDates = () => {
      const today = new Date();
      const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
      const lastDayOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);
      const formatDate = (date: Date) => date.toISOString().split('T')[0];
      return { start: formatDate(firstDayOfMonth), end: formatDate(lastDayOfMonth) }
  }
  const initialDates = getInitialDates();
  const [startDate, setStartDate] = useState<string>(initialDates.start);
  const [endDate, setEndDate] = useState<string>(initialDates.end);
  const [selectedAccounts, setSelectedAccounts] = useState<string[]>([]);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [selectedType, setSelectedType] = useState<string>('Всі');

  // --- Завантаження даних ---
  useEffect(() => {
    const fetchData = async () => {
       setIsLoading(true);
       setError(null);
       try {
         const response = await fetch('/api/sheet-data');
         if (!response.ok) {
           let errorText = `HTTP error! status: ${response.status}`;
           try { const errorData = await response.json(); errorText = errorData.error || errorText; } catch (e) {}
           throw new Error(errorText);
         }
         const data: {
           transactions: Transaction[];
           accounts: string[];
           categories: CategoryInfo[];
         } = await response.json();

         if (!Array.isArray(data.transactions) || !Array.isArray(data.accounts) || !Array.isArray(data.categories)) {
             console.error("Invalid data structure received:", data);
             throw new Error("Invalid data structure received from server.");
         }
         setAllTransactions(data.transactions);
         setAccounts(data.accounts);
         setCategories(data.categories);

       } catch (err) {
          console.error("Failed to fetch data:", err);
          setError(err instanceof Error ? err.message : 'An unknown error occurred.');
       } finally {
         setIsLoading(false);
       }
    };
    fetchData();
  }, []);


  // --- ЛОГІКА ФІЛЬТРАЦІЇ ---
  const filteredTransactions = useMemo(() => {
    const start = startDate ? new Date(startDate) : null;
    const end = endDate ? new Date(endDate) : null;
    if (start) start.setHours(0, 0, 0, 0);
    if (end) end.setHours(23, 59, 59, 999);

    return allTransactions.filter(tx => {
      if (selectedType !== 'Всі' && tx.type !== selectedType) return false;
      if (selectedAccounts.length > 0 && !selectedAccounts.includes(tx.account)) return false;
      if (selectedCategories.length > 0 && !selectedCategories.includes(tx.category)) return false;
      const txDate = parseDate(tx.date);
      if (!txDate) return false;
      if (start && txDate < start) return false;
      if (end && txDate > end) return false;
      return true;
    });
  }, [allTransactions, startDate, endDate, selectedAccounts, selectedCategories, selectedType]);

  // --- Обробники змін фільтрів ---
   const handleAccountChange = useCallback((account: string) => {
       setSelectedAccounts(prev => prev.includes(account) ? prev.filter(a => a !== account) : [...prev, account]);
   }, []);
    const handleSelectAllAccounts = useCallback(() => {
        setSelectedAccounts(prev => prev.length === accounts.length ? [] : accounts);
    }, [accounts]);
   const handleCategoryChange = useCallback((category: string) => {
       setSelectedCategories(prev => prev.includes(category) ? prev.filter(c => c !== category) : [...prev, category]);
   }, []);
   const handleSelectAllCategories = useCallback(() => {
        setSelectedCategories(prev => prev.length === categories.length ? [] : categories.map(c => c.name));
   }, [categories]);


  // --- РЕНДЕР КОМПОНЕНТА ---
  return (
    <div>
      <h1 className="text-xl font-semibold mb-4">Транзакції</h1>

      {/* --- ФІЛЬТРИ (З ОНОВЛЕНИМИ СТИЛЯМИ) --- */}
       <div className="mb-6 p-4 border rounded bg-gray-50 flex flex-wrap gap-4 items-start"> {/* Використовуємо flex для кращого контролю */}

         {/* Фільтр Дат */}
         <div className="flex flex-col sm:flex-row gap-2 flex-grow basis-full sm:basis-1/3 lg:basis-auto"> {/* Адаптивна ширина */}
           <div className='flex-1 min-w-[130px]'>
             <label htmlFor="startDate" className="block text-xs font-medium text-gray-600 mb-1">Період Від</label>
             <input
               id="startDate"
               type="date"
               value={startDate}
               onChange={(e) => setStartDate(e.target.value)}
               className="w-full p-2 border border-gray-300 rounded text-sm shadow-sm focus:ring-blue-500 focus:border-blue-500"
             />
           </div>
           <div className='flex-1 min-w-[130px]'>
             <label htmlFor="endDate" className="block text-xs font-medium text-gray-600 mb-1">Період До</label>
             <input
               id="endDate"
               type="date"
               value={endDate}
               onChange={(e) => setEndDate(e.target.value)}
               className="w-full p-2 border border-gray-300 rounded text-sm shadow-sm focus:ring-blue-500 focus:border-blue-500"
             />
           </div>
         </div>

         {/* Фільтр Типу */}
         <div className="flex-shrink-0">
            <label className="block text-xs font-medium text-gray-600 mb-1">Тип</label>
            <div className="flex rounded border border-gray-300 overflow-hidden shadow-sm">
              {(['Всі', 'Надходження', 'Витрата'] as const).map((type, index) => (
                 <button
                    key={type}
                    onClick={() => setSelectedType(type)}
                    className={`px-3 py-2 text-sm transition-colors duration-150 ease-in-out
                               ${selectedType === type ? 'bg-blue-600 text-white' : 'bg-white text-gray-700 hover:bg-gray-50'}
                               ${index > 0 ? 'border-l border-gray-300' : ''}`}
                 >
                    {type}
                 </button>
              ))}
            </div>
         </div>

         {/* Фільтр Рахунків */}
         <div className="flex-shrink-0 w-48">
             <div className="flex justify-between items-center mb-1">
                 <label className="block text-xs font-medium text-gray-600">Рахунки</label>
                 <button onClick={handleSelectAllAccounts} className="text-xs text-blue-600 hover:underline">
                     {accounts.length > 0 && selectedAccounts.length === accounts.length ? 'Зняти всі' : 'Вибрати всі'}
                 </button>
             </div>
             <div className="max-h-32 overflow-y-auto border rounded p-2 bg-white space-y-1 shadow-sm">
                 {isLoading ? <p className="text-xs text-gray-400 p-1">Завантаження...</p> :
                  Array.isArray(accounts) && accounts.length > 0 ? accounts.map(acc => (
                     <div key={acc} className="flex items-center">
                         <input
                             type="checkbox"
                             id={`acc-${acc}`}
                             checked={selectedAccounts.includes(acc)}
                             onChange={() => handleAccountChange(acc)}
                             className="h-4 w-4 text-blue-600 border-gray-300 rounded mr-2 focus:ring-blue-500"
                         />
                         <label htmlFor={`acc-${acc}`} className="text-xs text-gray-700 select-none cursor-pointer">{acc}</label>
                     </div>
                 )) : <p className="text-xs text-gray-400 p-1">Немає рахунків</p>
                 }
             </div>
         </div>

         {/* Фільтр Категорій */}
          <div className="flex-shrink-0 w-48">
             <div className="flex justify-between items-center mb-1">
                 <label className="block text-xs font-medium text-gray-600">Категорії</label>
                  <button onClick={handleSelectAllCategories} className="text-xs text-blue-600 hover:underline">
                    {categories.length > 0 && selectedCategories.length === categories.length ? 'Зняти всі' : 'Вибрати всі'}
                  </button>
             </div>
             <div className="max-h-32 overflow-y-auto border rounded p-2 bg-white space-y-1 shadow-sm">
                 {isLoading ? <p className="text-xs text-gray-400 p-1">Завантаження...</p> :
                  Array.isArray(categories) && categories.length > 0 ? categories.map(cat => (
                     <div key={cat.name} className="flex items-center">
                         <input
                             type="checkbox"
                             id={`cat-${cat.name}`}
                             checked={selectedCategories.includes(cat.name)}
                             onChange={() => handleCategoryChange(cat.name)}
                             className="h-4 w-4 text-blue-600 border-gray-300 rounded mr-2 focus:ring-blue-500"
                         />
                         <label htmlFor={`cat-${cat.name}`} className="text-xs text-gray-700 select-none cursor-pointer">{cat.name} ({cat.type === 'Надходження' ? 'Н' : 'В'})</label>
                     </div>
                 )) : <p className="text-xs text-gray-400 p-1">Немає категорій</p>
                 }
             </div>
          </div>

      </div>
      {/* --- Кінець ФІЛЬТРІВ --- */}


      {/* --- Таблиця транзакцій --- */}
      {isLoading && <p className="mt-4">Завантаження транзакцій...</p>}
      {error && <p className="mt-4 text-red-600">Помилка завантаження: {error}</p>}

      {!isLoading && !error && (
        <div className="overflow-x-auto mt-4">
           <table className="min-w-full divide-y divide-gray-200">
             <thead className="bg-gray-50">
               <tr>
                 <th scope="col" className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Дата</th>
                 <th scope="col" className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Рахунок</th>
                 <th scope="col" className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Категорія</th>
                 <th scope="col" className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Опис</th>
                 <th scope="col" className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Сума</th>
               </tr>
             </thead>
             <tbody className="bg-white divide-y divide-gray-200">
               {filteredTransactions.length === 0 ? (
                 <tr>
                     <td colSpan={5} className="px-4 py-4 text-center text-gray-500">Транзакцій за обраними фільтрами не знайдено</td>
                 </tr>
               ) : (
                 filteredTransactions.map((tx, index) => (
                   <tr key={`${tx.date}-${tx.account}-${tx.amount}-${index}`} className={`${tx.type === 'Витрата' ? 'bg-red-50 hover:bg-red-100' : 'bg-green-50 hover:bg-green-100'} transition-colors duration-150 ease-in-out`}>
                     <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-900">{tx.date}</td>
                     <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-500">{tx.account}</td>
                     <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-500">{tx.category}</td>
                     <td className="px-4 py-2 text-sm text-gray-500">{tx.description}</td>
                     <td className={`px-4 py-2 whitespace-nowrap text-sm text-right font-medium ${tx.type === 'Витрата' ? 'text-red-600' : 'text-green-600'}`}>
                       {tx.type === 'Витрата' ? '-' : '+'} {formatNumber(tx.amount)} ₴
                     </td>
                   </tr>
                 ))
               )}
             </tbody>
           </table>
        </div>
      )}
      {/* --- Кінець Таблиці --- */}
    </div>
  );
};

export default TransactionsPage;
