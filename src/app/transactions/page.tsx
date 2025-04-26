'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
    ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend
} from 'recharts';

// --- Типи даних ---
interface Transaction { date: string | null; amount: number; type: string; account: string; category: string; description: string;}
interface CategoryInfo { name: string; type: string; }
interface MonthlyChartData { name: string; income: number; expense: number; balance: number; incomeDetails: { [category: string]: number }; expenseDetails: { [category: string]: number }; balanceDetails: { [account: string]: number }; }
interface BalanceDetails { [account: string]: number; }

// --- Хелпери ---
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
const formatDateForInput = (date: Date): string => {
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    return `${year}-${month}-${day}`;
};

const TransactionsPage: React.FC = () => {
    // --- Стан ---
    const [allTransactions, setAllTransactions] = useState<Transaction[]>([]);
    const [accounts, setAccounts] = useState<string[]>([]);
    const [categories, setCategories] = useState<CategoryInfo[]>([]);
    const [isLoading, setIsLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);
    const getInitialDates = () => { const today = new Date(); const firstDay = new Date(today.getFullYear(), today.getMonth(), 1); const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0); return { start: formatDateForInput(firstDay), end: formatDateForInput(lastDay) } }
    const initialDates = getInitialDates();
    const [startDate, setStartDate] = useState<string>(initialDates.start);
    const [endDate, setEndDate] = useState<string>(initialDates.end);
    const [selectedAccounts, setSelectedAccounts] = useState<string[]>([]);
    const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
    const [selectedType, setSelectedType] = useState<string>('Всі');

    // --- Завантаження даних ---
    useEffect(() => {
        const fetchData = async () => {
           setIsLoading(true); setError(null);
           try {
             const response = await fetch('/api/sheet-data');
             if (!response.ok) { throw new Error(`HTTP error! status: ${response.status}`); }
             const data = await response.json();
             if (!Array.isArray(data.transactions) || !Array.isArray(data.accounts) || !Array.isArray(data.categories)) { throw new Error("Invalid data structure."); }
             setAllTransactions(data.transactions);
             setAccounts(data.accounts);
             setCategories(data.categories);
           } catch (err) { setError(err instanceof Error ? err.message : 'An unknown error occurred.'); console.error(err); }
           finally { setIsLoading(false); }
        };
        fetchData();
     }, []);

    // --- Обробники фільтрів ---
    const handleAccountChange = useCallback((account: string) => { setSelectedAccounts(prev => prev.includes(account) ? prev.filter(a => a !== account) : [...prev, account]); }, []);
    const handleSelectAllAccounts = useCallback(() => { setSelectedAccounts(prev => prev.length === accounts.length ? [] : accounts); }, [accounts]);
    const handleCategoryChange = useCallback((category: string) => { setSelectedCategories(prev => prev.includes(category) ? prev.filter(c => c !== category) : [...prev, category]); }, []);

    // Повна функція для кнопок швидкого вибору періоду
    const setDateRangePreset = useCallback((preset: 'month' | 'quarter' | 'year') => {
        const today = new Date();
        const endDate = new Date(today); // Кінець - сьогодні
        let startDate = new Date(today);
        let daysToSubtract = 30; // Default to month

        if (preset === 'quarter') {
            daysToSubtract = 90;
        } else if (preset === 'year') {
            daysToSubtract = 365;
        }

        startDate.setDate(today.getDate() - daysToSubtract);

        setStartDate(formatDateForInput(startDate));
        setEndDate(formatDateForInput(endDate));
    }, []); // Залежностей немає

    // === ОБРОБКА ДАНИХ ДЛЯ ГРАФІКА ТА ТАБЛИЦІ ===
    const processedData = useMemo(() => {
        const startFilterDate = startDate ? parseDate(startDate) : null;
        const endFilterDate = endDate ? parseDate(endDate) : null;
        if (startFilterDate) startFilterDate.setUTCHours(0, 0, 0, 0);
        if (endFilterDate) endFilterDate.setUTCHours(23, 59, 59, 999);

        const accountsToConsider = selectedAccounts.length > 0 ? selectedAccounts : accounts;

        // 1. Розрахунок початкового балансу
        const balanceDetailsAtStart: BalanceDetails = {};
        accountsToConsider.forEach(acc => balanceDetailsAtStart[acc] = 0);
        allTransactions.forEach(tx => {
            const txDate = parseDate(tx.date);
            const accountMatches = accountsToConsider.includes(tx.account);
            if (txDate && accountMatches && (!startFilterDate || txDate < startFilterDate)) {
                balanceDetailsAtStart[tx.account] = (balanceDetailsAtStart[tx.account] || 0) + (tx.type === 'Надходження' ? tx.amount : -tx.amount);
            }
        });

        // 2. Фільтруємо транзакції для таблиці ТА графіка
        const filteredTransactionsForPeriod = allTransactions.filter(tx => {
            if (selectedType !== 'Всі' && tx.type !== selectedType) return false;
            if (selectedAccounts.length > 0 && !selectedAccounts.includes(tx.account)) return false;
            if (selectedCategories.length > 0 && !selectedCategories.includes(tx.category)) return false;
            const txDate = parseDate(tx.date);
            if (!txDate) return false;
            if (startFilterDate && txDate < startFilterDate) return false;
            if (endFilterDate && txDate > endFilterDate) return false;
            return true;
        });

        // 3. Генеруємо список ВСІХ місяців у діапазоні
        const allMonthsInRange: { key: string; name: string }[] = [];
        if (startFilterDate && endFilterDate && startFilterDate <= endFilterDate) {
            let currentMonth = new Date(Date.UTC(startFilterDate.getUTCFullYear(), startFilterDate.getUTCMonth(), 1));
            while (currentMonth <= endFilterDate) {
                const monthYearKey = `${currentMonth.getUTCFullYear()}-${(currentMonth.getUTCMonth() + 1).toString().padStart(2, '0')}`;
                const monthName = currentMonth.toLocaleString('uk-UA', { month: 'short', year: 'numeric', timeZone: 'UTC' });
                allMonthsInRange.push({ key: monthYearKey, name: monthName });
                 if (currentMonth.getUTCMonth() === 11) { currentMonth = new Date(Date.UTC(currentMonth.getUTCFullYear() + 1, 0, 1)); }
                 else { currentMonth.setUTCMonth(currentMonth.getUTCMonth() + 1); }
            }
        }

        // 4. Групуємо відфільтровані транзакції по місяцях
        const monthlyActivityMap: { [monthYear: string]: Omit<MonthlyChartData, 'balance' | 'name' | 'balanceDetails'> & { balanceChangeDetails: BalanceDetails } } = {};
        allMonthsInRange.forEach(monthInfo => {
             monthlyActivityMap[monthInfo.key] = { income: 0, expense: 0, incomeDetails: {}, expenseDetails: {}, balanceChangeDetails: {} };
             accountsToConsider.forEach(acc => { monthlyActivityMap[monthInfo.key].balanceChangeDetails[acc] = 0; });
        });
        filteredTransactionsForPeriod.forEach(tx => {
            const txDate = parseDate(tx.date);
            if (txDate) {
                const monthYear = `${txDate.getUTCFullYear()}-${(txDate.getUTCMonth() + 1).toString().padStart(2, '0')}`;
                if (monthlyActivityMap[monthYear]) {
                    const monthEntry = monthlyActivityMap[monthYear];
                    const category = tx.category; const account = tx.account; const amountChange = (tx.type === 'Надходження' ? tx.amount : -tx.amount);
                    if (tx.type === 'Надходження') { monthEntry.income += tx.amount; monthEntry.incomeDetails[category] = (monthEntry.incomeDetails[category] || 0) + tx.amount; }
                    else if (tx.type === 'Витрата') { monthEntry.expense += tx.amount; monthEntry.expenseDetails[category] = (monthEntry.expenseDetails[category] || 0) + tx.amount; }
                    if (accountsToConsider.includes(account)) { monthEntry.balanceChangeDetails[account] = (monthEntry.balanceChangeDetails[account] || 0) + amountChange; }
                }
            }
        });

        // 5. Розраховуємо наростаючий баланс
        const runningBalanceDetails = { ...balanceDetailsAtStart };
        const barChartData: MonthlyChartData[] = allMonthsInRange.map(monthInfo => {
            const activity = monthlyActivityMap[monthInfo.key];
            const balanceChanges = activity.balanceChangeDetails;
            Object.keys(balanceChanges).forEach(account => { runningBalanceDetails[account] = (runningBalanceDetails[account] || 0) + balanceChanges[account]; });
            const endOfMonthBalance = Object.values(runningBalanceDetails).reduce((sum, bal) => sum + bal, 0);
            return { name: monthInfo.name, income: activity.income, expense: activity.expense, balance: endOfMonthBalance, incomeDetails: activity.incomeDetails, expenseDetails: activity.expenseDetails, balanceDetails: { ...runningBalanceDetails } };
        });

        return { filteredTransactions: filteredTransactionsForPeriod, barChartData };

    }, [allTransactions, startDate, endDate, selectedAccounts, selectedCategories, selectedType, accounts]);
    // --- Кінець ОБРОБКИ ДАНИХ ---


    // --- Компонент для Кастомної Підказки (Tooltip) ---
    // Залишаємо ВИМКНЕНИМ поки що
    // const CustomTooltip = ({ active, payload, label }: any) => { /* ... */ };


    // --- РЕНДЕР КОМПОНЕНТА ---
    return (
        <div>
          {/* --- ФІЛЬТРИ (ВИПРАВЛЕНО ВИКЛИКИ КНОПОК ПЕРІОДУ) --- */}
          <div className="mb-6 p-4 border rounded bg-gray-50 space-y-4">
               {/* --- Перший Рядок Фільтрів --- */}
               <div className="grid grid-cols-1 md:grid-cols-3 gap-x-4 gap-y-3 items-end">
                   {/* Колонка 1: Дати */}
                   <div className="flex flex-col sm:flex-row gap-2 md:col-span-1">
                       <div className='flex-1 min-w-[130px]'>
                           <label htmlFor="trans-startDate" className="block text-xs font-medium text-gray-600 mb-1">Період Від</label>
                           <input id="trans-startDate" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="w-full p-1.5 border border-gray-300 rounded text-sm shadow-sm focus:ring-1 focus:ring-blue-500 focus:border-blue-500"/>
                       </div>
                       <div className='flex-1 min-w-[130px]'>
                           <label htmlFor="trans-endDate" className="block text-xs font-medium text-gray-600 mb-1">Період До</label>
                           <input id="trans-endDate" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="w-full p-1.5 border border-gray-300 rounded text-sm shadow-sm focus:ring-1 focus:ring-blue-500 focus:border-blue-500"/>
                       </div>
                   </div>

                   {/* Колонка 2: Швидкі Періоди */}
                   <div className="md:col-span-1">
                       <label className="block text-xs font-medium text-gray-600 mb-1 invisible">Швидкі Періоди</label>
                       <div className="flex space-x-2">
                            {/* ВИПРАВЛЕНО: передаємо рядки 'month', 'quarter', 'year' */}
                           <button onClick={() => setDateRangePreset('month')} className="flex-1 px-2 py-1.5 text-xs border border-gray-300 rounded bg-white hover:bg-gray-50 shadow-sm">Місяць</button>
                           <button onClick={() => setDateRangePreset('quarter')} className="flex-1 px-2 py-1.5 text-xs border border-gray-300 rounded bg-white hover:bg-gray-50 shadow-sm">Квартал</button>
                           <button onClick={() => setDateRangePreset('year')} className="flex-1 px-2 py-1.5 text-xs border border-gray-300 rounded bg-white hover:bg-gray-50 shadow-sm">Рік</button>
                       </div>
                   </div>

                   {/* Колонка 3: Тип */}
                   <div className="md:col-span-1">
                      <label className="block text-xs font-medium text-gray-600 mb-1">Тип</label>
                      <div className="flex rounded border border-gray-300 overflow-hidden shadow-sm">
                        {(['Всі', 'Надходження', 'Витрата'] as const).map((type, index) => (
                            <button
                               key={type}
                               onClick={() => setSelectedType(type)}
                               className={`flex-1 px-2 py-1.5 text-sm text-center transition-colors duration-150 ease-in-out ${selectedType === type ? 'bg-blue-600 text-white' : 'bg-white text-gray-700 hover:bg-gray-100'} ${index > 0 ? 'border-l border-gray-300' : ''}`}
                           > {type} </button>
                        ))}
                      </div>
                   </div>
               </div>

                {/* --- Другий Рядок Фільтрів --- */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-start pt-2">
                    {/* Колонка 1: Рахунки */}
                    <div>
                       <div className="flex justify-between items-center mb-1">
                           <label className="block text-sm font-medium text-gray-700">Рахунки</label>
                           <button onClick={handleSelectAllAccounts} className="text-xs text-blue-600 hover:underline">
                               {accounts.length > 0 && selectedAccounts.length === accounts.length ? 'Зняти всі' : 'Вибрати всі'}
                           </button>
                       </div>
                       <div className="border rounded p-2 bg-white space-y-1 shadow-sm">
                          {/* Повний список рахунків */}
                          {isLoading ? <p className="text-xs text-gray-400 p-1">Завантаження...</p> : Array.isArray(accounts) && accounts.length > 0 ? accounts.map(acc => ( <div key={acc} className="flex items-center"> <input type="checkbox" id={`trans-acc-${acc}`} checked={selectedAccounts.includes(acc)} onChange={() => handleAccountChange(acc)} className="h-3.5 w-3.5 text-blue-600 border-gray-300 rounded mr-1.5 focus:ring-blue-500 focus:ring-offset-0"/> <label htmlFor={`trans-acc-${acc}`} className="text-xs text-gray-800 select-none cursor-pointer">{acc}</label> </div> )) : <p className="text-xs text-gray-400 p-1">Немає рахунків</p>}
                       </div>
                   </div>

                   {/* Колонка 2: Категорії Надходжень */}
                   <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Категорії (Надходження)</label>
                        <div className="border rounded p-2 bg-white space-y-1 shadow-sm">
                           {/* Повний список категорій надходжень */}
                          {isLoading ? <p className="text-xs text-gray-400 p-1">Завантаження...</p> : Array.isArray(categories) && categories.length > 0 ? categories.filter(cat => cat.type === 'Надходження').map(cat => ( <div key={cat.name} className="flex items-center"> <input type="checkbox" id={`trans-cat-${cat.name}`} checked={selectedCategories.includes(cat.name)} onChange={() => handleCategoryChange(cat.name)} className="h-3.5 w-3.5 text-blue-600 border-gray-300 rounded mr-1.5 focus:ring-blue-500 focus:ring-offset-0"/> <label htmlFor={`trans-cat-${cat.name}`} className="text-xs text-gray-800 select-none cursor-pointer">{cat.name}</label> </div> )) : <p className="text-xs text-gray-400 p-1">Немає категорій</p>}
                          {!isLoading && categories.filter(cat => cat.type === 'Надходження').length === 0 && (<p className="text-xs text-gray-400 p-1">Немає категорій надходжень</p>)}
                        </div>
                   </div>

                   {/* Колонка 3: Категорії Витрат */}
                   <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Категорії (Витрати)</label>
                        <div className="border rounded p-2 bg-white space-y-1 shadow-sm">
                           {/* Повний список категорій витрат */}
                          {isLoading ? <p className="text-xs text-gray-400 p-1">Завантаження...</p> : Array.isArray(categories) && categories.length > 0 ? categories.filter(cat => cat.type === 'Витрата').map(cat => ( <div key={cat.name} className="flex items-center"> <input type="checkbox" id={`trans-cat-${cat.name}`} checked={selectedCategories.includes(cat.name)} onChange={() => handleCategoryChange(cat.name)} className="h-3.5 w-3.5 text-blue-600 border-gray-300 rounded mr-1.5 focus:ring-blue-500 focus:ring-offset-0"/> <label htmlFor={`trans-cat-${cat.name}`} className="text-xs text-gray-800 select-none cursor-pointer">{cat.name}</label> </div> )) : <p className="text-xs text-gray-400 p-1">Немає категорій</p>}
                          {!isLoading && categories.filter(cat => cat.type === 'Витрата').length === 0 && (<p className="text-xs text-gray-400 p-1">Немає категорій витрат</p>)}
                        </div>
                   </div>

                </div>
          </div>
          {/* --- Кінець ФІЛЬТРІВ --- */}


          {/* --- Графік --- */}
          {isLoading && <p className="mt-6 text-center">Завантаження звіту...</p>}
          {error && <p className="mt-6 text-red-600 text-center">Помилка завантаження звіту: {error}</p>}
          {!isLoading && !error && (
               <div className="p-4 border rounded shadow bg-white mb-6 min-h-[400px]">
                   <h2 className="text-lg font-semibold mb-4 text-center">Динаміка за Період</h2>
                   {processedData.barChartData.length > 0 ? (
                      <ResponsiveContainer width="100%" height={350}>
                         <BarChart data={processedData.barChartData} margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
                           <CartesianGrid strokeDasharray="3 3" />
                           <XAxis dataKey="name" fontSize={12} />
                           <YAxis tickFormatter={(value) => formatNumber(value)} fontSize={12} width={70}/>
                           {/* ВИМКНУЛИ КАСТОМНИЙ TOOLTIP, використовуємо стандартний */}
                           <Tooltip
                                cursor={{ fill: 'rgba(206, 212, 218, 0.3)' }}
                                formatter={(value: number, name: string) => [`${formatNumber(value)} ₴`, name === 'income' ? 'Надходження' : name === 'expense' ? 'Витрати' : 'Баланс (кінець міс.)']}
                           />
                           {/* <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(206, 212, 218, 0.3)' }}/> */}
                           <Legend wrapperStyle={{fontSize: "12px"}}/>
                           <Bar dataKey="income" fill="#00C49F" name="Надходження" radius={[4, 4, 0, 0]} />
                           <Bar dataKey="expense" fill="#FF8042" name="Витрати" radius={[4, 4, 0, 0]} />
                           <Bar dataKey="balance" fill="#8884D8" name="Баланс (кінець міс.)" radius={[4, 4, 0, 0]} />
                         </BarChart>
                      </ResponsiveContainer>
                   ) : ( <p className="text-center text-gray-500 pt-10">Немає даних для відображення звіту за обраними фільтрами.</p> )}
              </div>
          )}
          {/* --- Кінець Графіка --- */}


          {/* --- Таблиця транзакцій --- */}
          {isLoading && <p className="mt-4 text-center">Завантаження транзакцій...</p>}
          {!isLoading && !error && (
              <div className="overflow-x-auto mt-4">
                 {/* Додано text-center */}
                 <h2 className="text-lg font-semibold mb-2 text-center">Детальні Транзакції за Період</h2>
                 <table className="min-w-full divide-y divide-gray-200">
                   <thead className="bg-gray-50">
                     <tr>
                       <th scope="col" className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Дата</th>
                       <th scope="col" className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Сума</th>
                       <th scope="col" className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Опис</th>
                       <th scope="col" className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Категорія</th>
                       <th scope="col" className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Рахунок</th>
                     </tr>
                   </thead>
                   <tbody className="bg-white divide-y divide-gray-200">
                     {processedData.filteredTransactions.length === 0 ? (
                       <tr> <td colSpan={5} className="px-4 py-4 text-center text-gray-500">Транзакцій за обраними фільтрами не знайдено</td> </tr>
                     ) : (
                       processedData.filteredTransactions.map((tx, index) => (
                         <tr key={`${tx.date}-${index}-${tx.amount}`} className={`${tx.type === 'Витрата' ? 'bg-red-50 hover:bg-red-100' : 'bg-green-50 hover:bg-green-100'} transition-colors duration-150 ease-in-out`}>
                           <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-900">{tx.date}</td>
                           <td className={`px-4 py-2 whitespace-nowrap text-sm text-right font-medium ${tx.type === 'Витрата' ? 'text-[#FF8042]' : 'text-[#00C49F]'}`}>
                             {tx.type === 'Витрата' ? '-' : '+'} {formatNumber(tx.amount)} ₴
                           </td>
                           <td className="px-4 py-2 text-sm text-gray-500 max-w-[200px] truncate">{tx.description}</td>
                           <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-500">{tx.category}</td>
                           <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-500">{tx.account}</td>
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
