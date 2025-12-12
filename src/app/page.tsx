'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
    ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
    PieChart, Pie, Cell
} from 'recharts';

// --- Типи даних ---
interface Transaction {
  date: string | null;
  amount: number;
  type: string; // 'Надходження' або 'Витрата'
  account: string;
  category: string;
  description: string;
  counterparty?: string; // Опціональне поле контрагента
  project?: string; // Опціональне поле проекту
}
interface CategoryInfo {
    name: string;
    type: string; // 'Надходження' або 'Витрата'
}
interface MonthlyChartData {
    name: string; // Місяць
    income: number;
    expense: number;
    balance: number; // Баланс на кінець місяця
    incomeDetails: { [category: string]: number };
    expenseDetails: { [category: string]: number };
    balanceDetails: { [account: string]: number }; // Деталізація балансу по рахунках
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
    if (!dateString || typeof dateString !== 'string') return null;
    try {
        // Спочатку спробуємо '-':MM-DD
        let parts = dateString.split('-');
        if (parts.length === 3 && parts[0].length === 4 && parts[1].length === 2 && parts[2].length === 2) {
            const year = parseInt(parts[0], 10);
            const month = parseInt(parts[1], 10); // 1-12
            const day = parseInt(parts[2], 10);
            if (!isNaN(year) && !isNaN(month) && !isNaN(day) && month >= 1 && month <= 12 && day >= 1 && day <= 31) {
               const date = new Date(Date.UTC(year, month - 1, day));
               if (!isNaN(date.getTime()) && date.getUTCDate() === day && date.getUTCMonth() === month - 1 && date.getUTCFullYear() === year) {
                   return date;
               }
            }
        }
        // Потім спробуємо DD.MM.'':''
        parts = dateString.split('.');
        if (parts.length === 3 && parts[0].length === 2 && parts[1].length === 2 && parts[2].length === 4) {
            const day = parseInt(parts[0], 10);
            const month = parseInt(parts[1], 10); // 1-12
            const year = parseInt(parts[2], 10);
             if (!isNaN(year) && !isNaN(month) && !isNaN(day) && month >= 1 && month <= 12 && day >= 1 && day <= 31) {
                 const date = new Date(Date.UTC(year, month - 1, day));
                 if (!isNaN(date.getTime()) && date.getUTCDate() === day && date.getUTCMonth() === month - 1 && date.getUTCFullYear() === year) {
                     return date;
                 }
             }
        }
    } catch (e) {
        console.error("Error parsing date string:", dateString, e);
    }
    console.warn("Could not parse date string:", dateString);
    return null; // Гарантований return null
};

const formatDateForInput = (date: Date): string => {
    if (!(date instanceof Date) || isNaN(date.getTime())) {
        console.warn("Invalid date passed to formatDateForInput, using today.", date);
        date = new Date();
    }
    try {
        const year = date.getUTCFullYear();
        const month = (date.getUTCMonth() + 1).toString().padStart(2, '0');
        const day = date.getUTCDate().toString().padStart(2, '0');
        return `${year}-${month}-${day}`;
    } catch (e) {
        console.error("Error formatting date for input:", date, e);
        const today = new Date();
        const year = today.getFullYear();
        const month = (today.getMonth() + 1).toString().padStart(2, '0');
        const day = today.getDate().toString().padStart(2, '0');
        return `${year}-${month}-${day}`;
    }
};
// --- Кінець хелперів ---

// Компонент для тултіпа з розрахунком
const TooltipWithCalculation: React.FC<{
    children: React.ReactNode;
    calculation: string;
}> = ({ children, calculation }) => {
    const [isVisible, setIsVisible] = useState(false);

    return (
        <div className="relative inline-flex items-center gap-1">
            {children}
            <button
                className="text-gray-400 hover:text-gray-600 cursor-help text-xs font-bold"
                onMouseEnter={() => setIsVisible(true)}
                onMouseLeave={() => setIsVisible(false)}
                onClick={() => setIsVisible(!isVisible)}
                aria-label="Показати розрахунок"
            >
                (+)
            </button>
            {isVisible && (
                <div className="absolute z-50 bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-gray-900 text-white text-xs rounded-lg shadow-lg whitespace-pre-line min-w-[200px] max-w-[300px]">
                    <div className="text-left">{calculation}</div>
                    <div className="absolute top-full left-1/2 transform -translate-x-1/2 -mt-1">
                        <div className="border-4 border-transparent border-t-gray-900"></div>
                    </div>
                </div>
            )}
        </div>
    );
};

