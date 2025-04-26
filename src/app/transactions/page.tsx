'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
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
interface MonthlyChartData {
    name: string;
    income: number;
    expense: number;
    balance: number;
    incomeDetails: { [category: string]: number };
    expenseDetails: { [category: string]: number };
    balanceDetails: { [account: string]: number };
}
interface BalanceDetails {
    [account: string]: number;
}
// --- Кінець типів ---

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
// --- Кінець хелперів ---


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

    // --- Обробники фільтрів (без змін) ---
    const handleAccountChange = useCallback((account: string) => { setSelectedAccounts(prev => prev.includes(account) ? prev.filter(a => a !== account) : [...prev, account]); }, []);
    const handleSelectAllAccounts = useCallback(() => { setSelectedAccounts(prev => prev.length === accounts.length ? [] : accounts); }, [accounts]);
    const handleCategoryChange = useCallback((category: string) => { setSelectedCategories(prev => prev.includes(category) ? prev.filter(c => c !== category) : [...prev, category]); }, []);
    const handleSelectAllCategories = useCallback(() => { setSelectedCategories(prev => prev.length === categories.length ? [] : categories.map(c => c.name)); }, [categories]);

    // === РОЗРАХУНОК ПОКАЗНИКІВ ДЛЯ ШАПКИ (Кошти, Ранвей) ===
    const headerMetrics = useMemo(() => {
        const today = new Date();
        const currentBalanceDetails: BalanceDetails = {};
        accounts.forEach(acc => currentBalanceDetails[acc] = 0); // Ініціалізуємо всі рахунки нулями

        allTransactions.forEach(tx => {
            const txDate = parseDate(tx.date);
             // Рахуємо баланс по всіх транзакціях до сьогодні включно
            if (txDate && txDate <= today && currentBalanceDetails.hasOwnProperty(tx.account)) {
                currentBalanceDetails[tx.account] += (tx.type === 'Надходження' ? tx.amount : -tx.amount);
            }
        });
        const currentTotalBalance = Object.values(currentBalanceDetails).reduce((sum, bal) => sum + bal, 0);

        // Розрахунок Ранвею (останні 3 повних місяці)
        const threeMonthsAgo = new Date(today.getFullYear(), today.getMonth() - 3, 1); // Початок періоду 3 міс тому
        const lastMonthEnd = new Date(today.getFullYear(), today.getMonth(), 0); // Кінець попереднього місяця

        let totalExpensesLast3Months = 0;
        allTransactions.forEach(tx => {
            const txDate = parseDate(tx.date);
            if (tx.type === 'Витрата' && txDate && txDate >= threeMonthsAgo && txDate <= lastMonthEnd) {
                totalExpensesLast3Months += tx.amount;
            }
        });

        const avgMonthlyExpense = totalExpensesLast3Months / 3;
        let runwayMonths = null;
        if (avgMonthlyExpense > 0) {
            runwayMonths = currentTotalBalance / avgMonthlyExpense;
        } else if (currentTotalBalance > 0) {
             runwayMonths = Infinity; // Нескінченний ранвей, якщо немає витрат
        }

         // Формуємо текст для title атрибуту (підказка для Коштів)
         const balanceTooltipText = accounts
             .map(acc => `${acc}: ${formatNumber(currentBalanceDetails[acc] || 0)} ₴`)
             .join('\n'); // Кожен рахунок з нового рядка

        return {
            currentTotalBalance,
            runwayMonths,
            balanceTooltipText
        };

    }, [allTransactions, accounts]); // Залежить тільки від всіх транзакцій і списку рахунків
    // === КІНЕЦЬ РОЗРАХУНКУ ПОКАЗНИКІВ ДЛЯ ШАПКИ ===


    // === ОБРОБКА ДАНИХ ДЛЯ ГРАФІКА ТА ТАБЛИЦІ (Залежить від фільтрів) ===
    const processedData = useMemo(() => {
        // ... (Вся логіка з попереднього кроку для розрахунку startingBalance,
        //      filteredTransactionsForPeriod, monthlyActivityMap, barChartData
        //      залишається тут без змін!) ...
        const startFilterDate = startDate ? parseDate(startDate) : null;
        const endFilterDate = endDate ? parseDate(endDate) : null;
        if (startFilterDate) startFilterDate.setUTCHours(0, 0, 0, 0);
        if (endFilterDate) endFilterDate.setUTCHours(23, 59, 59, 999);
        const accountsToConsider = selectedAccounts.length > 0 ? selectedAccounts : accounts;
        const balanceDetailsAtStart: BalanceDetails = {};
        accountsToConsider.forEach(acc => balanceDetailsAtStart[acc] = 0);
        allTransactions.forEach(tx => { /* ... розрахунок balanceDetailsAtStart ... */ });
        const filteredTransactionsForTable = allTransactions.filter(tx => { /* ... логіка фільтрації для таблиці ... */ });
        const allMonthsInRange: { key: string; name: string }[] = [];
        if (startFilterDate && endFilterDate && startFilterDate <= endFilterDate) { /* ... генеруємо місяці ... */ }
        const monthlyActivityMap: { [key: string]: any } = {};
        allMonthsInRange.forEach(monthInfo => { /* ... ініціалізуємо monthlyActivityMap ... */ });
        filteredTransactionsForTable.forEach(tx => { /* ... заповнюємо monthlyActivityMap ... */ });
        const runningBalanceDetails = { ...balanceDetailsAtStart };
        const barChartData: MonthlyChartData[] = allMonthsInRange.map(monthInfo => { /* ... розраховуємо barChartData ... */ });

        return { filteredTransactions: filteredTransactionsForTable, barChartData };

    }, [allTransactions, startDate, endDate, selectedAccounts, selectedCategories, selectedType, accounts]);
     // === КІНЕЦЬ ОБРОБКИ ДАНИХ ===


    // --- Компонент для Кастомної Підказки (Tooltip) (без змін) ---
    const CustomTooltip = ({ active, payload, label }: any) => { /* ... */ };

    // --- РЕНДЕР КОМПОНЕНТА ---
    return (
        <div>
            {/* === НОВА СЕКЦІЯ: Шапка з Показниками === */}
            <div className="mb-6 p-4 border rounded bg-white shadow flex flex-wrap gap-x-6 gap-y-2 items-center">
                {/* Кошти */}
                <div title={headerMetrics.balanceTooltipText}> {/* Додали title для простої підказки */}
                    <span className="text-sm font-medium text-gray-500">Кошти: </span>
                    <span className="text-lg font-semibold text-gray-900">
                        {formatNumber(headerMetrics.currentTotalBalance)} ₴
                    </span>
                </div>
                {/* Ранвей */}
                <div>
                     <span className="text-sm font-medium text-gray-500">Ранвей: </span>
                     <span className="text-lg font-semibold text-gray-900">
                         {headerMetrics.runwayMonths === null ? 'N/A' :
                          headerMetrics.runwayMonths === Infinity ? '∞' :
                          headerMetrics.runwayMonths.toFixed(1)} міс.
                     </span>
                </div>
            </div>
            {/* === КІНЕЦЬ Шапки з Показниками === */}


            {/* --- ФІЛЬТРИ (без змін) --- */}
            <div className="mb-6 p-4 border rounded bg-gray-50 space-y-4">
                 {/* Перший рядок (Дата + Тип) */}
                 <div className="flex flex-wrap gap-4 items-end">{/* ... */}</div>
                 {/* Другий рядок (Рахунки + Категорії) */}
                 <div className="flex flex-wrap gap-4 items-start">{/* ... */}</div>
            </div>
            {/* --- Кінець ФІЛЬТРІВ --- */}


            {/* --- Графік (без змін у JSX) --- */}
            {isLoading && <p className="mt-6 text-center">Завантаження звіту...</p>}
            {error && <p className="mt-6 text-red-600 text-center">Помилка завантаження звіту: {error}</p>}
            {!isLoading && !error && (
                 <div className="p-4 border rounded shadow bg-white mb-6 min-h-[400px]">
                      <h2 className="text-lg font-semibold mb-4 text-center">Динаміка за Період</h2>
                      {/* Передаємо processedData.barChartData */}
                      {processedData.barChartData.length > 0 ? (
                         <ResponsiveContainer width="100%" height={350}>
                            {/* ... код BarChart ... */}
                         </ResponsiveContainer>
                      ) : ( <p className="text-center text-gray-500 pt-10">Немає даних для графіка за обраними фільтрами.</p> )}
                 </div>
             )}
             {/* --- Кінець Графіка --- */}


             {/* --- Таблиця транзакцій --- */}
             {isLoading && <p className="mt-4 text-center">Завантаження транзакцій...</p>}
             {/* Error вже показано вище */}
             {!isLoading && !error && (
                 <div className="overflow-x-auto mt-4">
                    <h2 className="text-lg font-semibold mb-2">Детальні Транзакції за Період</h2>
                    {/* Передаємо processedData.filteredTransactions */}
                    <table className="min-w-full divide-y divide-gray-200">
                        {/* ... thead ... */}
                        <tbody className="bg-white divide-y divide-gray-200">
                           {processedData.filteredTransactions.length === 0 ? (
                             <tr> <td colSpan={5} className="px-4 py-4 text-center text-gray-500">Транзакцій за обраними фільтрами не знайдено</td> </tr>
                           ) : (
                             processedData.filteredTransactions.map((tx, index) => (
                               <tr key={`${tx.date}-${index}-${tx.amount}`} className={`${tx.type === 'Витрата' ? 'bg-red-50 hover:bg-red-100' : 'bg-green-50 hover:bg-green-100'} transition-colors duration-150 ease-in-out`}>
                                 {/* ... td ... */}
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
