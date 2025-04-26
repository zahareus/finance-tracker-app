'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
// Додаємо BarChart, Bar з recharts
import {
    ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend
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
// Тип для агрегованих даних по місяцях
interface MonthlyData {
    name: string; // Назва місяця (для осі X)
    income: number; // Загальні надходження
    expense: number; // Загальні витрати
    // Деталізація для підказки Tooltip
    incomeDetails: { [category: string]: number };
    expenseDetails: { [category: string]: number };
}
// --- Кінець типів ---

// --- Хелпери ---
const formatNumber = (num: number): string => {
    if (typeof num !== 'number' || isNaN(num)) { return '0,00'; }
    return num.toLocaleString('uk-UA', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};
const parseDate = (dateString: string | null): Date | null => {
    // ... (функція parseDate без змін) ...
    if (!dateString) return null;
    let parts = dateString.split('-');
    if (parts.length === 3) { const date = new Date(Date.UTC(+parts[0], +parts[1] - 1, +parts[2])); if (!isNaN(date.getTime())) { return date; } }
    parts = dateString.split('.');
    if (parts.length === 3) { const date = new Date(Date.UTC(+parts[2], +parts[1] - 1, +parts[0])); if (!isNaN(date.getTime())) { return date; } }
    return null;
};
const formatDateForInput = (date: Date): string => { /*...*/ return date.toISOString().split('T')[0]; }; // Повернув ISO формат для input[type=date]
// --- Кінець хелперів ---

const ReportsPage: React.FC = () => {
    // --- Стан ---
    const [allTransactions, setAllTransactions] = useState<Transaction[]>([]);
    const [accounts, setAccounts] = useState<string[]>([]);
    const [categories, setCategories] = useState<CategoryInfo[]>([]); // Тепер потрібні
    const [isLoading, setIsLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);

    // Стан фільтрів (тепер повний набір)
    const getInitialDates = () => { const today = new Date(); const firstDay = new Date(today.getFullYear(), today.getMonth(), 1); const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0); return { start: formatDateForInput(firstDay), end: formatDateForInput(lastDay) } }
    const initialDates = getInitialDates();
    const [startDate, setStartDate] = useState<string>(initialDates.start);
    const [endDate, setEndDate] = useState<string>(initialDates.end);
    const [selectedAccounts, setSelectedAccounts] = useState<string[]>([]);
    const [selectedCategories, setSelectedCategories] = useState<string[]>([]); // Додали
    const [selectedType, setSelectedType] = useState<string>('Всі'); // Додали

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
             setCategories(data.categories); // Зберігаємо категорії
           } catch (err) { setError(err instanceof Error ? err.message : 'An unknown error occurred.'); }
           finally { setIsLoading(false); }
        };
        fetchData();
    }, []);

    // --- Обробники фільтрів (додаємо для категорій та типу) ---
    const handleAccountChange = useCallback((account: string) => { setSelectedAccounts(prev => prev.includes(account) ? prev.filter(a => a !== account) : [...prev, account]); }, []);
    const handleSelectAllAccounts = useCallback(() => { setSelectedAccounts(prev => prev.length === accounts.length ? [] : accounts); }, [accounts]);
    const handleCategoryChange = useCallback((category: string) => { setSelectedCategories(prev => prev.includes(category) ? prev.filter(c => c !== category) : [...prev, category]); }, []);
    const handleSelectAllCategories = useCallback(() => { setSelectedCategories(prev => prev.length === categories.length ? [] : categories.map(c => c.name)); }, [categories]);
    // Обробник для setSelectedType вже був у кнопок раніше, додавати не треба

    // --- ОБРОБКА ДАНИХ ДЛЯ НОВОГО ГРАФІКА ---
    const barChartData = useMemo((): MonthlyData[] => {
        const start = startDate ? parseDate(startDate) : null;
        const end = endDate ? parseDate(endDate) : null;
        if (start) start.setUTCHours(0, 0, 0, 0);
        if (end) end.setUTCHours(23, 59, 59, 999);

        // Фільтруємо транзакції за ВСІМА фільтрами
        const relevantTransactions = allTransactions.filter(tx => {
            if (selectedType !== 'Всі' && tx.type !== selectedType) return false; // Фільтр типу
            if (selectedAccounts.length > 0 && !selectedAccounts.includes(tx.account)) return false; // Фільтр рахунків
            if (selectedCategories.length > 0 && !selectedCategories.includes(tx.category)) return false; // Фільтр категорій
            const txDate = parseDate(tx.date);
            if (!txDate) return false;
            if (start && txDate < start) return false;
            if (end && txDate > end) return false;
            return true;
        });

        // Групуємо по місяцях і рахуємо суми та деталізацію
        const monthlyDataMap: { [monthYear: string]: MonthlyData } = {};

        relevantTransactions.forEach(tx => {
            const txDate = parseDate(tx.date);
            if (txDate) {
                const monthYear = `<span class="math-inline">\{txDate\.getUTCFullYear\(\)\}\-</span>{(txDate.getUTCMonth() + 1).toString().padStart(2, '0')}`;
                // Ініціалізуємо запис для місяця, якщо його ще немає
                if (!monthlyDataMap[monthYear]) {
                     const monthName = txDate.toLocaleString('uk-UA', { month: 'short', year: 'numeric', timeZone: 'UTC' });
                     monthlyDataMap[monthYear] = { name: monthName, income: 0, expense: 0, incomeDetails: {}, expenseDetails: {} };
                }

                const monthEntry = monthlyDataMap[monthYear];
                const category = tx.category;

                if (tx.type === 'Надходження') {
                    monthEntry.income += tx.amount;
                    monthEntry.incomeDetails[category] = (monthEntry.incomeDetails[category] || 0) + tx.amount;
                } else if (tx.type === 'Витрата') {
                    monthEntry.expense += tx.amount;
                    monthEntry.expenseDetails[category] = (monthEntry.expenseDetails[category] || 0) + tx.amount;
                }
            }
        });

         // Конвертуємо в масив і сортуємо
        const sortedData = Object.keys(monthlyDataMap)
                            .sort((a, b) => parseInt(a.replace('-', ''), 10) - parseInt(b.replace('-', ''), 10))
                            .map(key => monthlyDataMap[key]);

        return sortedData;

    }, [allTransactions, startDate, endDate, selectedAccounts, selectedCategories, selectedType]); // Додали залежності фільтрів
    // --- Кінець ОБРОБКИ ДАНИХ ---

    // --- Компонент для Кастомної Підказки (Tooltip) ---
    const CustomTooltip = ({ active, payload, label }: any) => {
        if (active && payload && payload.length) {
            // Знаходимо дані для поточного місяця (мітка label)
            const currentMonthData = barChartData.find(d => d.name === label);
            if (!currentMonthData) return null;

            // Формуємо список категорій для підказки
            const renderDetails = (details: { [category: string]: number }) => {
                return Object.entries(details)
                    .filter(([, amount]) => amount > 0) // Показуємо тільки ненульові
                    .sort(([, a], [, b]) => b - a) // Сортуємо за спаданням суми
                    .map(([category, amount]) => (
                        <p key={category} className="text-xs">{category}: {formatNumber(amount)} ₴</p>
                    ));
            };

            return (
                <div className="bg-white p-3 shadow border rounded text-sm">
                    <p className="font-bold mb-2">{label}</p>
                    {/* Показуємо деталізацію для стовпчика, на який навели */}
                    {payload[0]?.dataKey === 'income' && currentMonthData.income > 0 && (
                        <>
                            <p className="text-green-600 font-semibold">Надходження: {formatNumber(currentMonthData.income)} ₴</p>
                            <div className="pl-2 border-l ml-1 my-1">{renderDetails(currentMonthData.incomeDetails)}</div>
                        </>
                    )}
                     {payload[0]?.dataKey === 'expense' && currentMonthData.expense > 0 && (
                        <>
                            <p className="text-red-600 font-semibold">Витрати: {formatNumber(currentMonthData.expense)} ₴</p>
                            <div className="pl-2 border-l ml-1 my-1">{renderDetails(currentMonthData.expenseDetails)}</div>
                        </>
                    )}
                     {/* Якщо навели на обидва (у випадку згрупованих) */}
                     {payload.length > 1 && payload[1]?.dataKey === 'expense' && currentMonthData.expense > 0 && (
                         <>
                            <p className="text-red-600 font-semibold mt-2">Витрати: {formatNumber(currentMonthData.expense)} ₴</p>
                            <div className="pl-2 border-l ml-1 my-1">{renderDetails(currentMonthData.expenseDetails)}</div>
                        </>
                     )}
                </div>
            );
        }
        return null;
    };
    // --- Кінець Кастомної Підказки ---


    // --- РЕНДЕР КОМПОНЕНТА ---
    return (
        <div>
            <h1 className="text-xl font-semibold mb-4">Звіти</h1>

             {/* --- ФІЛЬТРИ (Повний набір) --- */}
            <div className="mb-6 p-4 border rounded bg-gray-50 space-y-4">
                 {/* --- Перший рядок (Дата + Тип) --- */}
                <div className="flex flex-wrap gap-4 items-end">
                    {/* Дати */}
                    <div className="flex flex-col sm:flex-row gap-2 flex-grow basis-full sm:basis-auto">
                       <div className='flex-1 min-w-[130px]'> <label htmlFor="rep-startDate" className="block text-xs font-medium text-gray-600 mb-1">Період Від</label> <input id="rep-startDate" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="w-full p-2 border border-gray-300 rounded text-sm shadow-sm focus:ring-blue-500 focus:border-blue-500"/> </div>
                       <div className='flex-1 min-w-[130px]'> <label htmlFor="rep-endDate" className="block text-xs font-medium text-gray-600 mb-1">Період До</label> <input id="rep-endDate" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="w-full p-2 border border-gray-300 rounded text-sm shadow-sm focus:ring-blue-500 focus:border-blue-500"/> </div>
                    </div>
                    {/* Тип */}
                    <div className="flex-shrink-0">
                       <label className="block text-xs font-medium text-gray-600 mb-1">Тип</label>
                       <div className="flex rounded border border-gray-300 overflow-hidden shadow-sm">
                         {(['Всі', 'Надходження', 'Витрата'] as const).map((type, index) => ( <button key={type} onClick={() => setSelectedType(type)} className={`px-3 py-2 text-sm transition-colors duration-150 ease-in-out ${selectedType === type ? 'bg-blue-600 text-white' : 'bg-white text-gray-700 hover:bg-gray-50'} ${index > 0 ? 'border-l border-gray-300' : ''}`} > {type} </button> ))}
                       </div>
                    </div>
                </div>
                 {/* --- Другий рядок (Рахунки + Категорії) --- */}
                 <div className="flex flex-wrap gap-4 items-start">
                     {/* Рахунки */}
                     <div className="w-full sm:w-[calc(50%-0.5rem)]">
                        <div className="flex justify-between items-center mb-1"> <label className="block text-xs font-medium text-gray-600">Рахунки</label> <button onClick={handleSelectAllAccounts} className="text-xs text-blue-600 hover:underline"> {accounts.length > 0 && selectedAccounts.length === accounts.length ? 'Зняти всі' : 'Вибрати всі'} </button> </div>
                        <div className="h-10 overflow-y-auto border rounded p-2 bg-white space-y-1 shadow-sm">
                           {isLoading ? <p className="text-xs text-gray-400 p-1">Завантаження...</p> : Array.isArray(accounts) && accounts.length > 0 ? accounts.map(acc => ( <div key={acc} className="flex items-center"> <input type="checkbox" id={`rep-acc-${acc}`} checked={selectedAccounts.includes(acc)} onChange={() => handleAccountChange(acc)} className="h-4 w-4 text-blue-600 border-gray-300 rounded mr-2 focus:ring-blue-500"/> <label htmlFor={`rep-acc-${acc}`} className="text-xs text-gray-700 select-none cursor-pointer">{acc}</label> </div> )) : <p className="text-xs text-gray-400 p-1">Немає рахунків</p>}
                        </div>
                    </div>
                     {/* Категорії */}
                     <div className="w-full sm:w-[calc(50%-0.5rem)]">
                        <div className="flex justify-between items-center mb-1"> <label className="block text-xs font-medium text-gray-600">Категорії</label> <button onClick={handleSelectAllCategories} className="text-xs text-blue-600 hover:underline"> {categories.length > 0 && selectedCategories.length === categories.length ? 'Зняти всі' : 'Вибрати всі'} </button> </div>
                         {/* Робимо таку ж висоту h-10 */}
                        <div className="h-10 overflow-y-auto border rounded p-2 bg-white space-y-1 shadow-sm">
                           {isLoading ? <p className="text-xs text-gray-400 p-1">Завантаження...</p> : Array.isArray(categories) && categories.length > 0 ? categories.map(cat => ( <div key={cat.name} className="flex items-center"> <input type="checkbox" id={`rep-cat-${cat.name}`} checked={selectedCategories.includes(cat.name)} onChange={() => handleCategoryChange(cat.name)} className="h-4 w-4 text-blue-600 border-gray-300 rounded mr-2 focus:ring-blue-500"/> <label htmlFor={`rep-cat-${cat.name}`} className="text-xs text-gray-700 select-none cursor-pointer">{cat.name} ({cat.type === 'Надходження' ? 'Н' : 'В'})</label> </div> )) : <p className="text-xs text-gray-400 p-1">Немає категорій</p>}
                        </div>
                    </div>
                 </div>
            </div>
            {/* --- Кінець ФІЛЬТРІВ --- */}


            {/* --- Відображення Графіка --- */}
            {isLoading && <p className="mt-6">Завантаження звіту...</p>}
            {error && <p className="mt-6 text-red-600">Помилка завантаження: {error}</p>}

            {!isLoading && !error && (
                 <div className="p-4 border rounded shadow bg-white mt-6 min-h-[400px]"> {/* Збільшив мін. висоту */}
                     <h2 className="text-lg font-semibold mb-4 text-center">Динаміка Надходжень та Витрат за Період</h2>
                     {barChartData.length > 0 ? (
                        <ResponsiveContainer width="100%" height={350}>
                           {/* Змінюємо LineChart на BarChart */}
                           <BarChart data={barChartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                             <CartesianGrid strokeDasharray="3 3" />
                             <XAxis dataKey="name" /> {/* Місяці */}
                             <YAxis tickFormatter={(value) => formatNumber(value)} width={80}/>
                             {/* Використовуємо кастомний Tooltip */}
                             <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(206, 212, 218, 0.3)' }}/>
                             <Legend />
                             {/* Два стовпці: один для надходжень, другий для витрат */}
                             <Bar dataKey="income" fill="#00C49F" name="Надходження" />
                             {/* Відображаємо витрати як позитивні числа на графіку, але візуально відрізняємо */}
                             <Bar dataKey="expense" fill="#FF8042" name="Витрати" />
                           </BarChart>
                        </ResponsiveContainer>
                     ) : ( <p className="text-center text-gray-500 pt-10">Немає даних для відображення звіту за обраними фільтрами.</p> )}
                </div>
            )}
            {/* --- Кінець Відображення Графіка --- */}
        </div>
    );
};

export default ReportsPage;
