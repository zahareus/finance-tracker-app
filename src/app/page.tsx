'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react'; // Додали useCallback

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
    return num.toLocaleString('uk-UA', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};
const parseDate = (dateString: string | null): Date | null => {
    if (!dateString) return null;
    const parts = dateString.split('.');
    if (parts.length === 3) {
        const date = new Date(+parts[2], +parts[1] - 1, +parts[0]);
        if (!isNaN(date.getTime())) { return date; }
    }
    // Спробуємо розпізнати формат YYYY-MM-DD (який використовує input type="date")
    const isoParts = dateString.split('-');
     if (isoParts.length === 3) {
        const date = new Date(+isoParts[0], +isoParts[1] - 1, +isoParts[2]);
         if (!isNaN(date.getTime())) { return date; }
     }
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
  // Встановлюємо початкові значення для дат (наприклад, поточний місяць)
  const getInitialDates = () => {
      const today = new Date();
      const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
      const lastDayOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0); // Останній день місяця
      const formatDate = (date: Date) => date.toISOString().split('T')[0]; // Формат YYYY-MM-DD

      return {
          start: formatDate(firstDayOfMonth),
          end: formatDate(lastDayOfMonth)
      }
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
      // ... (код завантаження даних залишається таким самим) ...
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


  // --- ЛОГІКА ФІЛЬТРАЦІЇ (залишається такою самою) ---
  const filteredTransactions = useMemo(() => {
    const start = startDate ? new Date(startDate) : null;
    const end = endDate ? new Date(endDate) : null;
    if (start) start.setHours(0, 0, 0, 0);
    if (end) end.setHours(23, 59, 59, 999);

    return allTransactions.filter(tx => {
      if (selectedType !== 'Всі' && tx.type !== selectedType) return false;
      if (selectedAccounts.length > 0 && !selectedAccounts.includes(tx.account)) return false;
      if (selectedCategories.length > 0 && !selectedCategories.includes(tx.category)) return false;
      const txDate = parseDate(tx.date); // Використовуємо оновлений parseDate
      if (!txDate) return false;
      if (start && txDate < start) return false;
      if (end && txDate > end) return false;
      return true;
    });
  }, [allTransactions, startDate, endDate, selectedAccounts, selectedCategories, selectedType]);

  // --- Обробники змін фільтрів ---
  const handleAccountChange = useCallback((account: string) => {
      setSelectedAccounts(prev =>
          prev.includes(account)
              ? prev.filter(a => a !== account) // Видалити, якщо вже вибрано
              : [...prev, account] // Додати, якщо не вибрано
      );
  }, []);

   const handleSelectAllAccounts = useCallback(() => {
       if (selectedAccounts.length === accounts.length) {
           setSelectedAccounts([]); // Deselect all
       } else {
           setSelectedAccounts(accounts); // Select all
       }
   }, [accounts, selectedAccounts]);

  const handleCategoryChange = useCallback((category: string) => {
      setSelectedCategories(prev =>
          prev.includes(category)
              ? prev.filter(c => c !== category)
              : [...prev, category]
      );
  }, []);

  const handleSelectAllCategories = useCallback(() => {
       if (selectedCategories.length === categories.length) {
           setSelectedCategories([]); // Deselect all
       } else {
           setSelectedCategories(categories.map(c => c.name)); // Select all
       }
  }, [categories, selectedCategories]);
  // --- Кінець обробників ---


  // --- РЕНДЕР КОМПОНЕНТА ---
  return (
    <div>
      <h1 className="text-xl font-semibold mb-4">Транзакції</h1>

      {/* --- ФІЛЬТРИ --- */}
      <div className="mb-4 p-4 border rounded bg-gray-50 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">

        {/* Фільтр Дат */}
        <div className="col-span-1 md:col-span-2 lg:col-span-1">
          <label className="block text-sm font-medium text-gray-700 mb-1">Період</label>
          <div className="flex space-x-2">
             <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full p-1 border border-gray-300 rounded text-sm"
             />
             <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full p-1 border border-gray-300 rounded text-sm"
             />
          </div>
           {/* Можна додати кнопки швидкого вибору періоду пізніше */}
        </div>

        {/* Фільтр Типу */}
        <div className="col-span-1">
           <label className="block text-sm font-medium text-gray-700 mb-1">Тип</label>
           <div className="flex space-x-2">
             {(['Всі', 'Надходження', 'Витрата'] as const).map(type => (
                <button
                   key={type}
                   onClick={() => setSelectedType(type)}
                   className={`px-3 py-1 rounded text-sm ${selectedType === type ? 'bg-blue-600 text-white' : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'}`}
                >
                   {type}
                </button>
             ))}
           </div>
        </div>

        {/* Фільтр Рахунків */}
        <div className="col-span-1">
            <label className="block text-sm font-medium text-gray-700 mb-1">Рахунки</label>
            <button onClick={handleSelectAllAccounts} className="text-xs text-blue-600 hover:underline mb-1">
               {selectedAccounts.length === accounts.length ? 'Зняти всі' : 'Вибрати всі'}
            </button>
            <div className="max-h-24 overflow-y-auto border rounded p-1 bg-white"> {/* Обмежуємо висоту та додаємо скрол */}
                {accounts.map(acc => (
                    <div key={acc} className="flex items-center">
                        <input
                            type="checkbox"
                            id={`acc-${acc}`}
                            checked={selectedAccounts.includes(acc)}
                            onChange={() => handleAccountChange(acc)}
                            className="h-4 w-4 text-blue-600 border-gray-300 rounded mr-2"
                        />
                        <label htmlFor={`acc-${acc}`} className="text-sm text-gray-700">{acc}</label>
                    </div>
                ))}
            </div>
        </div>

        {/* Фільтр Категорій */}
         <div className="col-span-1">
            <label className="block text-sm font-medium text-gray-700 mb-1">Категорії</label>
             <button onClick={handleSelectAllCategories} className="text-xs text-blue-600 hover:underline mb-1">
               {selectedCategories.length === categories.length ? 'Зняти всі' : 'Вибрати всі'}
             </button>
            <div className="max-h-24 overflow-y-auto border rounded p-1 bg-white">
                {categories.map(cat => (
                    <div key={cat.name} className="flex items-center">
                        <input
                            type="checkbox"
                            id={`cat-${cat.name}`}
                            checked={selectedCategories.includes(cat.name)}
                            onChange={() => handleCategoryChange(cat.name)}
                            className="h-4 w-4 text-blue-600 border-gray-300 rounded mr-2"
                        />
                        <label htmlFor={`cat-${cat.name}`} className="text-sm text-gray-700">{cat.name} ({cat.type === 'Надходження' ? 'Н' : 'В'})</label> {/* Додали тип */}
                    </div>
                ))}
            </div>
         </div>

      </div>
      {/* --- Кінець ФІЛЬТРІВ --- */}


      {/* --- Таблиця транзакцій --- */}
      {isLoading && <p>Завантаження транзакцій...</p>}
      {error && <p className="text-red-600">Помилка завантаження: {error}</p>}

      {!isLoading && !error && (
        <div className="overflow-x-auto">
          {/* ... (код таблиці залишається таким самим, він вже використовує filteredTransactions) ... */}
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
                   <tr key={index} className={`${tx.type === 'Витрата' ? 'bg-red-50 hover:bg-red-100' : 'bg-green-50 hover:bg-green-100'} transition-colors duration-150 ease-in-out`}> {/* Додав hover ефекти */}
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