const TransactionsPage: React.FC = () => {
    // --- Стан ---
    const [allTransactions, setAllTransactions] = useState<Transaction[]>([]);
    const [accounts, setAccounts] = useState<string[]>([]);
    const [categories, setCategories] = useState<CategoryInfo[]>([]);
    const [counterparties, setCounterparties] = useState<string[]>([]);
    const [projects, setProjects] = useState<string[]>([]);
    const [isLoading, setIsLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);
    // Повна функція getInitialDates
    const getInitialDates = useCallback(() => {
        const today = new Date();
        const hundredDaysAgo = new Date(today);
        hundredDaysAgo.setDate(today.getDate() - 99); // 100 днів включно з сьогодні
        return { start: formatDateForInput(hundredDaysAgo), end: formatDateForInput(today) }
    }, []); // Використовуємо useCallback

    const initialDates = useMemo(() => getInitialDates(), [getInitialDates]); // Викликаємо один раз

    const [startDate, setStartDate] = useState<string>(initialDates.start);
    const [endDate, setEndDate] = useState<string>(initialDates.end);
    const [selectedAccounts, setSelectedAccounts] = useState<string[]>([]);
    const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
    const [selectedCounterparties, setSelectedCounterparties] = useState<string[]>([]);
    const [selectedProjects, setSelectedProjects] = useState<string[]>([]);
    const [selectedType, setSelectedType] = useState<string>('Всі');

    // Стан для згортання фільтрів на мобільній версії
    const [expandedFilters, setExpandedFilters] = useState<{[key: string]: boolean}>({
        accounts: false,
        income: false,
        expense: false,
        counterparties: false,
        projects: false,
    });

    // Стан для сортування таблиці
    const [sortColumn, setSortColumn] = useState<string>('date');
    const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

    // Стан для згортання блоків графіків
    const [isChartDynamicsOpen, setIsChartDynamicsOpen] = useState<boolean>(true);
    const [isChartDistributionOpen, setIsChartDistributionOpen] = useState<boolean>(true);

    // --- Завантаження даних ---
    // Повний useEffect
    useEffect(() => {
        const fetchData = async () => {
           setIsLoading(true); setError(null);
           try {
             const response = await fetch('/api/sheet-data');
             if (!response.ok) { throw new Error(`HTTP error! status: ${response.status}`); }
             const data = await response.json();
             if (!Array.isArray(data.transactions) || !Array.isArray(data.accounts) || !Array.isArray(data.categories) || !Array.isArray(data.counterparties) || !Array.isArray(data.projects)) { throw new Error("Invalid data structure."); }
             const cleanedTransactions = data.transactions.map((tx: any) => ({ date: typeof tx.date === 'string' ? tx.date.trim() : null, amount: typeof tx.amount === 'number' && !isNaN(tx.amount) ? tx.amount : parseFloat(String(tx.amount || '0').replace(/,/g, '.').replace(/\s/g, '')) || 0, type: String(tx?.type || '').trim(), account: String(tx?.account || '').trim(), category: String(tx?.category || '').trim(), description: String(tx?.description || '').trim(), counterparty: tx?.counterparty ? String(tx.counterparty).trim() : '', project: tx?.project ? String(tx.project).trim() : '', })).filter((tx: Transaction, index: number) => { const isValid = tx.date && (tx.type === 'Надходження' || tx.type === 'Витрата') && tx.account && tx.category && typeof tx.amount === 'number' && !isNaN(tx.amount); if (!isValid) console.warn(`Workspace_DATA: Invalid transaction structure at raw index ${index}:`, data.transactions[index], 'Resulted in:', tx); return isValid; });
             const cleanedAccounts = data.accounts.flat().map((acc: any) => String(acc || '').trim()).filter(Boolean);
             const cleanedCategories = data.categories.map((cat: any) => ({ name: String(cat?.name || '').trim(), type: String(cat?.type || '').trim() })).filter((cat: CategoryInfo) => cat.name && (cat.type === 'Надходження' || cat.type === 'Витрата'));
             const cleanedCounterparties = data.counterparties.flat().map((cp: any) => String(cp || '').trim()).filter(Boolean);
             const cleanedProjects = data.projects.flat().map((proj: any) => String(proj || '').trim()).filter(Boolean);
             setAllTransactions(cleanedTransactions); setAccounts(cleanedAccounts); setCategories(cleanedCategories); setCounterparties(cleanedCounterparties); setProjects(cleanedProjects);
           } catch (err) { setError(err instanceof Error ? err.message : 'An unknown error occurred.'); console.error("Failed to fetch data:", err); }
           finally { setIsLoading(false); }
        };
        fetchData();
     }, []);

    // --- Обробники фільтрів ---
    // Повні обробники
    const handleAccountChange = useCallback((account: string) => { setSelectedAccounts(prev => prev.includes(account) ? prev.filter(a => a !== account) : [...prev, account]); }, []);
    const handleSelectAllAccounts = useCallback(() => { setSelectedAccounts(prev => prev.length === accounts.length ? [] : accounts); }, [accounts]);
    const handleCategoryChange = useCallback((category: string) => { setSelectedCategories(prev => prev.includes(category) ? prev.filter(c => c !== category) : [...prev, category]); }, []);
    const handleCounterpartyChange = useCallback((counterparty: string) => { setSelectedCounterparties(prev => prev.includes(counterparty) ? prev.filter(cp => cp !== counterparty) : [...prev, counterparty]); }, []);
    const handleSelectAllCounterparties = useCallback(() => { setSelectedCounterparties(prev => prev.length === counterparties.length ? [] : counterparties); }, [counterparties]);
    const handleProjectChange = useCallback((project: string) => { setSelectedProjects(prev => prev.includes(project) ? prev.filter(p => p !== project) : [...prev, project]); }, []);
    const handleSelectAllProjects = useCallback(() => { setSelectedProjects(prev => prev.length === projects.length ? [] : projects); }, [projects]);
    const incomeCategories = useMemo(() => categories.filter(c => c.type === 'Надходження').map(c => c.name), [categories]);
    const expenseCategories = useMemo(() => categories.filter(c => c.type === 'Витрата').map(c => c.name), [categories]);
    const handleSelectAllIncomeCategories = useCallback(() => { const otherSelected = selectedCategories.filter(sc => !incomeCategories.includes(sc)); const allIncomeSelected = incomeCategories.length > 0 && incomeCategories.every(ic => selectedCategories.includes(ic)); if (allIncomeSelected) { setSelectedCategories(otherSelected); } else { setSelectedCategories(Array.from(new Set([...otherSelected, ...incomeCategories]))); } }, [incomeCategories, selectedCategories]);
    const handleSelectAllExpenseCategories = useCallback(() => { const otherSelected = selectedCategories.filter(sc => !expenseCategories.includes(sc)); const allExpenseSelected = expenseCategories.length > 0 && expenseCategories.every(ec => selectedCategories.includes(ec)); if (allExpenseSelected) { setSelectedCategories(otherSelected); } else { setSelectedCategories(Array.from(new Set([...otherSelected, ...expenseCategories]))); } }, [expenseCategories, selectedCategories]);

    // Обробник для переключення фільтрів на мобільній версії
    const toggleFilter = useCallback((filterKey: string) => {
        setExpandedFilters(prev => ({
            ...prev,
            [filterKey]: !prev[filterKey]
        }));
    }, []);

    // Обробник сортування таблиці
    const handleSort = useCallback((column: string) => {
        if (sortColumn === column) {
            setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
        } else {
            setSortColumn(column);
            setSortDirection(column === 'date' ? 'desc' : 'asc');
        }
    }, [sortColumn]);

    // **ПОВНА ТА ВИПРАВЛЕНА функція setDateRangePreset**
    const setDateRangePreset = useCallback((preset: 'last_month' | 'last_3_months' | 'last_12_months') => {
        const today = new Date();
        let year = today.getFullYear();
        let month = today.getMonth(); // 0-11
        // **ВИПРАВЛЕННЯ: Ініціалізуємо startDate та endDate**
        let startDate: Date = new Date();
        let endDate: Date = new Date();

        switch(preset) {
            case 'last_month':
                // Кінець попереднього місяця
                endDate = new Date(year, month, 0);
                // Початок попереднього місяця
                startDate = new Date(endDate.getFullYear(), endDate.getMonth(), 1);
                break;
            case 'last_3_months':
                 // Кінець попереднього місяця
                endDate = new Date(year, month, 0);
                 // Початок місяця 3 місяці тому відносно кінцевої дати
                startDate = new Date(endDate.getFullYear(), endDate.getMonth() - 2, 1);
                break;
            case 'last_12_months':
                 // Кінець попереднього місяця
                 endDate = new Date(year, month, 0);
                 // Початок місяця 12 місяців тому (тобто за 11 місяців до кінцевого)
                 startDate = new Date(endDate.getFullYear(), endDate.getMonth() - 11, 1);
                break;
            // Немає потреби в default, оскільки тип preset обмежений
        }
        // Тепер startDate та endDate гарантовано мають значення Date перед форматуванням
        setStartDate(formatDateForInput(startDate));
        setEndDate(formatDateForInput(endDate));
    }, []); // Залежностей немає


    // === ОБРОБКА ДАНИХ ДЛЯ ГРАФІКА ТА ТАБЛИЦІ ===
    // Повний useMemo для processedData
    const processedData = useMemo(() => {
        const startFilterDate = startDate ? parseDate(startDate) : null;
        const endFilterDate = endDate ? parseDate(endDate) : null;
        if (startFilterDate) startFilterDate.setUTCHours(0, 0, 0, 0);
        if (endFilterDate) endFilterDate.setUTCHours(23, 59, 59, 999);

        const accountsToConsider = selectedAccounts.length > 0 ? selectedAccounts : accounts;
        if (!Array.isArray(accountsToConsider)) return { filteredTransactions: [], barChartData: [], shouldShowBalance: true };

        // Визначаємо чи показувати баланс на графіку
        const totalCategories = incomeCategories.length + expenseCategories.length;
        const allCategoriesSelected = selectedCategories.length === 0 || selectedCategories.length === totalCategories;
        const allCounterpartiesSelected = selectedCounterparties.length === 0 || selectedCounterparties.length === counterparties.length;
        const allProjectsSelected = selectedProjects.length === 0 || selectedProjects.length === projects.length;
        const allTypesSelected = selectedType === 'Всі';

        // Баланс показується, якщо:
        // 1. Всі фільтри вибрані або не активні
        // 2. АБО обрано проекти без інших фільтрів
        const onlyProjectsSelected = selectedProjects.length > 0 &&
                                      selectedCategories.length === 0 &&
                                      selectedCounterparties.length === 0 &&
                                      selectedAccounts.length === 0 &&
                                      allTypesSelected;
        const shouldShowBalance = (allCategoriesSelected && allCounterpartiesSelected && allProjectsSelected && allTypesSelected) || onlyProjectsSelected;

        // 1. Розрахунок початкового балансу
        const balanceDetailsAtStart: BalanceDetails = {};
        accountsToConsider.forEach(acc => balanceDetailsAtStart[acc] = 0);
        allTransactions.forEach(tx => {
            const txDate = parseDate(tx.date);
            const accountMatches = accountsToConsider.includes(tx.account);
            if (txDate && accountMatches && (!startFilterDate || txDate < startFilterDate)) {
                 const amount = typeof tx.amount === 'number' ? tx.amount : 0;
                 balanceDetailsAtStart[tx.account] = (balanceDetailsAtStart[tx.account] || 0) + (tx.type === 'Надходження' ? amount : -amount);
            }
        });

        // 2. Фільтруємо транзакції
        const filteredTransactionsForPeriod = allTransactions.filter(tx => {
            if (typeof tx.amount !== 'number' || isNaN(tx.amount)) return false;
            const typeMatch = selectedType === 'Всі' || tx.type === selectedType;
            if (!typeMatch) return false;
            const accountMatch = selectedAccounts.length === 0 || selectedAccounts.includes(tx.account);
            if (!accountMatch) return false;
            const categoryMatch = selectedCategories.length === 0 || selectedCategories.includes(tx.category);
            if (!categoryMatch) return false;
            const counterpartyMatch = selectedCounterparties.length === 0 || (tx.counterparty && selectedCounterparties.includes(tx.counterparty));
            if (!counterpartyMatch) return false;
            const projectMatch = selectedProjects.length === 0 || (tx.project && selectedProjects.includes(tx.project));
            if (!projectMatch) return false;
            const txDate = parseDate(tx.date);
            if (!txDate) return false; // Ігноруємо транзакції без дати
            const startDateMatch = !startFilterDate || txDate >= startFilterDate;
            if (!startDateMatch) return false;
            const endDateMatch = !endFilterDate || txDate <= endFilterDate;
            if (!endDateMatch) return false;
            return true;
        });

        // 3. Генеруємо місяці
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

        // 4. Групуємо транзакції
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
                    const category = tx.category; const account = tx.account; const amount = tx.amount; const amountChange = (tx.type === 'Надходження' ? amount : -amount);
                    if (tx.type === 'Надходження') { monthEntry.income += amount; monthEntry.incomeDetails[category] = (monthEntry.incomeDetails[category] || 0) + amount; }
                    else if (tx.type === 'Витрата') { monthEntry.expense += amount; monthEntry.expenseDetails[category] = (monthEntry.expenseDetails[category] || 0) + amount; }
                    if (accountsToConsider.includes(account)) { monthEntry.balanceChangeDetails[account] = (monthEntry.balanceChangeDetails[account] || 0) + amountChange; }
                }
            }
        });

        // 5. Розраховуємо баланс
        const runningBalanceDetails = { ...balanceDetailsAtStart };
        const barChartData: MonthlyChartData[] = allMonthsInRange.map(monthInfo => {
            const activity = monthlyActivityMap[monthInfo.key];
            const balanceChanges = activity.balanceChangeDetails;
            Object.keys(balanceChanges).forEach(account => { if (runningBalanceDetails.hasOwnProperty(account)) { runningBalanceDetails[account] = (runningBalanceDetails[account] || 0) + balanceChanges[account]; } });
            const endOfMonthBalance = Object.values(runningBalanceDetails).reduce((sum, bal) => sum + (typeof bal === 'number' ? bal : 0), 0);
            // Гарантований RETURN
            return { name: monthInfo.name, income: activity.income, expense: activity.expense, balance: endOfMonthBalance, incomeDetails: activity.incomeDetails, expenseDetails: activity.expenseDetails, balanceDetails: { ...runningBalanceDetails } };
        });

        return { filteredTransactions: filteredTransactionsForPeriod, barChartData, shouldShowBalance };

    }, [allTransactions, startDate, endDate, selectedAccounts, selectedCategories, selectedCounterparties, selectedProjects, selectedType, accounts, incomeCategories, expenseCategories, counterparties, projects]);

    // --- Розрахунок загальних сум для відображення під графіком ---
    const totalSums = useMemo(() => {
        const income = processedData.filteredTransactions
            .filter(tx => tx.type === 'Надходження')
            .reduce((sum, tx) => sum + tx.amount, 0);

        const expense = processedData.filteredTransactions
            .filter(tx => tx.type === 'Витрата')
            .reduce((sum, tx) => sum + tx.amount, 0);

        const balance = income - expense;

        return { income, expense, balance };
    }, [processedData.filteredTransactions]);

    // --- Розрахунок текстів для тултіпів підсумкових рядків ---
    const summaryCalculations = useMemo(() => {
        const { income, expense } = totalSums;

        // Отримуємо список транзакцій для детального розрахунку
        const incomeTransactions = processedData.filteredTransactions.filter(tx => tx.type === 'Надходження');
        const expenseTransactions = processedData.filteredTransactions.filter(tx => tx.type === 'Витрата');

        // Формуємо текст розрахунку для надходжень (до 10 транзакцій)
        let incomeCalc = 'Сума надходжень:\n';
        if (incomeTransactions.length <= 10) {
            incomeCalc += incomeTransactions.map(tx => `+ ${formatNumber(tx.amount)} ₴`).join('\n');
        } else {
            incomeCalc += incomeTransactions.slice(0, 8).map(tx => `+ ${formatNumber(tx.amount)} ₴`).join('\n');
            incomeCalc += `\n... ще ${incomeTransactions.length - 8} транзакцій ...`;
        }
        incomeCalc += `\n= ${formatNumber(income)} ₴`;

        // Формуємо текст розрахунку для видатків (до 10 транзакцій)
        let expenseCalc = 'Сума видатків:\n';
        if (expenseTransactions.length <= 10) {
            expenseCalc += expenseTransactions.map(tx => `+ ${formatNumber(tx.amount)} ₴`).join('\n');
        } else {
            expenseCalc += expenseTransactions.slice(0, 8).map(tx => `+ ${formatNumber(tx.amount)} ₴`).join('\n');
            expenseCalc += `\n... ще ${expenseTransactions.length - 8} транзакцій ...`;
        }
        expenseCalc += `\n= ${formatNumber(expense)} ₴`;

        return {
            income: incomeCalc,
            expense: expenseCalc
        };
    }, [totalSums, processedData.filteredTransactions]);

    // --- Розрахунок даних для pie charts розподілу по категоріям ---
    const categoryDistribution = useMemo(() => {
        const incomeByCategory: { [key: string]: number } = {};
        const expenseByCategory: { [key: string]: number } = {};

        processedData.filteredTransactions.forEach(tx => {
            if (tx.type === 'Надходження') {
                incomeByCategory[tx.category] = (incomeByCategory[tx.category] || 0) + tx.amount;
            } else if (tx.type === 'Витрата') {
                expenseByCategory[tx.category] = (expenseByCategory[tx.category] || 0) + tx.amount;
            }
        });

        const incomeData = Object.entries(incomeByCategory)
            .map(([name, value]) => ({ name, value }))
            .sort((a, b) => b.value - a.value);

        const expenseData = Object.entries(expenseByCategory)
            .map(([name, value]) => ({ name, value }))
            .sort((a, b) => b.value - a.value);

        return { incomeData, expenseData };
    }, [processedData.filteredTransactions]);

    // Кольори для pie charts
    const PIE_COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8', '#82CA9D', '#FFC658', '#FF7C7C', '#A4DE6C', '#D0ED57'];

    // --- Компонент для Кастомної Підказки (Tooltip) ---
    // Повний CustomTooltip
    const CustomTooltip = ({ active, payload, label }: any) => {
        if (active && payload && payload.length && processedData && Array.isArray(processedData.barChartData)) {
            const currentMonthData = processedData.barChartData.find(d => d.name === label);
            if (!currentMonthData) return null;
            const renderDetails = (details: { [key: string]: number }, type: 'income' | 'expense' | 'balance') => {
                 const colorClass = type === 'income' ? 'text-green-600' : type === 'expense' ? 'text-red-600' : 'text-blue-600';
                 const accountsToConsider = selectedAccounts.length > 0 ? selectedAccounts : accounts;
                 let detailsToShow: [string, number][];
                 if (type === 'balance') { const fullBalanceDetails: BalanceDetails = {}; accountsToConsider.forEach(acc => { fullBalanceDetails[acc] = details[acc] || 0; }); detailsToShow = Object.entries(fullBalanceDetails).filter(([, amount]) => Math.abs(amount) > 0.001).sort(([,a],[,b]) => b - a); if (detailsToShow.length === 0) { if (accountsToConsider.length > 0) return <p key={accountsToConsider[0]} className={`text-xs ${colorClass}`}> - {accountsToConsider[0]}: {formatNumber(0)} ₴</p>; else return <p className="text-xs text-gray-500 italic">- немає рахунків -</p>; } }
                 else { detailsToShow = Object.entries(details).filter(([, amount]) => Math.abs(amount) > 0.001).sort(([, a], [, b]) => b - a); if(detailsToShow.length === 0) return <p className="text-xs text-gray-500 italic">- немає деталей -</p>; }
                 return detailsToShow.map(([key, amount]) => ( <p key={key} className={`text-xs ${colorClass}`}> - {key}: {formatNumber(amount)} ₴</p> ));
            };
            const incomePayload = payload.find((p: any) => p.dataKey === 'income');
            const expensePayload = payload.find((p: any) => p.dataKey === 'expense');
            const balancePayload = payload.find((p: any) => p.dataKey === 'balance');
            return ( <div className="bg-white p-3 shadow-lg border rounded text-sm opacity-95 max-w-xs z-50 relative"> <p className="font-bold mb-2 text-center">{label}</p> {processedData.shouldShowBalance && balancePayload && currentMonthData.balanceDetails && ( <> <p className="text-blue-600 font-semibold">Баланс (кінець міс.): {formatNumber(currentMonthData.balance)} ₴</p> <div className="pl-2 my-1">{renderDetails(currentMonthData.balanceDetails, 'balance')}</div> </> )} {incomePayload && currentMonthData.income !== 0 && currentMonthData.incomeDetails && ( <> <p className="text-green-600 font-semibold mt-1">Надходження: {formatNumber(currentMonthData.income)} ₴</p> <div className="pl-2 my-1">{renderDetails(currentMonthData.incomeDetails, 'income')}</div> </> )} {expensePayload && currentMonthData.expense !== 0 && currentMonthData.expenseDetails && ( <> <p className="text-red-600 font-semibold mt-1">Витрати: {formatNumber(currentMonthData.expense)} ₴</p> <div className="pl-2 my-1">{renderDetails(currentMonthData.expenseDetails, 'expense')}</div> </> )} </div> );
        }
        return null;
    };


    // --- РЕНДЕР КОМПОНЕНТА ---
    return (
        <div>
          {/* --- ФІЛЬТРИ --- */}
          {/* Повний JSX Фільтрів */}
          <div className="mb-6 p-4 border rounded bg-gray-50 space-y-4">
               {/* --- Перший Рядок Фільтрів --- */}
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
                           {/* **ОНОВЛЕНО ВИКЛИКИ setDateRangePreset** */}
                           <button onClick={() => setDateRangePreset('last_month')} className="flex-1 px-2 py-1.5 text-xs border border-gray-300 rounded bg-white hover:bg-gray-50 shadow-sm">Місяць</button>
                           <button onClick={() => setDateRangePreset('last_3_months')} className="flex-1 px-2 py-1.5 text-xs border border-gray-300 rounded bg-white hover:bg-gray-50 shadow-sm">Квартал</button>
                           <button onClick={() => setDateRangePreset('last_12_months')} className="flex-1 px-2 py-1.5 text-xs border border-gray-300 rounded bg-white hover:bg-gray-50 shadow-sm">Рік</button>
                       </div>
                   </div>
                   {/* Колонка 3: Тип */}
                   <div className="md:col-span-1">
                      <label className="block text-xs font-medium text-gray-600 mb-1">Тип</label>
                      <div className="flex rounded border border-gray-300 overflow-hidden shadow-sm">
                        {(['Всі', 'Надходження', 'Витрата'] as const).map((type, index) => {
                          const getTypeColors = () => {
                            if (selectedType !== type) return 'bg-white text-gray-700 hover:bg-gray-100';
                            switch(type) {
                              case 'Всі': return 'bg-[#8884D8] text-white';
                              case 'Надходження': return 'bg-[#00C49F] text-white';
                              case 'Витрата': return 'bg-[#FF8042] text-white';
                            }
                          };
                          return <button key={type} onClick={() => setSelectedType(type)} className={`flex-1 px-2 py-1.5 text-sm text-center transition-colors duration-150 ease-in-out ${getTypeColors()} ${index > 0 ? 'border-l border-gray-300' : ''}`} > {type} </button>;
                        })}
                      </div>
                   </div>
               </div>
                {/* --- Другий Рядок Фільтрів --- */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 items-start pt-2">
                    {/* Колонка 1: Рахунки */}
                    <div className="flex flex-col">
                       <div
                         className="flex justify-between items-center mb-1 flex-shrink-0 cursor-pointer sm:cursor-default"
                         onClick={() => toggleFilter('accounts')}
                       >
                           <label className="block text-sm font-medium text-gray-700 flex items-center gap-1 cursor-pointer sm:cursor-default">
                             Рахунки
                             <span className="sm:hidden text-gray-400 text-xs">{expandedFilters.accounts ? '▲' : '▼'}</span>
                           </label>
                           <button onClick={(e) => { e.stopPropagation(); handleSelectAllAccounts(); }} className="text-xs text-[#8884D8] hover:text-[#6c63b8] hover:underline">
                               {accounts.length > 0 && selectedAccounts.length === accounts.length ? 'Зняти всі' : 'Вибрати всі'}
                           </button>
                       </div>
                       <div className={`border rounded p-2 bg-white space-y-1 shadow-sm overflow-y-auto lg:max-h-[200px] lg:h-[200px] ${expandedFilters.accounts ? 'block' : 'hidden'} sm:block`}>
                           {isLoading ? <p className="text-xs text-gray-400 p-1">Завантаження...</p> : Array.isArray(accounts) && accounts.length > 0 ? accounts.map(acc => ( <div key={acc} className="flex items-center"> <input type="checkbox" id={`trans-acc-${acc}`} checked={selectedAccounts.includes(acc)} onChange={() => handleAccountChange(acc)} className="h-3.5 w-3.5 text-blue-600 border-gray-300 rounded mr-1.5 focus:ring-blue-500 focus:ring-offset-0"/> <label htmlFor={`trans-acc-${acc}`} className={`text-xs select-none cursor-pointer ${selectedAccounts.includes(acc) ? 'text-gray-900 font-medium' : 'text-gray-500'}`}>{acc}</label> </div> )) : <p className="text-xs text-gray-400 p-1">Немає рахунків</p>}
                       </div>
                   </div>
                   {/* Колонка 2: Категорії Надходжень */}
                   <div className="flex flex-col">
                        <div
                          className='flex justify-between items-center mb-1 flex-shrink-0 cursor-pointer sm:cursor-default'
                          onClick={() => toggleFilter('income')}
                        >
                            <label className="block text-sm font-medium text-gray-700 flex items-center gap-1 cursor-pointer sm:cursor-default">
                              Надходження
                              <span className="sm:hidden text-gray-400 text-xs">{expandedFilters.income ? '▲' : '▼'}</span>
                            </label>
                             <button onClick={(e) => { e.stopPropagation(); handleSelectAllIncomeCategories(); }} className="text-xs text-[#8884D8] hover:text-[#6c63b8] hover:underline">
                               {incomeCategories.length > 0 && incomeCategories.every(ic => selectedCategories.includes(ic)) ? 'Зняти всі' : 'Вибрати всі'}
                             </button>
                        </div>
                        <div className={`border rounded p-2 bg-white space-y-1 shadow-sm overflow-y-auto lg:max-h-[200px] lg:h-[200px] ${expandedFilters.income ? 'block' : 'hidden'} sm:block`}>
                           {isLoading ? <p className="text-xs text-gray-400 p-1">Завантаження...</p> : Array.isArray(categories) && incomeCategories.length > 0 ? incomeCategories.map(catName => ( <div key={`inc-${catName}`} className="flex items-center"> <input type="checkbox" id={`trans-cat-inc-${catName}`} checked={selectedCategories.includes(catName)} onChange={() => handleCategoryChange(catName)} className="h-3.5 w-3.5 text-blue-600 border-gray-300 rounded mr-1.5 focus:ring-blue-500 focus:ring-offset-0"/> <label htmlFor={`trans-cat-inc-${catName}`} className={`text-xs select-none cursor-pointer ${selectedCategories.includes(catName) ? 'text-gray-900 font-medium' : 'text-gray-500'}`}>{catName}</label> </div> )) : <p className="text-xs text-gray-400 p-1">Немає категорій надходжень</p>}
                        </div>
                   </div>
                   {/* Колонка 3: Категорії Витрат */}
                   <div className="flex flex-col">
                        <div
                          className='flex justify-between items-center mb-1 flex-shrink-0 cursor-pointer sm:cursor-default'
                          onClick={() => toggleFilter('expense')}
                        >
                            <label className="block text-sm font-medium text-gray-700 flex items-center gap-1 cursor-pointer sm:cursor-default">
                              Витрати
                              <span className="sm:hidden text-gray-400 text-xs">{expandedFilters.expense ? '▲' : '▼'}</span>
                            </label>
                             <button onClick={(e) => { e.stopPropagation(); handleSelectAllExpenseCategories(); }} className="text-xs text-[#8884D8] hover:text-[#6c63b8] hover:underline">
                               {expenseCategories.length > 0 && expenseCategories.every(ec => selectedCategories.includes(ec)) ? 'Зняти всі' : 'Вибрати всі'}
                             </button>
                        </div>
                        <div className={`border rounded p-2 bg-white space-y-1 shadow-sm overflow-y-auto lg:max-h-[200px] lg:h-[200px] ${expandedFilters.expense ? 'block' : 'hidden'} sm:block`}>
                           {isLoading ? <p className="text-xs text-gray-400 p-1">Завантаження...</p> : Array.isArray(categories) && expenseCategories.length > 0 ? expenseCategories.map(catName => ( <div key={`exp-${catName}`} className="flex items-center"> <input type="checkbox" id={`trans-cat-exp-${catName}`} checked={selectedCategories.includes(catName)} onChange={() => handleCategoryChange(catName)} className="h-3.5 w-3.5 text-blue-600 border-gray-300 rounded mr-1.5 focus:ring-blue-500 focus:ring-offset-0"/> <label htmlFor={`trans-cat-exp-${catName}`} className={`text-xs select-none cursor-pointer ${selectedCategories.includes(catName) ? 'text-gray-900 font-medium' : 'text-gray-500'}`}>{catName}</label> </div> )) : <p className="text-xs text-gray-400 p-1">Немає категорій витрат</p>}
                        </div>
                   </div>
                   {/* Колонка 4: Контрагенти */}
                   <div className="flex flex-col">
                        <div
                          className='flex justify-between items-center mb-1 flex-shrink-0 cursor-pointer sm:cursor-default'
                          onClick={() => toggleFilter('counterparties')}
                        >
                            <label className="block text-sm font-medium text-gray-700 flex items-center gap-1 cursor-pointer sm:cursor-default">
                              Контрагенти
                              <span className="sm:hidden text-gray-400 text-xs">{expandedFilters.counterparties ? '▲' : '▼'}</span>
                            </label>
                             <button onClick={(e) => { e.stopPropagation(); handleSelectAllCounterparties(); }} className="text-xs text-[#8884D8] hover:text-[#6c63b8] hover:underline">
                               {counterparties.length > 0 && selectedCounterparties.length === counterparties.length ? 'Зняти всі' : 'Вибрати всі'}
                             </button>
                        </div>
                        <div className={`border rounded p-2 bg-white space-y-1 shadow-sm overflow-y-auto lg:max-h-[200px] lg:h-[200px] ${expandedFilters.counterparties ? 'block' : 'hidden'} sm:block`}>
                           {isLoading ? <p className="text-xs text-gray-400 p-1">Завантаження...</p> : Array.isArray(counterparties) && counterparties.length > 0 ? counterparties.map(cpName => ( <div key={`cp-${cpName}`} className="flex items-center"> <input type="checkbox" id={`trans-cp-${cpName}`} checked={selectedCounterparties.includes(cpName)} onChange={() => handleCounterpartyChange(cpName)} className="h-3.5 w-3.5 text-blue-600 border-gray-300 rounded mr-1.5 focus:ring-blue-500 focus:ring-offset-0"/> <label htmlFor={`trans-cp-${cpName}`} className={`text-xs select-none cursor-pointer ${selectedCounterparties.includes(cpName) ? 'text-gray-900 font-medium' : 'text-gray-500'}`}>{cpName}</label> </div> )) : <p className="text-xs text-gray-400 p-1">Немає контрагентів</p>}
                        </div>
                   </div>
                   {/* Колонка 5: Проекти */}
                   <div className="flex flex-col">
                        <div
                          className='flex justify-between items-center mb-1 flex-shrink-0 cursor-pointer sm:cursor-default'
                          onClick={() => toggleFilter('projects')}
                        >
                            <label className="block text-sm font-medium text-gray-700 flex items-center gap-1 cursor-pointer sm:cursor-default">
                              Проекти
                              <span className="sm:hidden text-gray-400 text-xs">{expandedFilters.projects ? '▲' : '▼'}</span>
                            </label>
                             <button onClick={(e) => { e.stopPropagation(); handleSelectAllProjects(); }} className="text-xs text-[#8884D8] hover:text-[#6c63b8] hover:underline">
                               {projects.length > 0 && selectedProjects.length === projects.length ? 'Зняти всі' : 'Вибрати всі'}
                             </button>
                        </div>
                        <div className={`border rounded p-2 bg-white space-y-1 shadow-sm overflow-y-auto lg:max-h-[200px] lg:h-[200px] ${expandedFilters.projects ? 'block' : 'hidden'} sm:block`}>
                           {isLoading ? <p className="text-xs text-gray-400 p-1">Завантаження...</p> : Array.isArray(projects) && projects.length > 0 ? projects.map(projName => ( <div key={`proj-${projName}`} className="flex items-center"> <input type="checkbox" id={`trans-proj-${projName}`} checked={selectedProjects.includes(projName)} onChange={() => handleProjectChange(projName)} className="h-3.5 w-3.5 text-blue-600 border-gray-300 rounded mr-1.5 focus:ring-blue-500 focus:ring-offset-0"/> <label htmlFor={`trans-proj-${projName}`} className={`text-xs select-none cursor-pointer ${selectedProjects.includes(projName) ? 'text-gray-900 font-medium' : 'text-gray-500'}`}>{projName}</label> </div> )) : <p className="text-xs text-gray-400 p-1">Немає проектів</p>}
                        </div>
                   </div>
                </div>
          </div>
          {/* --- Кінець ФІЛЬТРІВ --- */}


          {/* --- Графік --- */}
          {/* Повний JSX Графіка */}
          {isLoading && <p className="mt-6 text-center">Завантаження звіту...</p>}
          {error && <p className="mt-6 text-red-600 text-center">Помилка завантаження звіту: {error}</p>}
          {!isLoading && !error && (
               <div className="p-4 border rounded shadow bg-white mb-6">
                   <h2
                       className="text-lg font-semibold mb-4 text-center cursor-pointer hover:text-[#8884D8] transition-colors duration-200 select-none flex items-center justify-center gap-2"
                       onClick={() => setIsChartDynamicsOpen(!isChartDynamicsOpen)}
                   >
                       <span>Динаміка за Період</span>
                       <span className="text-gray-400 text-sm">{isChartDynamicsOpen ? '▲' : '▼'}</span>
                   </h2>
                   {isChartDynamicsOpen && processedData.barChartData.length > 0 ? (
                      <ResponsiveContainer width="100%" height={350}>
                         <BarChart data={processedData.barChartData} margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
                           <CartesianGrid strokeDasharray="3 3" />
                           <XAxis dataKey="name" fontSize={12} />
                           <YAxis tickFormatter={(value) => formatNumber(value)} fontSize={12} width={70}/>
                           {/* **ПОВЕРНУЛИ КАСТОМНИЙ TOOLTIP** */}
                           <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(206, 212, 218, 0.3)' }} wrapperStyle={{ zIndex: 50 }} />
                           <Legend wrapperStyle={{fontSize: "12px"}}/>
                           <Bar dataKey="income" fill="#00C49F" name="Надходження" radius={[4, 4, 0, 0]} />
                           <Bar dataKey="expense" fill="#FF8042" name="Витрати" radius={[4, 4, 0, 0]} />
                           {processedData.shouldShowBalance && <Bar dataKey="balance" fill="#8884D8" name="Баланс (кінець міс.)" radius={[4, 4, 0, 0]} />}
                         </BarChart>
                      </ResponsiveContainer>
                   ) : isChartDynamicsOpen ? ( <p className="text-center text-gray-500 pt-10">Немає даних для відображення звіту за обраними фільтрами.</p> ) : null}

                   {/* --- Блок із загальними сумами --- */}
                   {isChartDynamicsOpen && processedData.barChartData.length > 0 && (
                       <div className="mt-6 flex justify-center gap-8 flex-wrap">
                           <div className="text-center">
                               <p className="text-sm text-gray-600 mb-1">Надходження</p>
                               <p className="text-2xl font-bold" style={{ color: '#00C49F' }}>
                                   {formatNumber(totalSums.income)} ₴
                               </p>
                           </div>
                           <div className="text-center">
                               <p className="text-sm text-gray-600 mb-1">Витрати</p>
                               <p className="text-2xl font-bold" style={{ color: '#FF8042' }}>
                                   {formatNumber(totalSums.expense)} ₴
                               </p>
                           </div>
                           <div className="text-center">
                               <p className="text-sm text-gray-600 mb-1">Баланс</p>
                               <p className="text-2xl font-bold" style={{ color: '#8884D8' }}>
                                   {formatNumber(totalSums.balance)} ₴
                               </p>
                           </div>
                       </div>
                   )}
              </div>
          )}
          {/* --- Кінець Графіка --- */}

          {/* --- Графіки розподілу по категоріям --- */}
          {!isLoading && !error && (
              <div className="p-4 border rounded shadow bg-white mb-6">
                  <h2
                      className="text-lg font-semibold mb-4 text-center cursor-pointer hover:text-[#8884D8] transition-colors duration-200 select-none flex items-center justify-center gap-2"
                      onClick={() => setIsChartDistributionOpen(!isChartDistributionOpen)}
                  >
                      <span>Розподіл по категоріям</span>
                      <span className="text-gray-400 text-sm">{isChartDistributionOpen ? '▲' : '▼'}</span>
                  </h2>
                  {isChartDistributionOpen && (categoryDistribution.incomeData.length > 0 || categoryDistribution.expenseData.length > 0) ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Pie Chart для надходжень */}
                      <div className="flex flex-col items-center">
                          <h3 className="text-md font-medium mb-2" style={{ color: '#00C49F' }}>Надходження</h3>
                          {categoryDistribution.incomeData.length > 0 ? (
                              <>
                                  <ResponsiveContainer width="100%" height={280}>
                                      <PieChart>
                                          <Pie
                                              data={categoryDistribution.incomeData}
                                              cx="50%"
                                              cy="50%"
                                              outerRadius={80}
                                              fill="#00C49F"
                                              dataKey="value"
                                              label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                                              labelLine={true}
                                          >
                                              {categoryDistribution.incomeData.map((entry, index) => (
                                                  <Cell key={`cell-income-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                                              ))}
                                          </Pie>
                                          <Tooltip
                                              formatter={(value: number) => [`${formatNumber(value)} ₴`, 'Сума']}
                                          />
                                      </PieChart>
                                  </ResponsiveContainer>
                                  <div className="mt-2 text-xs text-gray-600 max-h-[120px] overflow-y-auto w-full">
                                      {categoryDistribution.incomeData.map((item, index) => (
                                          <div key={`legend-income-${index}`} className="flex items-center gap-2 mb-1">
                                              <div
                                                  className="w-3 h-3 rounded-sm flex-shrink-0"
                                                  style={{ backgroundColor: PIE_COLORS[index % PIE_COLORS.length] }}
                                              />
                                              <span className="truncate">{item.name}</span>
                                              <span className="ml-auto font-medium">{formatNumber(item.value)} ₴</span>
                                          </div>
                                      ))}
                                  </div>
                              </>
                          ) : (
                              <p className="text-gray-500 text-sm py-10">Немає надходжень за обраний період</p>
                          )}
                      </div>

                      {/* Pie Chart для витрат */}
                      <div className="flex flex-col items-center">
                          <h3 className="text-md font-medium mb-2" style={{ color: '#FF8042' }}>Витрати</h3>
                          {categoryDistribution.expenseData.length > 0 ? (
                              <>
                                  <ResponsiveContainer width="100%" height={280}>
                                      <PieChart>
                                          <Pie
                                              data={categoryDistribution.expenseData}
                                              cx="50%"
                                              cy="50%"
                                              outerRadius={80}
                                              fill="#FF8042"
                                              dataKey="value"
                                              label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                                              labelLine={true}
                                          >
                                              {categoryDistribution.expenseData.map((entry, index) => (
                                                  <Cell key={`cell-expense-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                                              ))}
                                          </Pie>
                                          <Tooltip
                                              formatter={(value: number) => [`${formatNumber(value)} ₴`, 'Сума']}
                                          />
                                      </PieChart>
                                  </ResponsiveContainer>
                                  <div className="mt-2 text-xs text-gray-600 max-h-[120px] overflow-y-auto w-full">
                                      {categoryDistribution.expenseData.map((item, index) => (
                                          <div key={`legend-expense-${index}`} className="flex items-center gap-2 mb-1">
                                              <div
                                                  className="w-3 h-3 rounded-sm flex-shrink-0"
                                                  style={{ backgroundColor: PIE_COLORS[index % PIE_COLORS.length] }}
                                              />
                                              <span className="truncate">{item.name}</span>
                                              <span className="ml-auto font-medium">{formatNumber(item.value)} ₴</span>
                                          </div>
                                      ))}
                                  </div>
                              </>
                          ) : (
                              <p className="text-gray-500 text-sm py-10">Немає витрат за обраний період</p>
                          )}
                      </div>
                  </div>
                  ) : isChartDistributionOpen ? (
                      <p className="text-center text-gray-500 py-6">Немає даних для відображення розподілу за обраними фільтрами.</p>
                  ) : null}
              </div>
          )}
          {/* --- Кінець графіків розподілу --- */}


          {/* --- Таблиця транзакцій --- */}
          {/* Повний JSX Таблиці */}
          {isLoading && <p className="mt-4 text-center">Завантаження транзакцій...</p>}
          {!isLoading && !error && (
              <div className="overflow-x-auto mt-4">
                 {/* Додано text-center */}
                 <h2 className="text-lg font-semibold mb-2 text-center">Детальні Транзакції за Період</h2>
                 <table className="min-w-full divide-y divide-gray-200">
                   <thead className="bg-gray-50">
                     <tr>
                       <th
                         scope="col"
                         className={`px-4 py-2 text-left text-xs uppercase tracking-wider cursor-pointer hover:bg-gray-100 select-none ${sortColumn === 'date' ? 'font-bold text-gray-900' : 'font-medium text-gray-500'}`}
                         onClick={() => handleSort('date')}
                       >
                         Дата {sortColumn === 'date' && (sortDirection === 'asc' ? '↑' : '↓')}
                       </th>
                       <th
                         scope="col"
                         className={`px-4 py-2 text-right text-xs uppercase tracking-wider cursor-pointer hover:bg-gray-100 select-none ${sortColumn === 'amount' ? 'font-bold text-gray-900' : 'font-medium text-gray-500'}`}
                         onClick={() => handleSort('amount')}
                       >
                         Сума {sortColumn === 'amount' && (sortDirection === 'asc' ? '↑' : '↓')}
                       </th>
                       <th
                         scope="col"
                         className={`px-4 py-2 text-left text-xs uppercase tracking-wider cursor-pointer hover:bg-gray-100 select-none ${sortColumn === 'description' ? 'font-bold text-gray-900' : 'font-medium text-gray-500'}`}
                         onClick={() => handleSort('description')}
                       >
                         Опис {sortColumn === 'description' && (sortDirection === 'asc' ? '↑' : '↓')}
                       </th>
                       <th
                         scope="col"
                         className={`px-4 py-2 text-left text-xs uppercase tracking-wider cursor-pointer hover:bg-gray-100 select-none ${sortColumn === 'category' ? 'font-bold text-gray-900' : 'font-medium text-gray-500'}`}
                         onClick={() => handleSort('category')}
                       >
                         Категорія {sortColumn === 'category' && (sortDirection === 'asc' ? '↑' : '↓')}
                       </th>
                       <th
                         scope="col"
                         className={`px-4 py-2 text-left text-xs uppercase tracking-wider cursor-pointer hover:bg-gray-100 select-none ${sortColumn === 'account' ? 'font-bold text-gray-900' : 'font-medium text-gray-500'}`}
                         onClick={() => handleSort('account')}
                       >
                         Рахунок {sortColumn === 'account' && (sortDirection === 'asc' ? '↑' : '↓')}
                       </th>
                       <th
                         scope="col"
                         className={`px-4 py-2 text-left text-xs uppercase tracking-wider cursor-pointer hover:bg-gray-100 select-none ${sortColumn === 'counterparty' ? 'font-bold text-gray-900' : 'font-medium text-gray-500'}`}
                         onClick={() => handleSort('counterparty')}
                       >
                         Контрагент {sortColumn === 'counterparty' && (sortDirection === 'asc' ? '↑' : '↓')}
                       </th>
                       <th
                         scope="col"
                         className={`px-4 py-2 text-left text-xs uppercase tracking-wider cursor-pointer hover:bg-gray-100 select-none ${sortColumn === 'project' ? 'font-bold text-gray-900' : 'font-medium text-gray-500'}`}
                         onClick={() => handleSort('project')}
                       >
                         Проект {sortColumn === 'project' && (sortDirection === 'asc' ? '↑' : '↓')}
                       </th>
                     </tr>
                   </thead>
                   <tbody className="bg-white divide-y divide-gray-200">
                     {/* Сортування */}
                     {processedData.filteredTransactions.length === 0 ? (
                       <tr> <td colSpan={7} className="px-4 py-4 text-center text-gray-500">Транзакцій за обраними фільтрами не знайдено</td> </tr>
                     ) : (
                       [...processedData.filteredTransactions]
                         .sort((a, b) => {
                           let comparison = 0;
                           switch (sortColumn) {
                             case 'date':
                               const dateA = parseDate(a.date);
                               const dateB = parseDate(b.date);
                               if (!dateA && !dateB) comparison = 0;
                               else if (!dateA) comparison = 1;
                               else if (!dateB) comparison = -1;
                               else comparison = dateA.getTime() - dateB.getTime();
                               break;
                             case 'amount':
                               const amountA = a.type === 'Витрата' ? -a.amount : a.amount;
                               const amountB = b.type === 'Витрата' ? -b.amount : b.amount;
                               comparison = amountA - amountB;
                               break;
                             case 'description':
                               comparison = (a.description || '').localeCompare(b.description || '', 'uk');
                               break;
                             case 'category':
                               comparison = (a.category || '').localeCompare(b.category || '', 'uk');
                               break;
                             case 'account':
                               comparison = (a.account || '').localeCompare(b.account || '', 'uk');
                               break;
                             case 'counterparty':
                               comparison = (a.counterparty || '').localeCompare(b.counterparty || '', 'uk');
                               break;
                             case 'project':
                               comparison = (a.project || '').localeCompare(b.project || '', 'uk');
                               break;
                             default:
                               comparison = 0;
                           }
                           return sortDirection === 'asc' ? comparison : -comparison;
                         })
                         .map((tx, index) => (
                           <tr key={`${tx.date}-${index}-${tx.amount}`} className={`${tx.type === 'Витрата' ? 'bg-red-50 hover:bg-red-100' : 'bg-green-50 hover:bg-green-100'} transition-colors duration-150 ease-in-out`}>
                             <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-900">{tx.date}</td>
                             <td className={`px-4 py-2 whitespace-nowrap text-sm text-right font-medium ${tx.type === 'Витрата' ? 'text-[#FF8042]' : 'text-[#00C49F]'}`}> {tx.type === 'Витрата' ? '-' : '+'} {formatNumber(tx.amount)} ₴ </td>
                             <td className="px-4 py-2 text-sm text-gray-500 max-w-[200px] truncate">{tx.description}</td>
                             <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-500">{tx.category}</td>
                             <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-500">{tx.account}</td>
                             <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-500">{tx.counterparty || '-'}</td>
                             <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-500">{tx.project || '-'}</td>
                           </tr>
                         ))
                     )}
                     {/* Підсумкові рядки */}
                     {processedData.filteredTransactions.length > 0 && (
                         <>
                             {/* Сума надходжень */}
                             <tr className="bg-green-100 border-t-2 border-green-300">
                                 <td className="px-4 py-2 whitespace-nowrap text-sm font-medium text-green-800">
                                     Разом
                                 </td>
                                 <td className="px-4 py-2 whitespace-nowrap text-sm text-right font-medium text-green-800">
                                     + {formatNumber(totalSums.income)} ₴
                                 </td>
                                 <td colSpan={5} className="px-4 py-2 text-sm text-green-800">
                                     <TooltipWithCalculation calculation={summaryCalculations.income}>
                                         <span>Сума надходжень</span>
                                     </TooltipWithCalculation>
                                 </td>
                             </tr>
                             {/* Сума видатків */}
                             <tr className="bg-red-100">
                                 <td className="px-4 py-2 whitespace-nowrap text-sm font-medium text-red-800">
                                     Разом
                                 </td>
                                 <td className="px-4 py-2 whitespace-nowrap text-sm text-right font-medium text-red-800">
                                     - {formatNumber(totalSums.expense)} ₴
                                 </td>
                                 <td colSpan={5} className="px-4 py-2 text-sm text-red-800">
                                     <TooltipWithCalculation calculation={summaryCalculations.expense}>
                                         <span>Сума видатків</span>
                                     </TooltipWithCalculation>
                                 </td>
                             </tr>
                         </>
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
