'use client';

import React, { useState, useEffect, useMemo, useCallback, FormEvent } from 'react';
import {
    ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend
} from 'recharts';

// --- Типи даних ---
interface Transaction { date: string | null; amount: number; type: string; account: string; category: string; description: string;}
interface CategoryInfo { name: string; type: string; }
interface MonthlyChartData { name: string; income: number; expense: number; balance: number; incomeDetails: { [category: string]: number }; expenseDetails: { [category: string]: number }; balanceDetails: { [account: string]: number }; }
interface BalanceDetails { [account: string]: number; }

// --- Хелпери ---
const formatNumber = (num: number): string => { if (typeof num !== 'number' || isNaN(num)) { return '0,00'; } return num.toLocaleString('uk-UA', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); };
const parseDate = (dateString: string | null): Date | null => { if (!dateString || typeof dateString !== 'string') return null; try { let parts = dateString.split('-'); if (parts.length === 3) { const date = new Date(Date.UTC(+parts[0], +parts[1] - 1, +parts[2])); if (!isNaN(date.getTime())) return date; } parts = dateString.split('.'); if (parts.length === 3) { const date = new Date(Date.UTC(+parts[2], +parts[1] - 1, +parts[0])); if (!isNaN(date.getTime())) return date; } } catch (e) {} return null; };
const formatDateForInput = (date: Date): string => { if (!(date instanceof Date) || isNaN(date.getTime())) { date = new Date(); } const year = date.getFullYear(); const month = (date.getMonth() + 1).toString().padStart(2, '0'); const day = date.getDate().toString().padStart(2, '0'); return `${year}-${month}-${day}`; };

// --- Компонент Форми Паролю ---
interface PasswordFormProps { onSubmit: (password: string) => Promise<boolean>; error: string | null; isLoading: boolean; }
const PasswordForm: React.FC<PasswordFormProps> = ({ onSubmit, error, isLoading }) => { const [passwordInput, setPasswordInput] = useState(''); const handleSubmit = async (e: FormEvent) => { e.preventDefault(); const success = await onSubmit(passwordInput); if(!success) setPasswordInput(''); }; return ( <div className="fixed inset-0 bg-gray-100 flex items-center justify-center z-50"> <form onSubmit={handleSubmit} className="bg-white p-6 md:p-8 rounded-lg shadow-lg w-full max-w-xs"> <h2 className="text-lg font-semibold mb-5 text-center text-gray-700">Вхід</h2> <div className="mb-4"> <label htmlFor="password-input" className="block text-sm font-medium text-gray-600 mb-1">Пароль</label> <input id="password-input" type="password" value={passwordInput} onChange={(e) => setPasswordInput(e.target.value)} className={`w-full p-2 border rounded shadow-sm focus:ring-1 ${error ? 'border-red-500 focus:border-red-500 focus:ring-red-500' : 'border-gray-300 focus:border-blue-500 focus:ring-blue-500'}`} required autoFocus/> </div> {error && <p className="text-red-600 text-xs mb-3 text-center">{error}</p>} <button type="submit" disabled={isLoading} className={`w-full p-2 rounded text-white font-medium ${isLoading ? 'bg-gray-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'} transition-colors`}> {isLoading ? 'Перевірка...' : 'Увійти'} </button> </form> </div> ); };

