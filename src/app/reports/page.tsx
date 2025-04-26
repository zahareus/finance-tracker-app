'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
    ResponsiveContainer, PieChart, Pie, Cell, Tooltip, Legend, LineChart, Line, XAxis, YAxis, CartesianGrid
} from 'recharts';

// --- Типи даних ---
interface Transaction { /*...*/ }
interface CategoryInfo { /*...*/ }

// --- Хелпери ---
const formatNumber = (num: number) => { /*...*/ };
const parseDate = (dateString: string | null): Date | null => { /*...*/ }; // Виправлена версія
const formatDateForInput = (date: Date) => { /*...*/ };

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8', '#82ca9d', '#ffc658', '#ff7300', '#d0ed57', '#a4de6c'];

const ReportsPage: React.FC = () => {
    // --- Стан для даних та фільтрів ---
    const [allTransactions, setAllTransactions] = useState<Transaction[]>([]);
    const [accounts, setAccounts] = useState<string[]>([]);
    const [isLoading, setIsLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);
    const getInitialDates = () => { /*...*/ return { start: formatDateForInput(new Date(new Date().getFullYear(), new Date().getMonth(), 1)), end: formatDateForInput(new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0)) } }
    const initialDates = getInitialDates();
    const [startDate, setStartDate] = useState<string>(initialDates.start);
    const [endDate, setEndDate] = useState<string>(initialDates.end);
    const [selectedAccounts, setSelectedAccounts] = useState<string[]>([]);

    // --- Завантаження даних ---
    useEffect(() => { /*...*/ }, []);

    // --- Обробники фільтрів ---
    const handleAccountChange = useCallback((account: string) => {/*...*/}, []);
    const handleSelectAllAccounts = useCallback(() => {/*...*/}, [accounts]);

    // --- ОБРОБКА ДАНИХ ДЛЯ ГРАФІКІВ ---
    const chartData = useMemo(() => { /*...*/ }, [allTransactions, startDate, endDate, selectedAccounts]);

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
                         {/* ЗМІНЕНО ВИСОТУ: h-10 замість h-32 */}
                         <div className="h-10 overflow-y-auto border rounded p-2 bg-white space-y-1 shadow-sm">
                             {isLoading ? <p className="text-xs text-gray-400 p-1">Завантаження...</p> : Array.isArray(accounts) && accounts.length > 0 ? accounts.map(acc => ( <div key={acc} className="flex items-center"> <input type="checkbox" id={`rep-acc-${acc}`} checked={selectedAccounts.includes(acc)} onChange={() => handleAccountChange(acc)} className="h-4 w-4 text-blue-600 border-gray-300 rounded mr-2 focus:ring-blue-500"/> <label htmlFor={`rep-acc-${acc}`} className="text-xs text-gray-700 select-none cursor-pointer">{acc}</label> </div> )) : <p className="text-xs text-gray-400 p-1">Немає рахунків</p>}
                         </div>
                     </div>
                </div>
            </div>
            {/* --- Кінець ФІЛЬТРІВ --- */}


            {/* --- Відображення Графіків --- */}
            {/* ... (код графіків без змін) ... */}
             {isLoading && <p>Завантаження звітів...</p>}
             {error && <p className="text-red-600">Помилка завантаження: {error}</p>}
             {!isLoading && !error && ( <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6"> {/* ... Графіки ... */} </div> )}
        </div>
    );
};

export default ReportsPage;
