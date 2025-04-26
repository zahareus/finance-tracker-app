'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
// Імпорти з бібліотеки Recharts
import {
    ResponsiveContainer, PieChart, Pie, Cell, Tooltip, Legend, LineChart, Line, XAxis, YAxis, CartesianGrid
} from 'recharts';

// --- Типи даних ---
interface Transaction { /*...*/ } // Використовуємо ті ж типи
interface CategoryInfo { /*...*/ }

// --- Хелпери ---
const formatNumber = (num: number) => { /*...*/ };
const parseDate = (dateString: string | null): Date | null => { /*...*/ };
const formatDateForInput = (date: Date) => { /*...*/ };

// Кольори для кругової діаграми (можна налаштувати)
const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8', '#82ca9d', '#ffc658', '#ff7300', '#d0ed57', '#a4de6c'];

const ReportsPage: React.FC = () => {
    // --- Стан для даних та фільтрів (дублюємо з TransactionsPage) ---
    const [allTransactions, setAllTransactions] = useState<Transaction[]>([]);
    const [accounts, setAccounts] = useState<string[]>([]);
    const [categories, setCategories] = useState<CategoryInfo[]>([]); // Потрібні для довідки
    const [isLoading, setIsLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);

    const getInitialDates = () => { /*...*/ return { start: formatDateForInput(new Date(new Date().getFullYear(), new Date().getMonth(), 1)), end: formatDateForInput(new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0)) } }
    const initialDates = getInitialDates();
    const [startDate, setStartDate] = useState<string>(initialDates.start);
    const [endDate, setEndDate] = useState<string>(initialDates.end);
    const [selectedAccounts, setSelectedAccounts] = useState<string[]>([]);
    // Для звітів тип не фільтруємо, бо порівнюємо доходи і витрати
    // const [selectedType, setSelectedType] = useState<string>('Всі');

    // --- Завантаження даних (таке ж) ---
    useEffect(() => {
        const fetchData = async () => {
           // ... (код завантаження даних без змін) ...
           setIsLoading(true); setError(null);
           try { /* ... fetch ... */ const data = await (await fetch('/api/sheet-data')).json(); setAllTransactions(data.transactions); setAccounts(data.accounts); setCategories(data.categories); }
           catch (err) { setError(err instanceof Error ? err.message : 'An unknown error occurred.'); }
           finally { setIsLoading(false); }
        };
        fetchData();
    }, []);

    // --- Обробники фільтрів (такі ж) ---
    const handleAccountChange = useCallback((account: string) => {/*...*/ setSelectedAccounts(prev => prev.includes(account) ? prev.filter(a => a !== account) : [...prev, account]); }, []);
    const handleSelectAllAccounts = useCallback(() => {/*...*/ setSelectedAccounts(prev => prev.length === accounts.length ? [] : accounts); }, [accounts]);

    // --- ОБРОБКА ДАНИХ ДЛЯ ГРАФІКІВ ---
    const chartData = useMemo(() => {
        const start = startDate ? parseDate(startDate) : null;
        const end = endDate ? parseDate(endDate) : null;
        if (start) start.setUTCHours(0, 0, 0, 0);
        if (end) end.setUTCHours(23, 59, 59, 999);

        // Фільтруємо транзакції за датою та рахунками
        const relevantTransactions = allTransactions.filter(tx => {
            if (selectedAccounts.length > 0 && !selectedAccounts.includes(tx.account)) return false;
            const txDate = parseDate(tx.date);
            if (!txDate) return false;
            if (start && txDate < start) return false;
            if (end && txDate > end) return false;
            return true;
        });

        // 1. Дані для Кругової Діаграми (Витрати по категоріях)
        const expenseByCategory: { [category: string]: number } = {};
        relevantTransactions.forEach(tx => {
            if (tx.type === 'Витрата') {
                expenseByCategory[tx.category] = (expenseByCategory[tx.category] || 0) + tx.amount;
            }
        });
        const pieData = Object.entries(expenseByCategory)
                              .map(([name, value]) => ({ name, value }))
                              .sort((a, b) => b.value - a.value); // Сортуємо для краси

        // 2. Дані для Лінійного Графіка (Динаміка по місяцях)
        // Визначаємо часові проміжки (наприклад, місяці)
        const monthlyData: { [monthYear: string]: { name: string, income: number, expense: number } } = {};
        relevantTransactions.forEach(tx => {
            const txDate = parseDate(tx.date);
            if (txDate) {
                const monthYear = `<span class="math-inline">\{txDate\.getFullYear\(\)\}\-</span>{(txDate.getMonth() + 1).toString().padStart(2, '0')}`; // Формат РРРР-ММ
                if (!monthlyData[monthYear]) {
                    // Форматуємо назву місяця для осі X
                     const monthName = txDate.toLocaleString('uk-UA', { month: 'short', year: 'numeric' });
                     monthlyData[monthYear] = { name: monthName, income: 0, expense: 0 };
                }
                if (tx.type === 'Надходження') {
                    monthlyData[monthYear].income += tx.amount;
                } else if (tx.type === 'Витрата') {
                    monthlyData[monthYear].expense += tx.amount;
                }
            }
        });
         // Конвертуємо в масив і сортуємо по даті
        const lineData = Object.values(monthlyData).sort((a, b) => a.name.localeCompare(b.name, 'uk-UA')); // Потрібне правильне сортування місяців

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
                       {/* ... код інпутів дат ... */}
                       <div className='flex-1 min-w-[130px]'> <label htmlFor="startDate" className="block text-xs font-medium text-gray-600 mb-1">Період Від</label> <input id="startDate" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="w-full p-2 border border-gray-300 rounded text-sm shadow-sm focus:ring-blue-500 focus:border-blue-500"/> </div>
                       <div className='flex-1 min-w-[130px]'> <label htmlFor="endDate" className="block text-xs font-medium text-gray-600 mb-1">Період До</label> <input id="endDate" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="w-full p-2 border border-gray-300 rounded text-sm shadow-sm focus:ring-blue-500 focus:border-blue-500"/> </div>
                    </div>
                     {/* Рахунки */}
                     <div className="flex-shrink-0 w-full sm:w-auto sm:min-w-[200px]"> {/* Змінили ширину */}
                        <div className="flex justify-between items-center mb-1"> <label className="block text-xs font-medium text-gray-600">Рахунки</label> <button onClick={handleSelectAllAccounts} className="text-xs text-blue-600 hover:underline"> {accounts.length > 0 && selectedAccounts.length === accounts.length ? 'Зняти всі' : 'Вибрати всі'} </button> </div>
                        <div className="h-32 overflow-y-auto border rounded p-2 bg-white space-y-1 shadow-sm">
                           {/* ... код списку рахунків ... */}
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
                 <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6"> {/* Розміщуємо графіки поруч на великих екранах */}

                    {/* Кругова діаграма Витрат */}
                    <div className="p-4 border rounded shadow bg-white">
                       <h2 className="text-lg font-semibold mb-3 text-center">Витрати по Категоріях</h2>
                       {chartData.pieData.length > 0 ? (
                           <ResponsiveContainer width="100%" height={300}>
                               <PieChart>
                                   <Pie
                                       data={chartData.pieData}
                                       cx="50%" // Центр по X
                                       cy="50%" // Центр по Y
                                       labelLine={false}
                                       // label={({ name, percent }) => `<span class="math-inline">\{name\} \(</span>{(percent * 100).toFixed(0)}%)`} // Можна додати мітки
                                       outerRadius={80} // Розмір діаграми
                                       fill="#8884d8"
                                       dataKey="value" // Значення для розміру секторів
                                       nameKey="name"  // Значення для назви в підказці/легенді
                                   >
                                       {chartData.pieData.map((entry, index) => (
                                           <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                       ))}
                                   </Pie>
                                   <Tooltip formatter={(value: number) => `${formatNumber(value)} ₴`} /> {/* Форматуємо значення в підказці */}
                                   <Legend />
                               </PieChart>
                           </ResponsiveContainer>
                       ) : (
                           <p className="text-center text-gray-500 mt-10">Немає даних про витрати за обраний період.</p>
                       )}
                    </div>

                    {/* Лінійний графік Динаміки */}
                    <div className="p-4 border rounded shadow bg-white">
                         <h2 className="text-lg font-semibold mb-3 text-center">Динаміка Надходжень та Витрат</h2>
                         {chartData.lineData.length > 0 ? (
                            <ResponsiveContainer width="100%" height={300}>
                               <LineChart data={chartData.lineData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                                 <CartesianGrid strokeDasharray="3 3" /> {/* Сітка */}
                                 <XAxis dataKey="name" /> {/* Вісь X - назва місяця */}
                                 <YAxis tickFormatter={(value) => formatNumber(value)} /> {/* Вісь Y - суми */}
                                 <Tooltip formatter={(value: number, name: string) => [`${formatNumber(value)} ₴`, name === 'income' ? 'Надходження' : 'Витрати']}/> {/* Підказка */}
                                 <Legend />
                                 <Line type="monotone" dataKey="income" name="Надходження" stroke="#00C49F" strokeWidth={2} dot={false}/> {/* Лінія надходжень */}
                                 <Line type="monotone" dataKey="expense" name="Витрати" stroke="#FF8042" strokeWidth={2} dot={false}/> {/* Лінія витрат */}
                               </LineChart>
                            </ResponsiveContainer>
                         ) : (
                            <p className="text-center text-gray-500 mt-10">Немає даних для відображення динаміки.</p>
                         )}
                    </div>
                </div>
            )}
            {/* --- Кінець Відображення Графіків --- */}
        </div>
    );
};

export default ReportsPage;
