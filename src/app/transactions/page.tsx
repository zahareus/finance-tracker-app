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
// Тип для даних графіка (з balanceDetails)
interface MonthlyChartData {
    name: string;
    income: number;
    expense: number;
    balance: number;
    incomeDetails: { [category: string]: number };
    expenseDetails: { [category: string]: number };
    balanceDetails: { [account: string]: number }; // Повертаємо деталізацію балансу
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
    return `<span class="math-inline">\{year\}\-</span>{month}-${day}`;
};
// --- Кінець хелперів ---

const TransactionsPage: React.FC = () => {
    // --- Стан (без змін) ---
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

    // --- Завантаження даних (без змін) ---
    useEffect(() => { /* ... */ }, []);

    // --- Обробники фільтрів (без змін) ---
    const handleAccountChange = useCallback((account: string) => {/*...*/}, []);
    const handleSelectAllAccounts = useCallback(() => {/*...*/}, [accounts]);
    const handleCategoryChange = useCallback((category: string) => {/*...*/}, []);
    const handleSelectAllCategories = useCallback(() => {/*...*/}, [categories]);


    // --- ОБРОБКА ДАНИХ (Оновлена логіка для розрахунку balanceDetails) ---
    const processedData = useMemo(() => {
        const startFilterDate = startDate ? parseDate(startDate) : null;
        const endFilterDate = endDate ? parseDate(endDate) : null;
        if (startFilterDate) startFilterDate.setUTCHours(0, 0, 0, 0);
        if (endFilterDate) endFilterDate.setUTCHours(23, 59, 59, 999);

        const accountsToConsider = selectedAccounts.length > 0 ? selectedAccounts : accounts;

        // 1. Розрахунок початкового балансу ПО РАХУНКАХ
        const balanceDetailsAtStart: { [account: string]: number } = {};
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
            if (selectedAccounts.length > 0 && !selectedAccounts.includes(tx.account)) return false; // Фільтр рахунків тут теж важливий
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
                const monthYearKey = `<span class="math-inline">\{currentMonth\.getUTCFullYear\(\)\}\-</span>{(currentMonth.getUTCMonth() + 1).toString().padStart(2, '0')}`;
                const monthName = currentMonth.toLocaleString('uk-UA', { month: 'short', year: 'numeric', timeZone: 'UTC' });
                allMonthsInRange.push({ key: monthYearKey, name: monthName });
                currentMonth.setUTCMonth(currentMonth.getUTCMonth() + 1);
            }
        }

        // 4. Групуємо відфільтровані транзакції по місяцях, рахуючи суми та деталі
         // Тепер зберігаємо і зміни по рахунках за місяць
        const monthlyActivityMap: {
             [monthYear: string]: Omit<MonthlyChartData, 'balance' | 'name' | 'balanceDetails'> & { balanceChangeDetails: { [account: string]: number } }
        } = {};

        filteredTransactionsForPeriod.forEach(tx => {
            const txDate = parseDate(tx.date);
            if (txDate) {
                const monthYear = `<span class="math-inline">\{txDate\.getUTCFullYear\(\)\}\-</span>{(txDate.getUTCMonth() + 1).toString().padStart(2, '0')}`;
                if (!monthlyActivityMap[monthYear]) {
                     monthlyActivityMap[monthYear] = { income: 0, expense: 0, incomeDetails: {}, expenseDetails: {}, balanceChangeDetails: {} };
                }
                const monthEntry = monthlyActivityMap[monthYear];
                const category = tx.category;
                const account = tx.account;
                const amountChange = (tx.type === 'Надходження' ? tx.amount : -tx.amount);

                // Агрегуємо доходи/витрати та їх деталізацію
                if (tx.type === 'Надходження') {
                    monthEntry.income += tx.amount;
                    monthEntry.incomeDetails[category] = (monthEntry.incomeDetails[category] || 0) + tx.amount;
                } else if (tx.type === 'Витрата') {
                    monthEntry.expense += tx.amount;
                    monthEntry.expenseDetails[category] = (monthEntry.expenseDetails[category] || 0) + tx.amount;
                }
                // Агрегуємо ЗМІНУ балансу по рахунках ЗА МІСЯЦЬ
                if (accountsToConsider.includes(account)) { // Враховуємо тільки обрані рахунки
                   monthEntry.balanceChangeDetails[account] = (monthEntry.balanceChangeDetails[account] || 0) + amountChange;
                }
            }
        });

        // 5. Розраховуємо наростаючий баланс і деталізацію по рахунках
        const runningBalanceDetails = { ...balanceDetailsAtStart };
        const barChartData: MonthlyChartData[] = allMonthsInRange.map(monthInfo => {
            const activity = monthlyActivityMap[monthInfo.key];
            const monthlyIncome = activity?.income || 0;
            const monthlyExpense = activity?.expense || 0;
            const balanceChanges = activity?.balanceChangeDetails || {};

            // Оновлюємо деталізацію балансу на основі змін ЦЬОГО місяця
            Object.keys(balanceChanges).forEach(account => {
                runningBalanceDetails[account] = (runningBalanceDetails[account] || 0) + balanceChanges[account];
            });

            // Рахуємо загальний баланс на кінець місяця
            const endOfMonthBalance = Object.values(runningBalanceDetails).reduce((sum, bal) => sum + bal, 0);

            return {
                name: monthInfo.name,
                income: monthlyIncome,
                expense: monthlyExpense,
                balance: endOfMonthBalance,
                incomeDetails: activity?.incomeDetails || {},
                expenseDetails: activity?.expenseDetails || {},
                // Зберігаємо деталізацію балансу на кінець місяця
                balanceDetails: { ...runningBalanceDetails } // Важливо копіювати!
            };
        });

        return { filteredTransactions: filteredTransactionsForPeriod, barChartData };

    }, [allTransactions, startDate, endDate, selectedAccounts, selectedCategories, selectedType, accounts]);
    // --- Кінець ОБРОБКИ ДАНИХ ---


    // --- Компонент для Кастомної Підказки (Tooltip) ---
    // Оновлюємо для показу balanceDetails
    const CustomTooltip = ({ active, payload, label }: any) => {
         if (active && payload && payload.length) {
             const currentMonthData = processedData.barChartData.find(d => d.name === label);
             if (!currentMonthData) return null;

             const renderDetails = (details: { [key: string]: number }, type: 'income' | 'expense' | 'balance') => {
                  const colorClass = type === 'income' ? 'text-green-600' : type === 'expense' ? 'text-red-600' : 'text-blue-600';
                  // Фільтруємо нульові значення і сортуємо
                  const sortedDetails = Object.entries(details)
                     .filter(([, amount]) => Math.abs(amount) > 0.001) // Фільтруємо нулі/дуже малі значення
                     .sort(([, a], [, b]) => b - a);

                  if(sortedDetails.length === 0) return <p className="text-xs text-gray-500 italic">- немає деталей -</p>;

                  return sortedDetails.map(([key, amount]) => (
                         <p key={key} className={`text-xs ${colorClass}`}> - {key}: {formatNumber(amount)} ₴</p>
                     ));
             };

             const incomePayload = payload.find((p: any) => p.dataKey === 'income');
             const expensePayload = payload.find((p: any) => p.dataKey === 'expense');
             const balancePayload = payload.find((p: any) => p.dataKey === 'balance');

             return (
                 <div className="bg-white p-3 shadow-lg border rounded text-sm opacity-95 max-w-xs z-50 relative">
                     <p className="font-bold mb-2 text-center">{label}</p>
                     {/* Блок Балансу з деталізацією */}
                     {balancePayload && (
                          <>
                              <p className="text-blue-600 font-semibold">Баланс (кінець міс.): {formatNumber(currentMonthData.balance)} ₴</p>
                              <div className="pl-2 my-1 text-xs">{renderDetails(currentMonthData.balanceDetails, 'balance')}</div>
                          </>
                     )}
                      {/* Блок Надходжень */}
                     {incomePayload && currentMonthData.income !== 0 && (
                          <>
                              <p className="text-green-600 font-semibold mt-2">Надходження: {formatNumber(currentMonthData.income)} ₴</p>
                              <div className="pl-2 my-1 text-xs">{renderDetails(currentMonthData.incomeDetails, 'income')}</div>
                          </>
                     )}
                      {/* Блок Витрат */}
                     {expensePayload && currentMonthData.expense !== 0 && (
                          <>
                              <p className="text-red-600 font-semibold mt-2">Витрати: {formatNumber(currentMonthData.expense)} ₴</p>
                              <div className="pl-2 my-1 text-xs">{renderDetails(currentMonthData.expenseDetails, 'expense')}</div>
                          </>
                     )}
                 </div>
             );
         }
         return null;
    };
    // --- Кінець Кастомної Підказки ---


    // --- РЕНДЕР КОМПОНЕНТА (JSX фільтрів та таблиці без змін, графік без змін) ---
    return (
        <div>
          <h1 className="text-xl font-semibold mb-4">Транзакції</h1>
          {/* Фільтри */}
          <div className="mb-6 p-4 border rounded bg-gray-50 space-y-4"> /* ... */ </div>
          {/* Графік */}
          {isLoading && <p>...</p>} {error && <p>...</p>}
          {!isLoading && !error && (<div className="p-4 border rounded shadow bg-white mb-6 min-h-[400px]"> /* ... BarChart ... */ </div> )}
          {/* Таблиця */}
          {isLoading && <p>...</p>}
          {!isLoading && !error && (<div className="overflow-x-auto mt-4"> /* ... table ... */ </div> )}
        </div>
      );
};

export default TransactionsPage;
