'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
// Імпорти з бібліотеки Recharts
import {
    ResponsiveContainer, PieChart, Pie, Cell, Tooltip, Legend, LineChart, Line, XAxis, YAxis, CartesianGrid
} from 'recharts';

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

// **ВИПРАВЛЕНА** функція parseDate
const parseDate = (dateString: string | null): Date | null => {
    if (!dateString) return null;
    let parts = dateString.split('-');
    if (parts.length === 3) {
        const date = new Date(Date.UTC(+parts[0], +parts[1] - 1, +parts[2]));
        if (!isNaN(date.getTime())) { return date; }
    }
    parts = dateString.split('.');
    if (parts.length === 3) {
        const date = new Date(Date.UTC(+parts[2], +parts[1] - 1, +parts[0]));
        if (!isNaN(date.getTime())) { return date; }
    }
    // Додано відсутній return null;
    return null;
};

// Функція форматування дати в YYYY-MM-DD
const formatDateForInput = (date: Date) => {
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    return `${year}-${month}-${day}`;
};
// --- Кінець хелперів ---

// Кольори для кругової діаграми (можна налаштувати)
const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8', '#82ca9d', '#ffc658', '#ff7300', '#d0ed57', '#a4de6c'];

const ReportsPage: React.FC = () => {
    // --- Стан для даних та фільтрів ---
    const [allTransactions, setAllTransactions] = useState<Transaction[]>([]);
    const [accounts, setAccounts] = useState<string[]>([]);
    // const [categories, setCategories] = useState<CategoryInfo[]>([]); // Не використовується напряму тут, але може знадобитись
    const [isLoading, setIsLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);

    // Функція і стан для дат
    const getInitialDates = () => {
      const today = new Date();
      const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
      const lastDayOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);
      return { start: formatDateForInput(firstDayOfMonth), end: formatDateForInput(lastDayOfMonth) }
    }
    const initialDates = getInitialDates();
    const [startDate, setStartDate] = useState<string>(initialDates.start);
    const [endDate, setEndDate] = useState<string>(initialDates.end);
    const [selectedAccounts, setSelectedAccounts] = useState<string[]>([]);


    // --- Завантаження даних ---
    useEffect(() => {
        const fetchData = async () => {
           setIsLoading(true); setError(null);
           try {
             const response = await fetch('/api/sheet-data');
             if (!response.ok) { /* Обробка помилки */ throw new Error(`HTTP error! status: ${response.status}`); }
             const data = await response.json();
             if (!Array.isArray(data.transactions) || !Array.isArray(data.accounts) || !Array.isArray(data.categories)) { throw new Error("Invalid data structure received."); }
             setAllTransactions(data.transactions);
             setAccounts(data.accounts);
             // setCategories(data.categories); // Розкоментуй, якщо категорії знадобляться
           } catch (err) { setError(err instanceof Error ? err.message : 'An unknown error occurred.'); }
           finally { setIsLoading(false); }
        };
        fetchData();
    }, []);

    // --- Обробники фільтрів ---
    const handleAccountChange = useCallback((account: string) => { setSelectedAccounts(prev => prev.includes(account) ? prev.filter(a => a !== account) : [...prev, account]); }, []);
    const handleSelectAllAccounts = useCallback(() => { setSelectedAccounts(prev => prev.length === accounts.length ? [] : accounts); }, [accounts]);

    // --- ОБРОБКА ДАНИХ ДЛЯ ГРАФІКІВ ---
    const chartData = useMemo(() => {
        const start = startDate ? parseDate(startDate) : null;
        const end = endDate ? parseDate(endDate) : null;
        if (start) start.setUTCHours(0, 0, 0, 0);
        if (end) end.setUTCHours(23, 59, 59, 999);

        const relevantTransactions = allTransactions.filter(tx => {
            if (selectedAccounts.length > 0 && !selectedAccounts.includes(tx.account)) return false;
            const txDate = parseDate(tx.date);
            if (!txDate) return false;
            if (start && txDate < start) return false;
            if (end && txDate > end) return false;
            return true;
        });

        // 1. Дані для Pie Chart (Витрати)
        const expenseByCategory: { [category: string]: number } = {};
        relevantTransactions.forEach(tx => {
            if (tx.type === 'Витрата') {
                expenseByCategory[tx.category] = (expenseByCategory[tx.category] || 0) + tx.amount;
            }
        });
        const pieData = Object.entries(expenseByCategory)
                              .map(([name, value]) => ({ name, value }))
                              .sort((a, b) => b.value - a.value);

        // 2. Дані для Line Chart (Динаміка)
        const monthlyData: { [monthYear: string]: { name: string, income: number, expense: number } } = {};
        relevantTransactions.forEach(tx => {
            const txDate = parseDate(tx.date);
            if (txDate) {
                const monthYear = `${txDate.getUTCFullYear()}-${(txDate.getUTCMonth() + 1).toString().padStart(2, '0')}`; // Використовуємо UTC
                if (!monthlyData[monthYear]) {
                     const monthName = txDate.toLocaleString('uk-UA', { month: 'short', year: 'numeric', timeZone: 'UTC' });
                     monthlyData[monthYear] = { name: monthName, income: 0, expense: 0 };
                }
                if (tx.type === 'Надходження') {
                    monthlyData[monthYear].income += tx.amount;
                } else if (tx.type === 'Витрата') {
                    monthlyData[monthYear].expense += tx.amount;
                }
            }
        });
         // Сортування: перетворюємо РРРР-ММ в число для сортування
        const lineData = Object.keys(monthlyData)
                            .sort((a, b) => parseInt(a.replace('-', ''), 10) - parseInt(b.replace('-', ''), 10))
                            .map(key => monthlyData[key]);


        return { pieData, lineData };

    }, [allTransactions, startDate, endDate, selectedAccounts]);
    // --- Кінець ОБРОБКИ ДАНИХ ---


    // --- РЕНДЕР КОМПОНЕНТА ---
    return (
        <div>
            <h1 className="text-xl font-semibold mb-4">Звіти</h1>

             {/* --- Фільтри (Тільки Період і Рахунки) --- */}
            <div className="mb-6 p-4 border rounded bg-gray-50 space-y-4">
                <div className="flex flex-wrap gap-4 items-end">
                     {/* Дати */}
                     <div className="flex flex-col sm:flex-row gap-2 flex-grow basis-full sm:basis-auto">
                         <div className='flex-1 min-w-[130px]'> <label htmlFor="rep-startDate" className="block text-xs font-medium text-gray-600 mb-1">Період Від</label> <input id="rep-startDate" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="w-full p-2 border border-gray-300 rounded text-sm shadow-sm focus:ring-blue-500 focus:border-blue-500"/> </div>
                         <div className='flex-1 min-w-[130px]'> <label htmlFor="rep-endDate" className="block text-xs font-medium text-gray-600 mb-1">Період До</label> <input id="rep-endDate" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="w-full p-2 border border-gray-300 rounded text-sm shadow-sm focus:ring-blue-500 focus:border-blue-500"/> </div>
                     </div>
                      {/* Рахунки */}
                      <div className="flex-shrink-0 w-full sm:w-auto sm:min-w-[200px]">
                         <div className="flex justify-between items-center mb-1"> <label className="block text-xs font-medium text-gray-600">Рахунки</label> <button onClick={handleSelectAllAccounts} className="text-xs text-blue-600 hover:underline"> {accounts.length > 0 && selectedAccounts.length === accounts.length ? 'Зняти всі' : 'Вибрати всі'} </button> </div>
                         <div className="h-32 overflow-y-auto border rounded p-2 bg-white space-y-1 shadow-sm">
                             {isLoading ? <p className="text-xs text-gray-400 p-1">Завантаження...</p> : Array.isArray(accounts) && accounts.length > 0 ? accounts.map(acc => ( <div key={acc} className="flex items-center"> <input type="checkbox" id={`rep-acc-${acc}`} checked={selectedAccounts.includes(acc)} onChange={() => handleAccountChange(acc)} className="h-4 w-4 text-blue-600 border-gray-300 rounded mr-2 focus:ring-blue-500"/> <label htmlFor={`rep-acc-${acc}`} className="text-xs text-gray-700 select-none cursor-pointer">{acc}</label> </div> )) : <p className="text-xs text-gray-400 p-1">Немає рахунків</p>}
                         </div>
                     </div>
                </div>
            </div>
            {/* --- Кінець ФІЛЬТРІВ --- */}


            {/* --- Відображення Графіків --- */}
            {isLoading && <p>Завантаження звітів...</p>}
            {error && <p className="text-red-600">Помилка завантаження: {error}</p>}

            {!isLoading && !error && (
                 <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">

                    {/* Кругова діаграма Витрат */}
                    <div className="p-4 border rounded shadow bg-white min-h-[350px]"> {/* Додав мін. висоту */}
                       <h2 className="text-lg font-semibold mb-3 text-center">Витрати по Категоріях</h2>
                       {chartData.pieData.length > 0 ? (
                           <ResponsiveContainer width="100%" height={300}>
                               <PieChart>
                                   <Pie data={chartData.pieData} cx="50%" cy="50%" labelLine={false} outerRadius={100} fill="#8884d8" dataKey="value" nameKey="name" >
                                       {chartData.pieData.map((entry, index) => ( <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} /> ))}
                                   </Pie>
                                   <Tooltip formatter={(value: number) => `${formatNumber(value)} ₴`} />
                                   <Legend />
                               </PieChart>
                           </ResponsiveContainer>
                       ) : ( <p className="text-center text-gray-500 pt-10">Немає даних про витрати за обраний період.</p> )}
                    </div>

                    {/* Лінійний графік Динаміки */}
                    <div className="p-4 border rounded shadow bg-white min-h-[350px]"> {/* Додав мін. висоту */}
                         <h2 className="text-lg font-semibold mb-3 text-center">Динаміка Надходжень та Витрат</h2>
                         {chartData.lineData.length > 0 ? (
                            <ResponsiveContainer width="100%" height={300}>
                               <LineChart data={chartData.lineData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}> {/* Збільшив відступи */}
                                 <CartesianGrid strokeDasharray="3 3" />
                                 <XAxis dataKey="name" />
                                 <YAxis tickFormatter={(value) => formatNumber(value)} width={80}/> {/* Додав ширину осі Y */}
                                 <Tooltip formatter={(value: number, name: string) => [`${formatNumber(value)} ₴`, name === 'income' ? 'Надходження' : 'Витрати']}/>
                                 <Legend />
                                 <Line type="monotone" dataKey="income" name="Надходження" stroke="#00C49F" strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 6 }}/> {/* Стилізував точки */}
                                 <Line type="monotone" dataKey="expense" name="Витрати" stroke="#FF8042" strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 6 }}/> {/* Стилізував точки */}
                               </LineChart>
                            </ResponsiveContainer>
                         ) : ( <p className="text-center text-gray-500 pt-10">Немає даних для відображення динаміки.</p> )}
                    </div>
                </div>
            )}
            {/* --- Кінець Відображення Графіків --- */}
        </div>
    );
};

export default ReportsPage;
