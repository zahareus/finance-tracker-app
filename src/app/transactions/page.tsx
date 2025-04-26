'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
    ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend
} from 'recharts';

// --- Типи даних ---
interface Transaction { date: string | null; amount: number; type: string; account: string; category: string; description: string;}
interface CategoryInfo { name: string; type: string; } // 'Надходження' або 'Витрата'
interface MonthlyChartData { name: string; income: number; expense: number; balance: number; incomeDetails: { [category: string]: number }; expenseDetails: { [category: string]: number }; balanceDetails: { [account: string]: number }; }
interface BalanceDetails { [account: string]: number; }

// --- Хелпери ---
const formatNumber = (num: number): string => {
    if (typeof num !== 'number' || isNaN(num)) { console.warn("formatNumber received NaN or non-number:", num); return '0,00'; }
    return num.toLocaleString('uk-UA', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};
const parseDate = (dateString: string | null): Date | null => {
    if (!dateString || typeof dateString !== 'string') return null;
    try {
        let parts = dateString.split('-'); // YYYY-MM-DD
        if (parts.length === 3) { const date = new Date(Date.UTC(+parts[0], +parts[1] - 1, +parts[2])); if (!isNaN(date.getTime())) return date; }
        parts = dateString.split('.'); // DD.MM.YYYY
        if (parts.length === 3) { const date = new Date(Date.UTC(+parts[2], +parts[1] - 1, +parts[0])); if (!isNaN(date.getTime())) return date; }
    } catch (e) { console.error("Error parsing date:", dateString, e); }
    // console.warn("Could not parse date string, returning null:", dateString); // Розкоментуй для детальної відладки дат
    return null;
};
const formatDateForInput = (date: Date): string => {
    if (!(date instanceof Date) || isNaN(date.getTime())) { date = new Date(); } // Fallback
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
           console.log("FETCH_DATA: Starting fetch...");
           try {
             const response = await fetch('/api/sheet-data');
             console.log("FETCH_DATA: Response status:", response.status);
             if (!response.ok) { throw new Error(`HTTP error! status: ${response.status}`); }
             const data = await response.json();
             console.log("FETCH_DATA: Raw data received:", JSON.stringify(data, null, 2)); // Лог сирих даних

             if (!Array.isArray(data.transactions) || !Array.isArray(data.accounts) || !Array.isArray(data.categories)) {
                 throw new Error("Invalid data structure received.");
             }

             // Очистка та валідація
             const cleanedTransactions = data.transactions.map((tx: any, index: number) => ({
                date: typeof tx.date === 'string' ? tx.date.trim() : null,
                amount: typeof tx.amount === 'number' && !isNaN(tx.amount) ? tx.amount : 0,
                type: String(tx?.type || '').trim(),
                account: String(tx?.account || '').trim(),
                category: String(tx?.category || '').trim(),
                description: String(tx?.description || '').trim(),
             })).filter((tx: Transaction) => {
                 const isValid = tx.date && (tx.type === 'Надходження' || tx.type === 'Витрата') && tx.account && tx.category;
                 if (!isValid) console.warn(`Workspace_DATA: Invalid transaction structure at index ${index}:`, tx);
                 return isValid;
             });

             const cleanedAccounts = data.accounts.map((acc: any) => String(acc || '').trim()).filter(Boolean);

             const cleanedCategories = data.categories.map((cat: any) => ({
                    name: String(cat?.name || '').trim(),
                    type: String(cat?.type || '').trim() // Тип 'Надходження' або 'Витрата'
                })).filter((cat: CategoryInfo) => cat.name && (cat.type === 'Надходження' || cat.type === 'Витрата'));

             console.log("FETCH_DATA: Cleaned Categories:", cleanedCategories); // Лог очищених категорій

             setAllTransactions(cleanedTransactions);
             setAccounts(cleanedAccounts);
             setCategories(cleanedCategories);
             console.log("FETCH_DATA: State updated.");

           } catch (err) {
               setError(err instanceof Error ? err.message : 'An unknown error occurred.');
               console.error("FETCH_DATA: Error fetching or processing data:", err);
           } finally { setIsLoading(false); }
        };
        fetchData();
     }, []);

    // --- Обробники фільтрів ---
    const handleAccountChange = useCallback((account: string) => { setSelectedAccounts(prev => prev.includes(account) ? prev.filter(a => a !== account) : [...prev, account]); }, []);
    const handleSelectAllAccounts = useCallback(() => { setSelectedAccounts(prev => prev.length === accounts.length ? [] : accounts); }, [accounts]);
    const handleCategoryChange = useCallback((category: string) => { setSelectedCategories(prev => prev.includes(category) ? prev.filter(c => c !== category) : [...prev, category]); }, []);

    const incomeCategories = useMemo(() => categories.filter(c => c.type === 'Надходження').map(c => c.name), [categories]);
    const expenseCategories = useMemo(() => categories.filter(c => c.type === 'Витрата').map(c => c.name), [categories]);
    // Додаємо лог для перевірки expenseCategories
    useEffect(() => { console.log("STATE_UPDATE: Expense Categories for UI:", expenseCategories); }, [expenseCategories]);


    const handleSelectAllIncomeCategories = useCallback(() => {
        const otherSelected = selectedCategories.filter(sc => !incomeCategories.includes(sc));
        const allIncomeSelected = incomeCategories.length > 0 && incomeCategories.every(ic => selectedCategories.includes(ic));
        if (allIncomeSelected) { setSelectedCategories(otherSelected); }
        else { setSelectedCategories(Array.from(new Set([...otherSelected, ...incomeCategories]))); }
    }, [incomeCategories, selectedCategories]);

     const handleSelectAllExpenseCategories = useCallback(() => {
        const otherSelected = selectedCategories.filter(sc => !expenseCategories.includes(sc));
        const allExpenseSelected = expenseCategories.length > 0 && expenseCategories.every(ec => selectedCategories.includes(ec));
        if (allExpenseSelected) { setSelectedCategories(otherSelected); }
        else { setSelectedCategories(Array.from(new Set([...otherSelected, ...expenseCategories]))); }
    }, [expenseCategories, selectedCategories]);

    const setDateRangePreset = useCallback((preset: 'prev_month' | 'prev_quarter' | 'prev_year') => {
        const today = new Date(); let year = today.getFullYear(); let month = today.getMonth(); let startDate: Date; let endDate: Date;
        switch(preset) {
            case 'prev_month': endDate = new Date(year, month, 0); startDate = new Date(endDate.getFullYear(), endDate.getMonth(), 1); break;
            case 'prev_quarter': const cQ = Math.floor(month / 3); const fM = cQ * 3 - 3; const yS = fM < 0 ? year - 1 : year; startDate = new Date(yS, (fM + 12) % 12, 1); const fMCQ = cQ * 3; endDate = new Date(year, fMCQ, 0); break;
            case 'prev_year': const pY = year - 1; startDate = new Date(pY, 0, 1); endDate = new Date(pY, 11, 31); break;
        }
        setStartDate(formatDateForInput(startDate)); setEndDate(formatDateForInput(endDate));
    }, []);


    // === РОЗРАХУНОК ПОКАЗНИКІВ ДЛЯ ШАПКИ ===
    const headerMetrics = useMemo(() => {
        console.log("HEADER_METRICS: Recalculating...");
        const today = new Date(); today.setUTCHours(23, 59, 59, 999);
        const currentBalanceDetails: BalanceDetails = {};
        accounts.forEach(acc => currentBalanceDetails[acc] = 0); // Ініціалізація

        let includedTx = 0;
        allTransactions.forEach(tx => {
            const txDate = parseDate(tx.date);
             if (currentBalanceDetails.hasOwnProperty(tx.account) && txDate && txDate <= today) {
                const amount = tx.amount; // Вже перевірено на число при завантаженні
                currentBalanceDetails[tx.account] += (tx.type === 'Надходження' ? amount : -amount);
                includedTx++;
            }
        });
        const currentTotalBalance = Object.values(currentBalanceDetails).reduce((sum, bal) => sum + bal, 0);
        console.log(`HEADER_METRICS: Calculated balance. ${includedTx} tx included. Total: ${currentTotalBalance}`, currentBalanceDetails);

        // Розрахунок Ранвею
        // ... (розрахунок Runway без змін, використовує currentTotalBalance) ...
        const threeMonthsAgo = new Date(today.getUTCFullYear(), today.getUTCMonth() - 3, 1);
        const lastMonthEnd = new Date(today.getUTCFullYear(), today.getUTCMonth(), 0); lastMonthEnd.setUTCHours(23,59,59,999);
        let totalExpensesLast3Months = 0; let expenseTxCount = 0;
        allTransactions.forEach(tx => {
            const txDate = parseDate(tx.date);
            const amount = tx.amount;
            if (tx.type === 'Витрата' && txDate && txDate >= threeMonthsAgo && txDate <= lastMonthEnd) {
                totalExpensesLast3Months += amount; expenseTxCount++;
            }
        });
        console.log(`HEADER_METRICS: Runway calculation: ${expenseTxCount} expense tx in last 3m. Total: ${totalExpensesLast3Months}`);
        const avgMonthlyExpense = totalExpensesLast3Months > 0 ? totalExpensesLast3Months / 3 : 0;
        let runwayMonths: number | null | typeof Infinity = null;
        if (avgMonthlyExpense > 0 && currentTotalBalance > 0) { runwayMonths = currentTotalBalance / avgMonthlyExpense; }
        else if (currentTotalBalance >= 0 && avgMonthlyExpense <= 0) { runwayMonths = Infinity; }
        const balanceTooltipText = accounts.map(acc => `${acc}: ${formatNumber(currentBalanceDetails[acc] || 0)} ₴`).join('\n');

        return { currentTotalBalance, runwayMonths, balanceTooltipText };
    }, [allTransactions, accounts]);


    // === ОБРОБКА ДАНИХ ДЛЯ ГРАФІКА ТА ТАБЛИЦІ ===
    const processedData = useMemo(() => {
        console.log("PROCESS_DATA: Recalculating for chart/table..."); // Лог
        const startFilterDate = startDate ? parseDate(startDate) : null;
        const endFilterDate = endDate ? parseDate(endDate) : null;
        if (startFilterDate) startFilterDate.setUTCHours(0, 0, 0, 0);
        if (endFilterDate) endFilterDate.setUTCHours(23, 59, 59, 999);
        console.log("PROCESS_DATA: Using date range:", { startFilterDate, endFilterDate });
        console.log("PROCESS_DATA: Using filters:", { selectedType, selectedAccounts, selectedCategories });

        const accountsToConsider = selectedAccounts.length > 0 ? selectedAccounts : accounts;

        // 1. Розрахунок початкового балансу (тільки по accountsToConsider)
        const balanceDetailsAtStart: BalanceDetails = {};
        accountsToConsider.forEach(acc => balanceDetailsAtStart[acc] = 0);
        let startBalanceTxCount = 0;
        allTransactions.forEach(tx => {
            const txDate = parseDate(tx.date);
            const accountMatches = accountsToConsider.includes(tx.account);
            if (txDate && accountMatches && (!startFilterDate || txDate < startFilterDate)) {
                balanceDetailsAtStart[tx.account] = (balanceDetailsAtStart[tx.account] || 0) + (tx.type === 'Надходження' ? tx.amount : -tx.amount);
                startBalanceTxCount++;
            }
        });
         console.log(`PROCESS_DATA: Calculated start balance details from ${startBalanceTxCount} tx:`, balanceDetailsAtStart);

        // 2. Фільтруємо транзакції для таблиці ТА графіка за ВСІМА фільтрами
        let iteration = 0;
        const filteredTransactionsForPeriod = allTransactions.filter(tx => {
            iteration++;
            // Логування ДЛЯ КОЖНОЇ ТРАНЗАКЦІЇ під час фільтрації
            // console.log(`PROCESS_DATA: Filtering tx #${iteration}`, tx);
            const typeMatch = selectedType === 'Всі' || tx.type === selectedType;
            if (!typeMatch) return false;
            const accountMatch = selectedAccounts.length === 0 || selectedAccounts.includes(tx.account);
            if (!accountMatch) return false;
            const categoryMatch = selectedCategories.length === 0 || selectedCategories.includes(tx.category);
            if (!categoryMatch) return false;
            const txDate = parseDate(tx.date);
            if (!txDate) return false; // Якщо дата не парситься - пропускаємо
            const startDateMatch = !startFilterDate || txDate >= startFilterDate;
            if (!startDateMatch) return false;
            const endDateMatch = !endFilterDate || txDate <= endFilterDate;
            if (!endDateMatch) return false;
            // console.log(`PROCESS_DATA: Tx #${iteration} PASSED filters`);
            return true;
        });
        console.log("PROCESS_DATA: Filtered Transactions for Period/Table:", filteredTransactionsForPeriod); // Лог транзакцій для таблиці

        // 3. Генеруємо список ВСІХ місяців у діапазоні (без змін)
        const allMonthsInRange: { key: string; name: string }[] = [];
        if (startFilterDate && endFilterDate && startFilterDate <= endFilterDate) { /* ... генеруємо місяці ... */ }

        // 4. Групуємо ВІДФІЛЬТРОВАНІ транзакції по місяцях
        const monthlyActivityMap: { [monthYear: string]: Omit<MonthlyChartData, 'balance' | 'name' | 'balanceDetails'> & { balanceChangeDetails: BalanceDetails } } = {};
        allMonthsInRange.forEach(monthInfo => { /* ... ініціалізуємо ... */ });
        // Важливо: використовуємо filteredTransactionsForPeriod тут
        filteredTransactionsForPeriod.forEach(tx => { /* ... заповнюємо monthlyActivityMap ... */ });

        // 5. Розраховуємо наростаючий баланс і деталізацію по рахунках
        const runningBalanceDetails = { ...balanceDetailsAtStart };
        const barChartData: MonthlyChartData[] = allMonthsInRange.map(monthInfo => {
            const activity = monthlyActivityMap[monthInfo.key];
            if (!activity) { // Додаткова перевірка
                const currentBalance = Object.values(runningBalanceDetails).reduce((s, b) => s + b, 0);
                return { name: monthInfo.name, income: 0, expense: 0, balance: currentBalance, incomeDetails: {}, expenseDetails: {}, balanceDetails: { ...runningBalanceDetails } };
            }
            const balanceChanges = activity.balanceChangeDetails;
            Object.keys(balanceChanges).forEach(account => {
                if (runningBalanceDetails.hasOwnProperty(account)) {
                   runningBalanceDetails[account] = (runningBalanceDetails[account] || 0) + balanceChanges[account];
                }
            });
            const endOfMonthBalance = Object.values(runningBalanceDetails).reduce((sum, bal) => sum + bal, 0);
            return { name: monthInfo.name, income: activity.income, expense: activity.expense, balance: endOfMonthBalance, incomeDetails: activity.incomeDetails, expenseDetails: activity.expenseDetails, balanceDetails: { ...runningBalanceDetails } };
        });

        console.log("PROCESS_DATA: Final Bar Chart Data:", barChartData); // Лог даних для графіка

        return { filteredTransactions: filteredTransactionsForPeriod, barChartData };

    }, [allTransactions, startDate, endDate, selectedAccounts, selectedCategories, selectedType, accounts]);
    // --- Кінець ОБРОБКИ ДАНИХ ---


    // --- Компонент для Кастомної Підказки (Tooltip) ---
    // Повний CustomTooltip
    const CustomTooltip = ({ active, payload, label }: any) => {
        // Додаємо лог на вході
        // console.log("TOOLTIP: Triggered", { active, payload, label });
        if (active && payload && payload.length) {
            const currentMonthData = processedData.barChartData.find(d => d.name === label);
            // console.log("TOOLTIP: Found month data", currentMonthData);
            if (!currentMonthData) return null;

            const renderDetails = (details: { [key: string]: number }, type: 'income' | 'expense' | 'balance') => {
                 const colorClass = type === 'income' ? 'text-green-600' : type === 'expense' ? 'text-red-600' : 'text-blue-600';
                 const accountsToConsider = selectedAccounts.length > 0 ? selectedAccounts : accounts;
                 let detailsToShow: [string, number][];
                 if (type === 'balance') {
                      const fullBalanceDetails: BalanceDetails = {};
                      accountsToConsider.forEach(acc => { fullBalanceDetails[acc] = details[acc] || 0; });
                      detailsToShow = Object.entries(fullBalanceDetails).filter(([, amount]) => Math.abs(amount) > 0.001).sort(([,a],[,b]) => b - a);
                      if (detailsToShow.length === 0) {
                           if (accountsToConsider.length > 0) return <p key={accountsToConsider[0]} className={`text-xs ${colorClass}`}> - {accountsToConsider[0]}: {formatNumber(0)} ₴</p>;
                           else return <p className="text-xs text-gray-500 italic">- немає рахунків -</p>;
                      }
                 } else {
                     detailsToShow = Object.entries(details).filter(([, amount]) => Math.abs(amount) > 0.001).sort(([, a], [, b]) => b - a);
                     if(detailsToShow.length === 0) return <p className="text-xs text-gray-500 italic">- немає деталей -</p>;
                 }
                 return detailsToShow.map(([key, amount]) => ( <p key={key} className={`text-xs ${colorClass}`}> - {key}: {formatNumber(amount)} ₴</p> ));
            };

            const incomePayload = payload.find((p: any) => p.dataKey === 'income');
            const expensePayload = payload.find((p: any) => p.dataKey === 'expense');
            const balancePayload = payload.find((p: any) => p.dataKey === 'balance');

            return (
                <div className="bg-white p-3 shadow-lg border rounded text-sm opacity-95 max-w-xs z-50 relative">
                    <p className="font-bold mb-2 text-center">{label}</p>
                    {balancePayload && ( <> <p className="text-blue-600 font-semibold">Баланс (кінець міс.): {formatNumber(currentMonthData.balance)} ₴</p> <div className="pl-2 my-1">{renderDetails(currentMonthData.balanceDetails, 'balance')}</div> </> )}
                    {incomePayload && currentMonthData.income !== 0 && ( <> <p className="text-green-600 font-semibold mt-1">Надходження: {formatNumber(currentMonthData.income)} ₴</p> <div className="pl-2 my-1">{renderDetails(currentMonthData.incomeDetails, 'income')}</div> </> )}
                    {expensePayload && currentMonthData.expense !== 0 && ( <> <p className="text-red-600 font-semibold mt-1">Витрати: {formatNumber(currentMonthData.expense)} ₴</p> <div className="pl-2 my-1">{renderDetails(currentMonthData.expenseDetails, 'expense')}</div> </> )}
                </div>
            );
        }
        return null;
    };
    // --- Кінець Кастомної Підказки ---


    // --- РЕНДЕР КОМПОНЕНТА ---
    return (
        <div>
          {/* Фільтри */}
          <div className="mb-6 p-4 border rounded bg-gray-50 space-y-4">
               {/* Перший рядок */}
               <div className="grid grid-cols-1 md:grid-cols-3 gap-x-4 gap-y-3 items-end">
                   {/* Колонка 1: Дати */}
                   <div className="flex flex-col sm:flex-row gap-2 md:col-span-1">
                       <div className='flex-1 min-w-[130px]'> <label htmlFor="trans-startDate" className="block text-xs font-medium text-gray-600 mb-1">Період Від</label> <input id="trans-startDate" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="w-full p-1.5 border border-gray-300 rounded text-sm shadow-sm focus:ring-1 focus:ring-blue-500 focus:border-blue-500"/> </div>
                       <div className='flex-1 min-w-[130px]'> <label htmlFor="trans-endDate" className="block text-xs font-medium text-gray-600 mb-1">Період До</label> <input id="trans-endDate" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="w-full p-1.5 border border-gray-300 rounded text-sm shadow-sm focus:ring-1 focus:ring-blue-500 focus:border-blue-500"/> </div>
                   </div>
                   {/* Колонка 2: Швидкі Періоди */}
                   <div className="md:col-span-1">
                       <label className="block text-xs font-medium text-gray-600 mb-1 invisible">Швидкі Періоди</label>
                       <div className="flex space-x-2">
                           <button onClick={() => setDateRangePreset('prev_month')} className="flex-1 px-2 py-1.5 text-xs border border-gray-300 rounded bg-white hover:bg-gray-50 shadow-sm">Місяць</button>
                           <button onClick={() => setDateRangePreset('prev_quarter')} className="flex-1 px-2 py-1.5 text-xs border border-gray-300 rounded bg-white hover:bg-gray-50 shadow-sm">Квартал</button>
                           <button onClick={() => setDateRangePreset('prev_year')} className="flex-1 px-2 py-1.5 text-xs border border-gray-300 rounded bg-white hover:bg-gray-50 shadow-sm">Рік</button>
                       </div>
                   </div>
                   {/* Колонка 3: Тип */}
                   <div className="md:col-span-1">
                      <label className="block text-xs font-medium text-gray-600 mb-1">Тип</label>
                      <div className="flex rounded border border-gray-300 overflow-hidden shadow-sm">
                        {(['Всі', 'Надходження', 'Витрата'] as const).map((type, index) => ( <button key={type} onClick={() => setSelectedType(type)} className={`flex-1 px-2 py-1.5 text-sm text-center transition-colors duration-150 ease-in-out ${selectedType === type ? 'bg-blue-600 text-white' : 'bg-white text-gray-700 hover:bg-gray-100'} ${index > 0 ? 'border-l border-gray-300' : ''}`} > {type} </button> ))}
                      </div>
                   </div>
               </div>

                {/* --- Другий Рядок Фільтрів --- */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-stretch pt-2">
                    {/* Колонка 1: Рахунки */}
                    <div className="flex flex-col">
                       <div className="flex justify-between items-center mb-1 flex-shrink-0">
                           <label className="block text-sm font-medium text-gray-700">Рахунки</label>
                           <button onClick={handleSelectAllAccounts} className="text-xs text-blue-600 hover:underline"> {accounts.length > 0 && selectedAccounts.length === accounts.length ? 'Зняти всі' : 'Вибрати всі'} </button>
                       </div>
                       <div className="border rounded p-2 bg-white space-y-1 shadow-sm overflow-y-auto flex-grow h-full">
                          {isLoading ? <p className="text-xs text-gray-400 p-1">Завантаження...</p> : Array.isArray(accounts) && accounts.length > 0 ? accounts.map(acc => ( <div key={acc} className="flex items-center"> <input type="checkbox" id={`trans-acc-${acc}`} checked={selectedAccounts.includes(acc)} onChange={() => handleAccountChange(acc)} className="h-3.5 w-3.5 text-blue-600 border-gray-300 rounded mr-1.5 focus:ring-blue-500 focus:ring-offset-0"/> <label htmlFor={`trans-acc-${acc}`} className="text-xs text-gray-800 select-none cursor-pointer">{acc}</label> </div> )) : <p className="text-xs text-gray-400 p-1">Немає рахунків</p>}
                       </div>
                   </div>
                   {/* Колонка 2: Категорії Надходжень */}
                   <div className="flex flex-col">
                        <div className='flex justify-between items-center mb-1 flex-shrink-0'>
                            <label className="block text-sm font-medium text-gray-700">Категорії (Надходження)</label>
                             <button onClick={handleSelectAllIncomeCategories} className="text-xs text-blue-600 hover:underline"> {incomeCategories.length > 0 && incomeCategories.every(ic => selectedCategories.includes(ic)) ? 'Зняти всі' : 'Вибрати всі'} </button>
                        </div>
                        <div className="border rounded p-2 bg-white space-y-1 shadow-sm overflow-y-auto flex-grow h-full">
                           {isLoading ? <p className="text-xs text-gray-400 p-1">Завантаження...</p> :
                            Array.isArray(categories) && incomeCategories.length > 0 ? incomeCategories.map(catName => (
                               <div key={`inc-${catName}`} className="flex items-center">
                                   <input type="checkbox" id={`trans-cat-inc-${catName}`} checked={selectedCategories.includes(catName)} onChange={() => handleCategoryChange(catName)} className="h-3.5 w-3.5 text-blue-600 border-gray-300 rounded mr-1.5 focus:ring-blue-500 focus:ring-offset-0"/>
                                   <label htmlFor={`trans-cat-inc-${catName}`} className="text-xs text-gray-800 select-none cursor-pointer">{catName}</label>
                               </div>
                            )) : <p className="text-xs text-gray-400 p-1">Немає категорій надходжень</p>
                           }
                        </div>
                   </div>
                   {/* Колонка 3: Категорії Витрат */}
                   <div className="flex flex-col">
                        <div className='flex justify-between items-center mb-1 flex-shrink-0'>
                            <label className="block text-sm font-medium text-gray-700">Категорії (Витрати)</label>
                             <button onClick={handleSelectAllExpenseCategories} className="text-xs text-blue-600 hover:underline"> {expenseCategories.length > 0 && expenseCategories.every(ec => selectedCategories.includes(ec)) ? 'Зняти всі' : 'Вибрати всі'} </button>
                        </div>
                        <div className="border rounded p-2 bg-white space-y-1 shadow-sm overflow-y-auto flex-grow h-full">
                           {isLoading ? <p className="text-xs text-gray-400 p-1">Завантаження...</p> :
                            Array.isArray(categories) && expenseCategories.length > 0 ? expenseCategories.map(catName => (
                               <div key={`exp-${catName}`} className="flex items-center">
                                   <input type="checkbox" id={`trans-cat-exp-${catName}`} checked={selectedCategories.includes(catName)} onChange={() => handleCategoryChange(catName)} className="h-3.5 w-3.5 text-blue-600 border-gray-300 rounded mr-1.5 focus:ring-blue-500 focus:ring-offset-0"/>
                                   <label htmlFor={`trans-cat-exp-${catName}`} className="text-xs text-gray-800 select-none cursor-pointer">{catName}</label>
                               </div>
                            )) : <p className="text-xs text-gray-400 p-1">Немає категорій витрат</p>
                           }
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
                           {/* ПОВЕРТАЄМО КАСТОМНИЙ TOOLTIP */}
                           <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(206, 212, 218, 0.3)' }}/>
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
                     {/* Додаємо сортування перед map */}
                     {processedData.filteredTransactions.length === 0 ? (
                       <tr> <td colSpan={5} className="px-4 py-4 text-center text-gray-500">Транзакцій за обраними фільтрами не знайдено</td> </tr>
                     ) : (
                       processedData.filteredTransactions
                         .sort((a, b) => { const dateA = parseDate(a.date); const dateB = parseDate(b.date); if (!dateA && !dateB) return 0; if (!dateA) return 1; if (!dateB) return -1; return dateB.getTime() - dateA.getTime(); })
                         .map((tx, index) => (
                           <tr key={`${tx.date}-${index}-${tx.amount}`} className={`${tx.type === 'Витрата' ? 'bg-red-50 hover:bg-red-100' : 'bg-green-50 hover:bg-green-100'} transition-colors duration-150 ease-in-out`}>
                             <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-900">{tx.date}</td>
                             <td className={`px-4 py-2 whitespace-nowrap text-sm text-right font-medium ${tx.type === 'Витрата' ? 'text-[#FF8042]' : 'text-[#00C49F]'}`}> {tx.type === 'Витрата' ? '-' : '+'} {formatNumber(tx.amount)} ₴ </td>
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