// --- Основний Компонент Сторінки ---
const HomePage: React.FC = () => {
    // --- Стан ---
    const [allTransactions, setAllTransactions] = useState<Transaction[]>([]);
    const [accounts, setAccounts] = useState<string[]>([]);
    const [categories, setCategories] = useState<CategoryInfo[]>([]);
    const [isLoading, setIsLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);
    const getInitialDates = useCallback(() => { const today = new Date(); const firstDay = new Date(today.getFullYear(), today.getMonth(), 1); const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0); return { start: formatDateForInput(firstDay), end: formatDateForInput(lastDay) } }, []);
    const initialDates = useMemo(() => getInitialDates(), [getInitialDates]);
    const [startDate, setStartDate] = useState<string>(initialDates.start);
    const [endDate, setEndDate] = useState<string>(initialDates.end);
    const [selectedAccounts, setSelectedAccounts] = useState<string[]>([]);
    const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
    const [selectedType, setSelectedType] = useState<string>('Всі');
    // Стан Автентифікації
    const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
    const [authLoading, setAuthLoading] = useState<boolean>(false);
    const [authError, setAuthError] = useState<string | null>(null);
    const AUTH_KEY = 'app_session_pwd_token_v1'; // Змінив ключ для надійності

    // --- Перевірка сесії при завантаженні ---
    useEffect(() => {
        console.log("Checking session storage for token...");
        const token = sessionStorage.getItem(AUTH_KEY);
        if (token) {
            console.log("Token found. Verifying...");
            const verifyToken = async () => {
                setAuthLoading(true);
                try {
                     const response = await fetch('/api/sheet-data', { headers: { 'X-App-Password': token } });
                     console.log("Token verification response status:", response.status);
                     if(response.ok) {
                         setIsAuthenticated(true); // Токен валідний
                     } else {
                         console.warn("Token verification failed. Removing token.");
                         sessionStorage.removeItem(AUTH_KEY); setIsAuthenticated(false);
                     }
                } catch (e) {
                    console.error("Error verifying session token:", e);
                    sessionStorage.removeItem(AUTH_KEY); setIsAuthenticated(false);
                } finally { setAuthLoading(false); }
            };
            verifyToken();
        } else {
            console.log("No auth token found. Setting isAuthenticated=false.");
            setIsAuthenticated(false);
            setIsLoading(false); // Дані точно не завантажуємо
        }
    }, []); // Тільки при першому завантаженні компонента

    // --- Завантаження даних (тільки після автентифікації) ---
    useEffect(() => {
        if (!isAuthenticated) {
            // Якщо ми НЕ автентифіковані, переконуємось, що дані порожні
            if(allTransactions.length > 0) setAllTransactions([]);
            if(accounts.length > 0) setAccounts([]);
            if(categories.length > 0) setCategories([]);
            // Якщо автентифікація ще перевіряється, не ставимо isLoading в false
            if (!authLoading) setIsLoading(false);
            return;
        }
        // Якщо автентифіковані, завантажуємо дані
        const fetchData = async () => {
           setIsLoading(true); setError(null);
           const token = sessionStorage.getItem(AUTH_KEY);
           console.log("Attempting to fetch data with token...");
           if (!token) { // Якщо токена раптом немає (хоча isAuthenticated=true) - розлогін
                setIsAuthenticated(false); setAuthError("Помилка сесії."); setIsLoading(false);
                return;
           }
           try {
             const response = await fetch('/api/sheet-data', { headers: { 'X-App-Password': token } });
             if (!response.ok) {
                 if (response.status === 401 || response.status === 403) { sessionStorage.removeItem(AUTH_KEY); setIsAuthenticated(false); setAuthError("Сесія недійсна. Увійдіть знову."); }
                 throw new Error(`HTTP error! status: ${response.status}`);
             }
             const data = await response.json();
             if (!Array.isArray(data.transactions) || !Array.isArray(data.accounts) || !Array.isArray(data.categories)) { throw new Error("Invalid data structure."); }
             // Логіка очистки даних
             const cleanedTransactions = data.transactions.map((tx: any) => ({ date: typeof tx.date === 'string' ? tx.date.trim() : null, amount: typeof tx.amount === 'number' && !isNaN(tx.amount) ? tx.amount : parseFloat(String(tx.amount || '0').replace(/,/g, '.').replace(/\s/g, '')) || 0, type: String(tx?.type || '').trim(), account: String(tx?.account || '').trim(), category: String(tx?.category || '').trim(), description: String(tx?.description || '').trim(), })).filter((tx: Transaction) => { const isValid = tx.date && (tx.type === 'Надходження' || tx.type === 'Витрата') && tx.account && tx.category && typeof tx.amount === 'number' && !isNaN(tx.amount); return isValid; });
             const cleanedAccounts = data.accounts.flat().map((acc: any) => String(acc || '').trim()).filter(Boolean);
             const cleanedCategories = data.categories.map((cat: any) => ({ name: String(cat?.name || '').trim(), type: String(cat?.type || '').trim() })).filter((cat: CategoryInfo) => cat.name && (cat.type === 'Надходження' || cat.type === 'Витрата'));
             setAllTransactions(cleanedTransactions); setAccounts(cleanedAccounts); setCategories(cleanedCategories);
           } catch (err) { setError(err instanceof Error ? err.message : 'An unknown error occurred.'); console.error("Failed to fetch data:", err); }
           finally { setIsLoading(false); }
        };
        fetchData();
    }, [isAuthenticated]); // Залежимо від isAuthenticated

    // --- Функція Перевірки Паролю при Сабміті Форми ---
    const handlePasswordSubmit = async (passwordAttempt: string): Promise<boolean> => {
        setAuthLoading(true); setAuthError(null);
        try {
             const response = await fetch('/api/sheet-data', { headers: { 'X-App-Password': passwordAttempt } });
             if (response.ok) {
                 sessionStorage.setItem(AUTH_KEY, passwordAttempt);
                 setIsAuthenticated(true); // Впускаємо! Дані завантажаться в useEffect
                 setAuthLoading(false);
                 return true;
             } else if (response.status === 401 || response.status === 403) {
                setAuthError("Невірний пароль."); sessionStorage.removeItem(AUTH_KEY); setIsAuthenticated(false);
             } else { throw new Error(`Server error: ${response.status}`); }
        } catch (err) { setAuthError("Помилка мережі або сервера."); sessionStorage.removeItem(AUTH_KEY); setIsAuthenticated(false); console.error(err); }
        setAuthLoading(false); return false;
    };

    // --- Обробники фільтрів ---
    const handleAccountChange = useCallback((account: string) => { setSelectedAccounts(prev => prev.includes(account) ? prev.filter(a => a !== account) : [...prev, account]); }, []);
    const handleSelectAllAccounts = useCallback(() => { setSelectedAccounts(prev => prev.length === accounts.length ? [] : accounts); }, [accounts]);
    const handleCategoryChange = useCallback((category: string) => { setSelectedCategories(prev => prev.includes(category) ? prev.filter(c => c !== category) : [...prev, category]); }, []);
    const incomeCategories = useMemo(() => categories.filter(c => c.type === 'Надходження').map(c => c.name), [categories]);
    const expenseCategories = useMemo(() => categories.filter(c => c.type === 'Витрата').map(c => c.name), [categories]);
    const handleSelectAllIncomeCategories = useCallback(() => { const otherSelected = selectedCategories.filter(sc => !incomeCategories.includes(sc)); const allIncomeSelected = incomeCategories.length > 0 && incomeCategories.every(ic => selectedCategories.includes(ic)); if (allIncomeSelected) { setSelectedCategories(otherSelected); } else { setSelectedCategories(Array.from(new Set([...otherSelected, ...incomeCategories]))); } }, [incomeCategories, selectedCategories]);
    const handleSelectAllExpenseCategories = useCallback(() => { const otherSelected = selectedCategories.filter(sc => !expenseCategories.includes(sc)); const allExpenseSelected = expenseCategories.length > 0 && expenseCategories.every(ec => selectedCategories.includes(ec)); if (allExpenseSelected) { setSelectedCategories(otherSelected); } else { setSelectedCategories(Array.from(new Set([...otherSelected, ...expenseCategories]))); } }, [expenseCategories, selectedCategories]);
    // Повна функція setDateRangePreset з ініціалізацією
    const setDateRangePreset = useCallback((preset: 'last_month' | 'last_3_months' | 'last_12_months') => { const today = new Date(); let year = today.getFullYear(); let month = today.getMonth(); let startDate: Date = new Date(); let endDate: Date = new Date(); switch(preset) { case 'last_month': endDate = new Date(year, month, 0); startDate = new Date(endDate.getFullYear(), endDate.getMonth(), 1); break; case 'last_3_months': endDate = new Date(year, month, 0); startDate = new Date(endDate.getFullYear(), endDate.getMonth() - 2, 1); break; case 'last_12_months': endDate = new Date(year, month, 0); startDate = new Date(endDate.getFullYear(), endDate.getMonth() - 11, 1); break; } if (!isNaN(startDate.getTime()) && !isNaN(endDate.getTime())) { setStartDate(formatDateForInput(startDate)); setEndDate(formatDateForInput(endDate)); } else { console.error("Error calculating date preset", preset, startDate, endDate); } }, []);

    // === РОЗРАХУНОК ПОКАЗНИКІВ ДЛЯ ШАПКИ ===
    // Розраховуємо тут, оскільки потрібні allTransactions
    const headerMetrics = useMemo(() => {
        // Розраховуємо тільки якщо є транзакції та рахунки
        if (!Array.isArray(accounts) || !Array.isArray(allTransactions) || !isAuthenticated) {
            return { currentTotalBalance: 0, runwayMonths: null, balanceTooltipText: "Завантаження..." };
        }
        const today = new Date(); today.setUTCHours(23, 59, 59, 999);
        const currentBalanceDetails: BalanceDetails = {};
        accounts.forEach(acc => currentBalanceDetails[acc] = 0);

        allTransactions.forEach(tx => {
            const txDate = parseDate(tx.date);
            if (currentBalanceDetails.hasOwnProperty(tx.account) && txDate && txDate <= today) {
                const amount = tx.amount;
                currentBalanceDetails[tx.account] += (tx.type === 'Надходження' ? amount : -amount);
            }
        });
        const currentTotalBalance = Object.values(currentBalanceDetails).reduce((sum, bal) => sum + bal, 0);
        // Розрахунок Ранвею
        const threeMonthsAgo = new Date(today.getUTCFullYear(), today.getUTCMonth() - 3, 1);
        const lastMonthEnd = new Date(today.getUTCFullYear(), today.getUTCMonth(), 0); lastMonthEnd.setUTCHours(23,59,59,999);
        let totalExpensesLast3Months = 0;
        allTransactions.forEach(tx => { const txDate = parseDate(tx.date); const amount = tx.amount; if (tx.type === 'Витрата' && txDate && txDate >= threeMonthsAgo && txDate <= lastMonthEnd) { totalExpensesLast3Months += amount; } });
        const avgMonthlyExpense = totalExpensesLast3Months > 0 ? totalExpensesLast3Months / 3 : 0;
        let runwayMonths: number | null | typeof Infinity = null;
        if (avgMonthlyExpense > 0 && currentTotalBalance > 0) { runwayMonths = currentTotalBalance / avgMonthlyExpense; }
        else if (currentTotalBalance >= 0 && avgMonthlyExpense <= 0) { runwayMonths = Infinity; }
        const balanceTooltipText = accounts.map(acc => `${acc}: ${formatNumber(currentBalanceDetails[acc] || 0)} ₴`).join('\n');
        return { currentTotalBalance, runwayMonths, balanceTooltipText };
    }, [allTransactions, accounts, isAuthenticated]); // Додаємо залежність від isAuthenticated

    // === ОБРОБКА ДАНИХ ДЛЯ ГРАФІКА ТА ТАБЛИЦІ ===
    // Повний useMemo для processedData
    const processedData = useMemo(() => {
        if (!isAuthenticated || isLoading || !Array.isArray(allTransactions) || !Array.isArray(accounts)) return { filteredTransactions: [], barChartData: [] };
        const startFilterDate = startDate ? parseDate(startDate) : null; const endFilterDate = endDate ? parseDate(endDate) : null; if (startFilterDate) startFilterDate.setUTCHours(0, 0, 0, 0); if (endFilterDate) endFilterDate.setUTCHours(23, 59, 59, 999); const accountsToConsider = selectedAccounts.length > 0 ? selectedAccounts : accounts; if (!Array.isArray(accountsToConsider)) return { filteredTransactions: [], barChartData: [] }; const balanceDetailsAtStart: BalanceDetails = {}; accountsToConsider.forEach(acc => balanceDetailsAtStart[acc] = 0); allTransactions.forEach(tx => { const txDate = parseDate(tx.date); const accountMatches = accountsToConsider.includes(tx.account); if (txDate && accountMatches && (!startFilterDate || txDate < startFilterDate)) { const amount = tx.amount; balanceDetailsAtStart[tx.account] = (balanceDetailsAtStart[tx.account] || 0) + (tx.type === 'Надходження' ? amount : -amount); } }); const filteredTransactionsForPeriod = allTransactions.filter(tx => { if (typeof tx.amount !== 'number' || isNaN(tx.amount)) return false; const typeMatch = selectedType === 'Всі' || tx.type === selectedType; if (!typeMatch) return false; const accountMatch = selectedAccounts.length === 0 || selectedAccounts.includes(tx.account); if (!accountMatch) return false; const categoryMatch = selectedCategories.length === 0 || selectedCategories.includes(tx.category); if (!categoryMatch) return false; const txDate = parseDate(tx.date); if (!txDate) return false; const startDateMatch = !startFilterDate || txDate >= startFilterDate; if (!startDateMatch) return false; const endDateMatch = !endFilterDate || txDate <= endFilterDate; if (!endDateMatch) return false; return true; }); const allMonthsInRange: { key: string; name: string }[] = []; if (startFilterDate && endFilterDate && startFilterDate <= endFilterDate) { let currentMonth = new Date(Date.UTC(startFilterDate.getUTCFullYear(), startFilterDate.getUTCMonth(), 1)); while (currentMonth <= endFilterDate) { const monthYearKey = `${currentMonth.getUTCFullYear()}-${(currentMonth.getUTCMonth() + 1).toString().padStart(2, '0')}`; const monthName = currentMonth.toLocaleString('uk-UA', { month: 'short', year: 'numeric', timeZone: 'UTC' }); allMonthsInRange.push({ key: monthYearKey, name: monthName }); if (currentMonth.getUTCMonth() === 11) { currentMonth = new Date(Date.UTC(currentMonth.getUTCFullYear() + 1, 0, 1)); } else { currentMonth.setUTCMonth(currentMonth.getUTCMonth() + 1); } } } const monthlyActivityMap: { [key: string]: any } = {}; allMonthsInRange.forEach(monthInfo => { monthlyActivityMap[monthInfo.key] = { income: 0, expense: 0, incomeDetails: {}, expenseDetails: {}, balanceChangeDetails: {} }; accountsToConsider.forEach(acc => { monthlyActivityMap[monthInfo.key].balanceChangeDetails[acc] = 0; }); }); filteredTransactionsForPeriod.forEach(tx => { const txDate = parseDate(tx.date); if (txDate) { const monthYear = `${txDate.getUTCFullYear()}-${(txDate.getUTCMonth() + 1).toString().padStart(2, '0')}`; if (monthlyActivityMap[monthYear]) { const monthEntry = monthlyActivityMap[monthYear]; const category = tx.category; const account = tx.account; const amount = tx.amount; const amountChange = (tx.type === 'Надходження' ? amount : -amount); if (tx.type === 'Надходження') { monthEntry.income += amount; monthEntry.incomeDetails[category] = (monthEntry.incomeDetails[category] || 0) + amount; } else if (tx.type === 'Витрата') { monthEntry.expense += amount; monthEntry.expenseDetails[category] = (monthEntry.expenseDetails[category] || 0) + amount; } if (accountsToConsider.includes(account)) { monthEntry.balanceChangeDetails[account] = (monthEntry.balanceChangeDetails[account] || 0) + amountChange; } } } }); const runningBalanceDetails = { ...balanceDetailsAtStart }; const barChartData: MonthlyChartData[] = allMonthsInRange.map(monthInfo => { const activity = monthlyActivityMap[monthInfo.key]; const balanceChanges = activity.balanceChangeDetails; Object.keys(balanceChanges).forEach(account => { if (runningBalanceDetails.hasOwnProperty(account)) { runningBalanceDetails[account] = (runningBalanceDetails[account] || 0) + balanceChanges[account]; } }); const endOfMonthBalance = Object.values(runningBalanceDetails).reduce((sum, bal) => sum + (typeof bal === 'number' ? bal : 0), 0); return { name: monthInfo.name, income: activity.income, expense: activity.expense, balance: endOfMonthBalance, incomeDetails: activity.incomeDetails, expenseDetails: activity.expenseDetails, balanceDetails: { ...runningBalanceDetails } }; });
        return { filteredTransactions: filteredTransactionsForPeriod, barChartData };
    }, [isAuthenticated, isLoading, allTransactions, startDate, endDate, selectedAccounts, selectedCategories, selectedType, accounts]);


    // --- Компонент для Кастомної Підказки (Tooltip) ---
    // Повний CustomTooltip
    const CustomTooltip = ({ active, payload, label }: any) => { if (active && payload && payload.length && processedData && Array.isArray(processedData.barChartData)) { const currentMonthData = processedData.barChartData.find(d => d.name === label); if (!currentMonthData) return null; const renderDetails = (details: { [key: string]: number }, type: 'income' | 'expense' | 'balance') => { const colorClass = type === 'income' ? 'text-green-600' : type === 'expense' ? 'text-red-600' : 'text-blue-600'; const accountsToConsider = selectedAccounts.length > 0 ? selectedAccounts : accounts; let detailsToShow: [string, number][]; if (type === 'balance') { const fullBalanceDetails: BalanceDetails = {}; accountsToConsider.forEach(acc => { fullBalanceDetails[acc] = details[acc] || 0; }); detailsToShow = Object.entries(fullBalanceDetails).filter(([, amount]) => Math.abs(amount) > 0.001).sort(([,a],[,b]) => b - a); if (detailsToShow.length === 0) { if (accountsToConsider.length > 0) return <p key={accountsToConsider[0]} className={`text-xs ${colorClass}`}> - {accountsToConsider[0]}: {formatNumber(0)} ₴</p>; else return <p className="text-xs text-gray-500 italic">- немає рахунків -</p>; } } else { detailsToShow = Object.entries(details).filter(([, amount]) => Math.abs(amount) > 0.001).sort(([, a], [, b]) => b - a); if(detailsToShow.length === 0) return <p className="text-xs text-gray-500 italic">- немає деталей -</p>; } return detailsToShow.map(([key, amount]) => ( <p key={key} className={`text-xs ${colorClass}`}> - {key}: {formatNumber(amount)} ₴</p> )); }; const incomePayload = payload.find((p: any) => p.dataKey === 'income'); const expensePayload = payload.find((p: any) => p.dataKey === 'expense'); const balancePayload = payload.find((p: any) => p.dataKey === 'balance'); return ( <div className="bg-white p-3 shadow-lg border rounded text-sm opacity-95 max-w-xs z-50 relative"> <p className="font-bold mb-2 text-center">{label}</p> {balancePayload && currentMonthData.balanceDetails && ( <> <p className="text-blue-600 font-semibold">Баланс (кінець міс.): {formatNumber(currentMonthData.balance)} ₴</p> <div className="pl-2 my-1">{renderDetails(currentMonthData.balanceDetails, 'balance')}</div> </> )} {incomePayload && currentMonthData.income !== 0 && currentMonthData.incomeDetails && ( <> <p className="text-green-600 font-semibold mt-1">Надходження: {formatNumber(currentMonthData.income)} ₴</p> <div className="pl-2 my-1">{renderDetails(currentMonthData.incomeDetails, 'income')}</div> </> )} {expensePayload && currentMonthData.expense !== 0 && currentMonthData.expenseDetails && ( <> <p className="text-red-600 font-semibold mt-1">Витрати: {formatNumber(currentMonthData.expense)} ₴</p> <div className="pl-2 my-1">{renderDetails(currentMonthData.expenseDetails, 'expense')}</div> </> )} </div> ); } return null; };


    // --- РЕНДЕР КОМПОНЕНТА ---
    return (
        <div>
            {/* Форма Паролю */}
            {!isAuthenticated && (
                <PasswordForm
                    onSubmit={handlePasswordSubmit}
                    error={authError}
                    isLoading={authLoading}
                />
            )}

            {/* Основний контент */}
            {isAuthenticated && (
                <>
                    {/* **ПОВНИЙ JSX ФІЛЬТРІВ З АДАПТАЦІЄЮ** */}
                    <div className="mb-6 p-3 md:p-4 border rounded bg-gray-50 space-y-4">
                        {/* Перший рядок */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-x-4 gap-y-3 items-end">
                             {/* Колонка 1: Дати */}
                             <div className="flex flex-col sm:flex-row gap-2 md:col-span-1">
                                 <div className='flex-1 min-w-[120px]'> <label htmlFor="trans-startDate" className="block text-xs font-medium text-gray-600 mb-1">Період Від</label> <input id="trans-startDate" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="w-full p-1.5 border border-gray-300 rounded text-xs md:text-sm shadow-sm focus:ring-1 focus:ring-blue-500 focus:border-blue-500"/> </div>
                                 <div className='flex-1 min-w-[120px]'> <label htmlFor="trans-endDate" className="block text-xs font-medium text-gray-600 mb-1">Період До</label> <input id="trans-endDate" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="w-full p-1.5 border border-gray-300 rounded text-xs md:text-sm shadow-sm focus:ring-1 focus:ring-blue-500 focus:border-blue-500"/> </div>
                             </div>
                             {/* Колонка 2: Швидкі Періоди */}
                             <div className="md:col-span-1">
                                 <label className="block text-xs font-medium text-gray-600 mb-1 invisible">Швидкі Періоди</label>
                                 <div className="flex space-x-2">
                                     <button onClick={() => setDateRangePreset('last_month')} className="flex-1 px-2 py-1.5 text-[10px] xs:text-xs border border-gray-300 rounded bg-white hover:bg-gray-50 shadow-sm">Місяць</button>
                                     <button onClick={() => setDateRangePreset('last_3_months')} className="flex-1 px-2 py-1.5 text-[10px] xs:text-xs border border-gray-300 rounded bg-white hover:bg-gray-50 shadow-sm">3 міс.</button>
                                     <button onClick={() => setDateRangePreset('last_12_months')} className="flex-1 px-2 py-1.5 text-[10px] xs:text-xs border border-gray-300 rounded bg-white hover:bg-gray-50 shadow-sm">12 міс.</button>
                                 </div>
                             </div>
                              {/* Колонка 3: Тип */}
                              <div className="md:col-span-1">
                                 <label className="block text-xs font-medium text-gray-600 mb-1">Тип</label>
                                 <div className="flex rounded border border-gray-300 overflow-hidden shadow-sm">
                                   {(['Всі', 'Надходження', 'Витрата'] as const).map((type, index) => ( <button key={type} onClick={() => setSelectedType(type)} className={`flex-1 px-2 py-1.5 text-[11px] sm:text-sm text-center transition-colors duration-150 ease-in-out ${selectedType === type ? 'bg-blue-600 text-white' : 'bg-white text-gray-700 hover:bg-gray-100'} ${index > 0 ? 'border-l border-gray-300' : ''}`} > {type} </button> ))}
                                 </div>
                              </div>
                        </div>
                         {/* --- Другий Рядок (стає колонкою на моб) --- */}
                         <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-start md:items-stretch pt-2"> {/* Змінив sm на md, items-start */}
                             {/* Колонка 1: Рахунки */}
                             <div className="flex flex-col">
                                <div className="flex justify-between items-center mb-1 flex-shrink-0">
                                    <label className="block text-xs md:text-sm font-medium text-gray-700">Рахунки</label>
                                    {/* **ОНОВЛЕНО КОЛІР** */}
                                    <button onClick={handleSelectAllAccounts} className="text-xs text-[#8884D8] hover:text-[#6c63b8] hover:underline"> {accounts.length > 0 && selectedAccounts.length === accounts.length ? 'Зняти всі' : 'Вибрати всі'} </button>
                                </div>
                                {/* Прибрали фіксовану висоту */}
                                <div className="border rounded p-2 bg-white space-y-1 shadow-sm overflow-y-auto flex-grow md:h-full md:min-h-[60px]"> {/* min-h для desktop */}
                                   {isLoading ? <p className="text-xs text-gray-400 p-1">Завантаження...</p> : Array.isArray(accounts) && accounts.length > 0 ? accounts.map(acc => ( <div key={acc} className="flex items-center"> <input type="checkbox" id={`trans-acc-${acc}`} checked={selectedAccounts.includes(acc)} onChange={() => handleAccountChange(acc)} className="h-3.5 w-3.5 text-blue-600 border-gray-300 rounded mr-1.5 focus:ring-blue-500 focus:ring-offset-0"/> <label htmlFor={`trans-acc-${acc}`} className="text-xs select-none cursor-pointer">{acc}</label> </div> )) : <p className="text-xs text-gray-400 p-1">Немає рахунків</p>}
                                </div>
                            </div>
                            {/* Колонка 2: Категорії Надходжень */}
                            <div className="flex flex-col">
                                 <div className='flex justify-between items-center mb-1 flex-shrink-0'>
                                     <label className="block text-xs md:text-sm font-medium text-gray-700">Кат. Надходжень</label>
                                      {/* **ОНОВЛЕНО КОЛІР** */}
                                      <button onClick={handleSelectAllIncomeCategories} className="text-xs text-[#8884D8] hover:text-[#6c63b8] hover:underline"> {incomeCategories.length > 0 && incomeCategories.every(ic => selectedCategories.includes(ic)) ? 'Зняти всі' : 'Вибрати всі'} </button>
                                 </div>
                                 <div className="border rounded p-2 bg-white space-y-1 shadow-sm overflow-y-auto flex-grow md:h-full md:min-h-[60px]">
                                    {isLoading ? <p className="text-xs text-gray-400 p-1">Завантаження...</p> : Array.isArray(categories) && incomeCategories.length > 0 ? incomeCategories.map(catName => ( <div key={`inc-${catName}`} className="flex items-center"> <input type="checkbox" id={`trans-cat-inc-${catName}`} checked={selectedCategories.includes(catName)} onChange={() => handleCategoryChange(catName)} className="h-3.5 w-3.5 text-blue-600 border-gray-300 rounded mr-1.5 focus:ring-blue-500 focus:ring-offset-0"/> <label htmlFor={`trans-cat-inc-${catName}`} className="text-xs select-none cursor-pointer">{catName}</label> </div> )) : <p className="text-xs text-gray-400 p-1">Немає категорій надходжень</p>}
                                 </div>
                            </div>
                            {/* Колонка 3: Категорії Витрат */}
                            <div className="flex flex-col">
                                 <div className='flex justify-between items-center mb-1 flex-shrink-0'>
                                     <label className="block text-xs md:text-sm font-medium text-gray-700">Категорії (Витрати)</label>
                                      {/* **ОНОВЛЕНО КОЛІР** */}
                                      <button onClick={handleSelectAllExpenseCategories} className="text-xs text-[#8884D8] hover:text-[#6c63b8] hover:underline"> {expenseCategories.length > 0 && expenseCategories.every(ec => selectedCategories.includes(ec)) ? 'Зняти всі' : 'Вибрати всі'} </button>
                                 </div>
                                 <div className="border rounded p-2 bg-white space-y-1 shadow-sm overflow-y-auto flex-grow md:h-full md:min-h-[60px]">
                                    {isLoading ? <p className="text-xs text-gray-400 p-1">Завантаження...</p> : Array.isArray(categories) && expenseCategories.length > 0 ? expenseCategories.map(catName => ( <div key={`exp-${catName}`} className="flex items-center"> <input type="checkbox" id={`trans-cat-exp-${catName}`} checked={selectedCategories.includes(catName)} onChange={() => handleCategoryChange(catName)} className="h-3.5 w-3.5 text-blue-600 border-gray-300 rounded mr-1.5 focus:ring-blue-500 focus:ring-offset-0"/> <label htmlFor={`trans-cat-exp-${catName}`} className="text-xs select-none cursor-pointer">{catName}</label> </div> )) : <p className="text-xs text-gray-400 p-1">Немає категорій витрат</p>}
                                 </div>
                            </div>
                         </div>
                   </div>
                   {/* --- Кінець ФІЛЬТРІВ --- */}


                   {/* --- Графік --- */}
                   {/* Повний JSX Графіка */}
                   {isLoading && <p className="mt-6 text-center text-sm">Завантаження звіту...</p>}
                   {error && <p className="mt-6 text-red-600 text-center text-sm">Помилка: {error}</p>}
                   {!isLoading && !error && (
                        <div className="p-2 sm:p-4 border rounded shadow bg-white mb-6 min-h-[350px]">
                            <h2 className="text-base md:text-lg font-semibold mb-4 text-center">Динаміка за Період</h2>
                            {processedData.barChartData.length > 0 ? (
                               <ResponsiveContainer width="100%" height={300}>
                                  <BarChart data={processedData.barChartData} margin={{ top: 5, right: 0, left: -20, bottom: 0 }}>
                                    <CartesianGrid strokeDasharray="3 3" />
                                    <XAxis dataKey="name" fontSize={10} tick={{ transform: 'translate(0, 5)' }}/>
                                    <YAxis tickFormatter={(value) => formatNumber(value)} fontSize={10} width={65}/>
                                    {/* ПОВЕРНУЛИ КАСТОМНИЙ TOOLTIP */}
                                    <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(206, 212, 218, 0.3)' }} wrapperStyle={{ zIndex: 50 }} />
                                    <Legend wrapperStyle={{fontSize: "10px", paddingTop: '10px'}}/>
                                    <Bar dataKey="income" fill="#00C49F" name="Надходження" radius={[3, 3, 0, 0]} />
                                    <Bar dataKey="expense" fill="#FF8042" name="Витрати" radius={[3, 3, 0, 0]} />
                                    <Bar dataKey="balance" fill="#8884D8" name="Баланс" radius={[3, 3, 0, 0]} /> {/* Скоротив назву */}
                                  </BarChart>
                               </ResponsiveContainer>
                            ) : ( <p className="text-center text-gray-500 pt-10 text-sm">Немає даних для звіту.</p> )}
                       </div>
                   )}
                   {/* --- Кінець Графіка --- */}


                   {/* --- Таблиця транзакцій --- */}
                   {/* Повний JSX Таблиці */}
                   {isLoading && <p className="mt-4 text-center text-sm">Завантаження транзакцій...</p>}
                   {!isLoading && !error && (
                       <div className="overflow-x-auto mt-4">
                          <h2 className="text-base md:text-lg font-semibold mb-2 text-center">Детальні Транзакції за Період</h2>
                          <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                              <tr>
                                <th scope="col" className="px-2 py-2 text-left text-[10px] md:text-xs font-medium text-gray-500 uppercase tracking-wider">Дата</th>
                                <th scope="col" className="px-2 py-2 text-right text-[10px] md:text-xs font-medium text-gray-500 uppercase tracking-wider">Сума</th>
                                <th scope="col" className="px-2 py-2 text-left text-[10px] md:text-xs font-medium text-gray-500 uppercase tracking-wider">Опис</th>
                                <th scope="col" className="px-2 py-2 text-left text-[10px] md:text-xs font-medium text-gray-500 uppercase tracking-wider">Категорія</th>
                                <th scope="col" className="px-2 py-2 text-left text-[10px] md:text-xs font-medium text-gray-500 uppercase tracking-wider">Рахунок</th>
                              </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                              {processedData.filteredTransactions.length === 0 ? (
                                <tr> <td colSpan={5} className="px-3 py-3 text-center text-xs md:text-sm text-gray-500">Транзакцій не знайдено</td> </tr>
                              ) : (
                                processedData.filteredTransactions
                                  .sort((a, b) => { const dateA = parseDate(a.date); const dateB = parseDate(b.date); if (!dateA && !dateB) return 0; if (!dateA) return 1; if (!dateB) return -1; return dateB.getTime() - dateA.getTime(); })
                                  .map((tx, index) => (
                                    <tr key={`${tx.date}-${index}-${tx.amount}`} className={`${tx.type === 'Витрата' ? 'bg-red-50 hover:bg-red-100' : 'bg-green-50 hover:bg-green-100'} transition-colors duration-150 ease-in-out`}>
                                      <td className="px-2 py-2 whitespace-nowrap text-[11px] md:text-sm text-gray-900">{tx.date}</td>
                                      <td className={`px-2 py-2 whitespace-nowrap text-[11px] md:text-sm text-right font-medium ${tx.type === 'Витрата' ? 'text-[#FF8042]' : 'text-[#00C49F]'}`}> {tx.type === 'Витрата' ? '-' : '+'} {formatNumber(tx.amount)} ₴ </td>
                                      <td className="px-2 py-2 text-[11px] md:text-sm text-gray-500 max-w-[100px] md:max-w-[200px] truncate">{tx.description}</td>
                                      <td className="px-2 py-2 whitespace-nowrap text-[11px] md:text-sm text-gray-500">{tx.category}</td>
                                      <td className="px-2 py-2 whitespace-nowrap text-[11px] md:text-sm text-gray-500">{tx.account}</td>
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

export default HomePage; // Назва компонента відповідає файлу page.tsx
