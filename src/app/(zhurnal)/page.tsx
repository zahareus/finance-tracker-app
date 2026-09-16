'use client';

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
    ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
    PieChart, Pie, Cell
} from 'recharts';
import { usePersistedFilters, usePersistedState } from '@/hooks/usePersistedState';
import { useSheetData } from '@/hooks/useSheetData';
import { VALID_TYPES, isOutgoing, isIncoming, isTransfer, signedAmount, pairStatus, parseDate } from '@/lib/tx';
import { T, CHART_SERIES, chartTooltipStyle } from '@/lib/theme';
import { copyRowsToClipboard, useCopyToast } from '@/lib/copyRows';
import { Checkbox, TooltipWithCalculation } from '@/components/ui';

// --- Типи даних ---
interface Transaction {
  row?: number; // Номер рядка в Google Sheets
  id?: string | null; // Стабільний ID з колонки I (T0001…)
  link?: string | null; // Колонка J — ID вихідного переказу (на вхідному)
  noTax?: boolean; // Колонка K — «Без 11%»
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

// Інтерфейс для збережених фільтрів
interface PersistedFilters {
    startDate: string;
    endDate: string;
    selectedAccounts: string[];
    selectedCategories: string[];
    selectedCounterparties: string[];
    selectedProjects: string[];
    selectedType: string;
    isChartDynamicsOpen: boolean;
    sortColumn: string;
    sortDirection: 'asc' | 'desc';
}
// --- Кінець типів ---

// --- Хелпери ---
const formatNumber = (num: number): string => {
    if (typeof num !== 'number' || isNaN(num)) { return '0,00'; }
    return num.toLocaleString('uk-UA', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
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

const formatDateShort = (dateString: string | null | undefined, withYear = true): string => {
    const dt = parseDate(dateString);
    if (!dt) return '—';
    const day = String(dt.getUTCDate()).padStart(2, '0');
    const month = String(dt.getUTCMonth() + 1).padStart(2, '0');
    return withYear ? `${day}.${month}.${dt.getUTCFullYear()}` : `${day}.${month}`;
};

const formatMoney = (value: number, showPlus = true): string => {
    const sign = value < 0 ? '− ' : showPlus ? '+ ' : '';
    return `${sign}${formatNumber(Math.abs(value))}`;
};

const ChevronDown = ({ className = '' }: { className?: string }) => (
    <svg className={className} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M6 9l6 6 6-6" />
    </svg>
);

const SortArrow = ({ direction }: { direction: 'asc' | 'desc' }) => (
    <svg className={`inline ml-1 ${direction === 'asc' ? 'rotate-180' : ''}`} width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
        <path d="M12 5v14M6 13l6 6 6-6" />
    </svg>
);
// --- Кінець хелперів ---

// Функція для отримання початкових дат (за межами компонента для стабільності)
const getDefaultDates = () => {
    const today = new Date();
    const startOfYear = new Date(Date.UTC(today.getFullYear(), 0, 1));
    return { start: formatDateForInput(startOfYear), end: formatDateForInput(today) };
};

const TransactionsPage: React.FC = () => {
    // --- Стан даних (не зберігається) ---
    const [allTransactions, setAllTransactions] = useState<Transaction[]>([]);
    const [accounts, setAccounts] = useState<string[]>([]);
    const [categories, setCategories] = useState<CategoryInfo[]>([]);
    const [counterparties, setCounterparties] = useState<string[]>([]);
    const [projects, setProjects] = useState<string[]>([]);
    const { data, isLoading, error } = useSheetData();
    const [skippedRows, setSkippedRows] = useState<string[]>([]);

    // Початкові дати
    const defaultDates = useMemo(() => getDefaultDates(), []);

    // --- Збережені фільтри (зберігаються в localStorage) ---
    const [filters, updateFilters] = usePersistedFilters<PersistedFilters>(
        'finance-tracker-main-filters-v2',
        {
            startDate: defaultDates.start,
            endDate: defaultDates.end,
            selectedAccounts: [],
            selectedCategories: [],
            selectedCounterparties: [],
            selectedProjects: [],
            selectedType: 'Всі',
            isChartDynamicsOpen: true,
            sortColumn: 'date',
            sortDirection: 'desc',
        }
    );
    const [isFiltersPanelOpen, setIsFiltersPanelOpen] = usePersistedState('finance-tracker-filters-open-v2', false);
    const [isChartDistributionOpen, setIsChartDistributionOpen] = usePersistedState('finance-tracker-pies-open-v2', false);

    // Деструктуруємо фільтри для зручності
    const {
        startDate, endDate, selectedAccounts, selectedCategories,
        selectedCounterparties, selectedProjects, selectedType,
        isChartDynamicsOpen,
        sortColumn, sortDirection
    } = filters;

    // Функції-сеттери для фільтрів
    const setStartDate = useCallback((value: string) => updateFilters({ startDate: value }), [updateFilters]);
    const setEndDate = useCallback((value: string) => updateFilters({ endDate: value }), [updateFilters]);
    const setSelectedAccounts = useCallback((value: string[] | ((prev: string[]) => string[])) => {
        if (typeof value === 'function') {
            updateFilters(prev => ({ selectedAccounts: value(prev.selectedAccounts) }));
        } else {
            updateFilters({ selectedAccounts: value });
        }
    }, [updateFilters]);
    const setSelectedCategories = useCallback((value: string[] | ((prev: string[]) => string[])) => {
        if (typeof value === 'function') {
            updateFilters(prev => ({ selectedCategories: value(prev.selectedCategories) }));
        } else {
            updateFilters({ selectedCategories: value });
        }
    }, [updateFilters]);
    const setSelectedCounterparties = useCallback((value: string[] | ((prev: string[]) => string[])) => {
        if (typeof value === 'function') {
            updateFilters(prev => ({ selectedCounterparties: value(prev.selectedCounterparties) }));
        } else {
            updateFilters({ selectedCounterparties: value });
        }
    }, [updateFilters]);
    const setSelectedProjects = useCallback((value: string[] | ((prev: string[]) => string[])) => {
        if (typeof value === 'function') {
            updateFilters(prev => ({ selectedProjects: value(prev.selectedProjects) }));
        } else {
            updateFilters({ selectedProjects: value });
        }
    }, [updateFilters]);
    const setSelectedType = useCallback((value: string) => updateFilters({ selectedType: value }), [updateFilters]);
    const setIsChartDynamicsOpen = useCallback((value: boolean) => updateFilters({ isChartDynamicsOpen: value }), [updateFilters]);
    const setSortColumn = useCallback((value: string) => updateFilters({ sortColumn: value }), [updateFilters]);
    const setSortDirection = useCallback((value: 'asc' | 'desc') => updateFilters({ sortDirection: value }), [updateFilters]);

    // Скидання лише вибірок (рахунки/категорії/контрагенти/проєкти/тип); дати й стан панелей не чіпаємо
    const hasActiveFilters = selectedAccounts.length > 0 || selectedCategories.length > 0 || selectedCounterparties.length > 0 || selectedProjects.length > 0 || selectedType !== 'Всі';
    const resetSelectionFilters = useCallback(() => updateFilters({ selectedAccounts: [], selectedCategories: [], selectedCounterparties: [], selectedProjects: [], selectedType: 'Всі' }), [updateFilters]);

    // Стан для згортання фільтрів на мобільній версії (не зберігається)
    const [expandedFilters, setExpandedFilters] = useState<{[key: string]: boolean}>({
        accounts: false,
        income: false,
        expense: false,
        counterparties: false,
        projects: false,
    });

    // Стан для вибору місяців на таймлайні (не зберігається)
    const [selectedMonthRange, setSelectedMonthRange] = useState<{start: string | null, end: string | null}>({start: null, end: null});

    // --- Завантаження даних ---
    // Повний useEffect
    useEffect(() => {
        if (!data) return;
        try {
             const skipped: string[] = [];
             const cleanedTransactions = data.transactions.map((tx: any) => ({ row: typeof tx.row === 'number' ? tx.row : undefined, id: tx.id ? String(tx.id).trim() : null, link: tx.link ? String(tx.link).trim() : null, noTax: !!tx.noTax, date: typeof tx.date === 'string' ? tx.date.trim() : null, amount: typeof tx.amount === 'number' && !isNaN(tx.amount) ? tx.amount : parseFloat(String(tx.amount || '0').replace(/,/g, '.').replace(/\s/g, '')) || 0, type: String(tx?.type || '').trim(), account: String(tx?.account || '').trim(), category: String(tx?.category || '').trim(), description: String(tx?.description || '').trim(), counterparty: tx?.counterparty ? String(tx.counterparty).trim() : '', project: tx?.project ? String(tx.project).trim() : '', })).filter((tx: Transaction, index: number) => { const isValid = tx.date && VALID_TYPES.includes(tx.type) && tx.account && tx.category && typeof tx.amount === 'number' && !isNaN(tx.amount); if (!isValid) { skipped.push(tx.id || ('№' + (tx.row ?? index + 2))); console.warn(`Workspace_DATA: Invalid transaction structure at raw index ${index}:`, data.transactions[index], 'Resulted in:', tx); } return isValid; });
             setSkippedRows(skipped);
             const cleanedAccounts = data.accounts.flat().map((acc: any) => String(acc || '').trim()).filter(Boolean);
             const cleanedCategories = data.categories.map((cat: any) => ({ name: String(cat?.name || '').trim(), type: String(cat?.type || '').trim() })).filter((cat: CategoryInfo) => cat.name && (cat.type === 'Надходження' || cat.type === 'Витрата'));
             const cleanedCounterparties = data.counterparties.flat().map((cp: any) => String(cp || '').trim()).filter(Boolean);
             const cleanedProjects = data.projects.flat().map((proj: any) => String(proj || '').trim()).filter(Boolean);
             setAllTransactions(cleanedTransactions); setAccounts(cleanedAccounts); setCategories(cleanedCategories); setCounterparties(cleanedCounterparties); setProjects(cleanedProjects);
        } catch (err) { console.error("Failed to process sheet data:", err); }
     }, [data]);

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
            setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
        } else {
            setSortColumn(column);
            setSortDirection(column === 'date' ? 'desc' : 'asc');
        }
    }, [sortColumn, sortDirection, setSortColumn, setSortDirection]);

    // Скорочені назви місяців українською
    const MONTH_NAMES_SHORT = ['СІЧ', 'ЛЮТ', 'БЕР', 'КВІ', 'ТРА', 'ЧЕР', 'ЛИП', 'СЕР', 'ВЕР', 'ЖОВ', 'ЛИС', 'ГРУ'];

    // Генерація доступних років та місяців на основі поточної дати
    const availableYearsAndMonths = useMemo(() => {
        const today = new Date();
        const currentYear = today.getFullYear();
        const currentMonth = today.getMonth(); // 0-11

        // Починаємо з 2025 року (перші транзакції в системі)
        const startYear = 2025;
        const years: {year: number, months: number[]}[] = [];

        for (let year = startYear; year <= currentYear; year++) {
            const months: number[] = [];
            const maxMonth = year === currentYear ? currentMonth : 11;

            for (let month = 0; month <= maxMonth; month++) {
                months.push(month);
            }

            if (months.length > 0) {
                years.push({ year, months });
            }
        }

        return years;
    }, []);

    // Перевірка чи місяць активний (входить в поточний інтервал дат)
    const isMonthActive = useCallback((year: number, month: number) => {
        const monthStart = new Date(Date.UTC(year, month, 1));
        const monthEnd = new Date(Date.UTC(year, month + 1, 0)); // Останній день місяця

        const start = parseDate(startDate);
        const end = parseDate(endDate);

        if (!start || !end) return false;

        // Місяць активний якщо він перетинається з обраним інтервалом
        return monthStart <= end && monthEnd >= start;
    }, [startDate, endDate]);

    // Перевірка чи весь рік активний
    const isYearFullyActive = useCallback((year: number) => {
        const yearData = availableYearsAndMonths.find(y => y.year === year);
        if (!yearData) return false;

        return yearData.months.every(month => isMonthActive(year, month));
    }, [availableYearsAndMonths, isMonthActive]);

    // Обробник кліку на рік - вибирає весь рік
    const handleYearClick = useCallback((year: number) => {
        const yearData = availableYearsAndMonths.find(y => y.year === year);
        if (!yearData) return;

        const today = new Date();
        const isCurrentYear = year === today.getFullYear();

        const yearStart = new Date(Date.UTC(year, 0, 1));
        const yearEnd = isCurrentYear
            ? new Date(Date.UTC(year, today.getMonth() + 1, 0)) // Кінець поточного місяця
            : new Date(Date.UTC(year, 11, 31));

        setStartDate(formatDateForInput(yearStart));
        setEndDate(formatDateForInput(yearEnd));
        setSelectedMonthRange({ start: null, end: null });
    }, [availableYearsAndMonths]);

    // Обробник кліку на місяць
    const handleMonthClick = useCallback((year: number, month: number) => {
        const monthKey = `${year}-${month}`;

        // Якщо немає вибраного початку - вибираємо цей місяць як початок і кінець
        if (!selectedMonthRange.start) {
            const monthStart = new Date(Date.UTC(year, month, 1));
            const monthEnd = new Date(Date.UTC(year, month + 1, 0));

            setStartDate(formatDateForInput(monthStart));
            setEndDate(formatDateForInput(monthEnd));
            setSelectedMonthRange({ start: monthKey, end: monthKey });
        } else {
            // Якщо є вибраний початок - визначаємо діапазон
            const [startYear, startMonth] = selectedMonthRange.start.split('-').map(Number);
            const clickedDate = new Date(Date.UTC(year, month, 1));
            const startDate = new Date(Date.UTC(startYear, startMonth, 1));

            let rangeStart: Date, rangeEnd: Date;

            if (clickedDate < startDate) {
                // Клікнутий місяць раніше за початок - він стає новим початком
                rangeStart = clickedDate;
                rangeEnd = new Date(Date.UTC(startYear, startMonth + 1, 0));
            } else {
                // Клікнутий місяць пізніше - він стає кінцем
                rangeStart = startDate;
                rangeEnd = new Date(Date.UTC(year, month + 1, 0));
            }

            setStartDate(formatDateForInput(rangeStart));
            setEndDate(formatDateForInput(rangeEnd));
            setSelectedMonthRange({ start: null, end: null }); // Скидаємо для наступного вибору
        }
    }, [selectedMonthRange]);


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
                 balanceDetailsAtStart[tx.account] = (balanceDetailsAtStart[tx.account] || 0) + signedAmount({ ...tx, amount });
            }
        });

        // 2. Фільтруємо транзакції
        const filteredTransactionsForPeriod = allTransactions.filter(tx => {
            if (typeof tx.amount !== 'number' || isNaN(tx.amount)) return false;
            const typeMatch = selectedType === 'Всі' || (selectedType === 'Перекази' ? isTransfer(tx) : tx.type === selectedType);
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
                    const category = tx.category; const account = tx.account; const amount = tx.amount; const amountChange = signedAmount(tx);
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
            expense: expenseCalc,
            balance: `Баланс = Надходження - Видатки\n= ${formatNumber(totalSums.income)} - ${formatNumber(totalSums.expense)}\n= ${formatNumber(totalSums.balance)} ₴`
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

    // Транзакції у поточному порядку сортування — рендер таблиці і експорт беруть один список
    const sortedTransactions = useMemo(() => {
        return [...processedData.filteredTransactions].sort((a, b) => {
            let comparison = 0;
            switch (sortColumn) {
                case 'id': comparison = (a.id || '').localeCompare(b.id || '', 'uk'); break;
                case 'date': {
                    const dateA = parseDate(a.date);
                    const dateB = parseDate(b.date);
                    if (!dateA && !dateB) comparison = 0;
                    else if (!dateA) comparison = 1;
                    else if (!dateB) comparison = -1;
                    else comparison = dateA.getTime() - dateB.getTime();
                    break;
                }
                case 'amount': {
                    const amountA = signedAmount(a);
                    const amountB = signedAmount(b);
                    comparison = amountA - amountB;
                    break;
                }
                case 'type': comparison = (a.type || '').localeCompare(b.type || '', 'uk'); break;
                case 'description': comparison = (a.description || '').localeCompare(b.description || '', 'uk'); break;
                case 'category': comparison = (a.category || '').localeCompare(b.category || '', 'uk'); break;
                case 'account': comparison = (a.account || '').localeCompare(b.account || '', 'uk'); break;
                case 'counterparty': comparison = (a.counterparty || '').localeCompare(b.counterparty || '', 'uk'); break;
                case 'project': comparison = (a.project || '').localeCompare(b.project || '', 'uk'); break;
                default: comparison = 0;
            }
            return sortDirection === 'asc' ? comparison : -comparison;
        });
    }, [processedData.filteredTransactions, sortColumn, sortDirection]);

    // Пари переказів по всій таблиці: вихідний → привʼязані вхідні (за колонкою J)
    const pairs = useMemo(() => {
        const byId = new Map<string, Transaction>();
        const dupIds = new Set<string>();
        allTransactions.forEach(tx => { if (!tx.id) return; if (byId.has(tx.id)) dupIds.add(tx.id); byId.set(tx.id, tx); });
        const incomingByOut = new Map<string, Transaction[]>();
        const broken: string[] = Array.from(dupIds).map(id => `${id} (дубль ID)`);
        const noId = allTransactions.filter(tx => isOutgoing(tx) && !tx.id).length;
        allTransactions.forEach(tx => {
            if (!tx.link) return;
            const target = byId.get(tx.link);
            // Ціль звʼязку мусить бути вихідним переказом без власного звʼязку — це відсікає цикли, ланцюжки і самопосилання
            if (!target || dupIds.has(tx.link) || !isOutgoing(target) || target.link || !isIncoming(tx)) { broken.push(tx.id || '?'); return; }
            incomingByOut.set(tx.link, (incomingByOut.get(tx.link) || []).concat(tx));
        });
        const unpaired = allTransactions.filter(tx => isOutgoing(tx) && tx.id && !incomingByOut.has(tx.id)).map(tx => tx.id as string);
        return { incomingByOut, broken, unpaired, noId };
    }, [allTransactions]);

    // Виділення рядків і копіювання в буфер — текстом, як у таблиці (TSV), щоб вставлялось у Sheets/Excel/месенджер
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const { toast: copiedToast, showToast, showError } = useCopyToast();
    const rowKey = (tx: Transaction) => `${tx.row ?? ''}:${tx.id || ''}:${tx.date}:${tx.amount}`;
    const toggleSelected = useCallback((key: string) => setSelectedIds(prev => { const next = new Set(prev); if (next.has(key)) next.delete(key); else next.add(key); return next; }), []);
    const allVisibleSelected = sortedTransactions.length > 0 && sortedTransactions.every(tx => selectedIds.has(rowKey(tx)));
    const toggleAllVisible = useCallback(() => setSelectedIds(prev => { if (sortedTransactions.every(tx => prev.has(rowKey(tx)))) return new Set(); return new Set(sortedTransactions.map(rowKey)); }), [sortedTransactions]);
    const handleCopy = useCallback(async () => {
        const rows = sortedTransactions.filter(tx => selectedIds.has(rowKey(tx)));
        if (!rows.length) return;
        const header = ['ID', 'Дата', 'Сума', 'Тип', 'Рахунок', 'Категорія', 'Опис', 'Контрагент', 'Проект', 'Звʼязок', 'Без 11%'];
        const tsvRows = rows.map(tx => [tx.id || '', tx.date || '', tx.amount, tx.type, tx.account, tx.category, tx.description, tx.counterparty || '', tx.project || '', tx.link || '', tx.noTax ? 'TRUE' : '']);
        const { ok } = await copyRowsToClipboard(header, tsvRows);
        if (ok) showToast(rows.length); else showError();
    }, [sortedTransactions, selectedIds, showToast, showError]);

    // Справжній xlsx: OnlyOffice/Numbers відкривають HTML-таблицю з excel-mime як документ, не як таблицю
    const handleExportXls = useCallback(async () => {
        const writeXlsxFile = (await import('write-excel-file/browser')).default;
        const header = (value: string) => ({ value, fontWeight: 'bold' as const });
        // Дзеркало таблиці: ті самі колонки, сума додатна, напрямок — у типі
        const columns = [
            { header: header('ID'), width: 8, cell: (tx: Transaction) => ({ type: String, value: tx.id || '' }) },
            { header: header('Дата'), width: 12, cell: (tx: Transaction) => { const dt = parseDate(tx.date); return dt ? { type: Date, format: 'dd.mm.yyyy', value: dt } : { type: String, value: tx.date || '' }; } },
            { header: header('Сума'), width: 12, cell: (tx: Transaction) => ({ type: Number, format: '#,##0.00', value: tx.amount }) },
            { header: header('Тип'), width: 16, cell: (tx: Transaction) => ({ type: String, value: tx.type || '' }) },
            { header: header('Рахунок'), width: 12, cell: (tx: Transaction) => ({ type: String, value: tx.account || '' }) },
            { header: header('Категорія'), width: 24, cell: (tx: Transaction) => ({ type: String, value: tx.category || '' }) },
            { header: header('Опис'), width: 40, cell: (tx: Transaction) => ({ type: String, value: tx.description || '' }) },
            { header: header('Контрагент'), width: 18, cell: (tx: Transaction) => ({ type: String, value: tx.counterparty || '' }) },
            { header: header('Проект'), width: 18, cell: (tx: Transaction) => ({ type: String, value: tx.project || '' }) },
            { header: header('Звʼязок'), width: 9, cell: (tx: Transaction) => ({ type: String, value: tx.link || '' }) },
            { header: header('Без 11%'), width: 8, cell: (tx: Transaction) => ({ type: String, value: tx.noTax ? 'TRUE' : '' }) },
        ];
        await writeXlsxFile(sortedTransactions, { columns, stickyRowsCount: 1 })
            .toFile(`transactions-${new Date().toISOString().slice(0, 10)}.xlsx`);
    }, [sortedTransactions]);

    // --- Компонент для Кастомної Підказки (Tooltip) ---
    // Повний CustomTooltip
    const CustomTooltip = ({ active, payload, label }: any) => {
        if (active && payload && payload.length && processedData && Array.isArray(processedData.barChartData)) {
            const currentMonthData = processedData.barChartData.find(d => d.name === label);
            if (!currentMonthData) return null;
            const renderDetails = (details: { [key: string]: number }, type: 'income' | 'expense' | 'balance') => {
                 const colorClass = type === 'income' ? 'text-income' : type === 'expense' ? 'text-expense' : 'text-ink';
                 const accountsToConsider = selectedAccounts.length > 0 ? selectedAccounts : accounts;
                 let detailsToShow: [string, number][];
                 if (type === 'balance') { const fullBalanceDetails: BalanceDetails = {}; accountsToConsider.forEach(acc => { fullBalanceDetails[acc] = details[acc] || 0; }); detailsToShow = Object.entries(fullBalanceDetails).filter(([, amount]) => Math.abs(amount) > 0.001).sort(([,a],[,b]) => b - a); if (detailsToShow.length === 0) { if (accountsToConsider.length > 0) return <p key={accountsToConsider[0]} className={`text-xs ${colorClass}`}> - {accountsToConsider[0]}: {formatNumber(0)} ₴</p>; else return <p className="text-xs text-ink-3 italic">- немає рахунків -</p>; } }
                 else { detailsToShow = Object.entries(details).filter(([, amount]) => Math.abs(amount) > 0.001).sort(([, a], [, b]) => b - a); if(detailsToShow.length === 0) return <p className="text-xs text-ink-3 italic">- немає деталей -</p>; }
                 return detailsToShow.map(([key, amount]) => ( <p key={key} className={`text-xs ${colorClass}`}> - {key}: {formatNumber(amount)} ₴</p> ));
            };
            const incomePayload = payload.find((p: any) => p.dataKey === 'income');
            const expensePayload = payload.find((p: any) => p.dataKey === 'expense');
            const balancePayload = payload.find((p: any) => p.dataKey === 'balance');
            return ( <div className="bg-panel p-3 border border-line rounded-field text-sm max-w-xs z-50 relative"> <p className="font-semibold mb-2 text-center">{label}</p> {processedData.shouldShowBalance && balancePayload && currentMonthData.balanceDetails && ( <> <p className="text-ink font-semibold">Баланс (кінець міс.): {formatNumber(currentMonthData.balance)} ₴</p> <div className="pl-2 my-1">{renderDetails(currentMonthData.balanceDetails, 'balance')}</div> </> )} {incomePayload && currentMonthData.income !== 0 && currentMonthData.incomeDetails && ( <> <p className="text-income font-semibold mt-1">Надходження: {formatNumber(currentMonthData.income)} ₴</p> <div className="pl-2 my-1">{renderDetails(currentMonthData.incomeDetails, 'income')}</div> </> )} {expensePayload && currentMonthData.expense !== 0 && currentMonthData.expenseDetails && ( <> <p className="text-expense font-semibold mt-1">Витрати: {formatNumber(currentMonthData.expense)} ₴</p> <div className="pl-2 my-1">{renderDetails(currentMonthData.expenseDetails, 'expense')}</div> </> )} </div> );
        }
        return null;
    };

    const activeFilterCount = [selectedAccounts.length, selectedCategories.length, selectedCounterparties.length, selectedProjects.length].filter(n => n > 0).length + (selectedType !== 'Всі' ? 1 : 0);
    const periodLabel = `${formatDateShort(startDate, false)} – ${formatDateShort(endDate)}`;
    const resetLabel = [selectedType !== 'Всі' ? selectedType : null, selectedAccounts.length ? `рахунки ${selectedAccounts.length}` : null, selectedCategories.length ? `категорії ${selectedCategories.length}` : null, selectedCounterparties.length ? `контрагенти ${selectedCounterparties.length}` : null, selectedProjects.length ? `проєкти ${selectedProjects.length}` : null].filter(Boolean).join(', ') || 'немає';
    const showPairRows = selectedType === 'Всі' || selectedType === 'Перекази';
    const transferWarningText = showPairRows && pairs.unpaired.length > 0 ? `Непарних переказів: ${pairs.unpaired.length}` : '';
    const skippedLabel = `${skippedRows.length} ${skippedRows.length === 1 ? 'рядок' : skippedRows.length < 5 ? 'рядки' : 'рядків'}`;
    const typeOptions = ['Всі', 'Надходження', 'Витрата', 'Перекази'];
    const columns = [
        { key: 'id', label: 'ID', align: 'text-left' },
        { key: 'date', label: 'Дата', align: 'text-left' },
        { key: 'account', label: 'Рахунок', align: 'text-left' },
        { key: 'type', label: 'Тип', align: 'text-left' },
        { key: 'amount', label: 'Сума', align: 'text-right' },
        { key: 'description', label: 'Опис', align: 'text-left' },
        { key: 'category', label: 'Категорія', align: 'text-left' },
        { key: 'counterparty', label: 'Контрагент', align: 'text-left' },
        { key: 'project', label: 'Проєкт', align: 'text-left' },
    ];
    const typeClasses = (tx: Transaction) => isOutgoing(tx) ? 'bg-tout-soft text-tout' : isIncoming(tx) ? 'bg-tin-soft text-tin' : tx.type === 'Витрата' ? 'bg-expense-soft text-expense' : 'bg-income-soft text-income';
    const amountClass = (tx: Transaction) => isOutgoing(tx) ? 'text-tout' : isIncoming(tx) ? 'text-tin' : tx.type === 'Витрата' ? 'text-expense' : 'text-income';
    const displayType = (tx: Transaction) => isOutgoing(tx) ? 'Переказ вихідний' : isIncoming(tx) ? 'Переказ вхідний' : tx.type;
    // Рядок під вихідним переказом: кожен привʼязаний вхідний + різниця, або «ще не повернувся»
    const pairRowContent = (tx: Transaction, linked: Transaction[], inSum: number, status: string | null) => linked.length === 0
        ? <span className="text-expense">↳ вхідного зі звʼязком на {tx.id} нема — ще не повернувся</span>
        : <span className="text-ink-2">
            {linked.map(i => <span key={i.id || i.date || ''} className="mr-3">↳ {i.id} · {formatDateShort(i.date)} · {i.account} · +{formatNumber(i.amount)} ₴</span>)}
            <span className={status === 'ok' ? 'text-income' : 'text-expense font-medium'}>різниця {formatNumber(tx.amount - inSum)} ₴ {status === 'ok' ? '✓' : '⚠ не 0 і не 11%'}</span>
          </span>;
    const renderCheckbox = (checked: boolean, onChange: () => void, label: string) => <Checkbox checked={checked} onChange={onChange} label={label} />;
    const filterList = (key: string, title: string, items: string[], selected: string[], onToggle: (item: string) => void, onToggleAll: () => void, empty: string) => {
        const allSelected = items.length > 0 && items.every(item => selected.includes(item));
        return (
            <div className="flex-1 min-w-0">
                <div className="flex justify-between items-center mb-1.5 cursor-pointer sm:cursor-default" onClick={() => toggleFilter(key)}>
                    <span className="text-xs font-semibold flex items-center gap-1">{title}<ChevronDown className={`sm:hidden ${expandedFilters[key] ? 'rotate-180' : ''}`} /></span>
                    <button type="button" onClick={(e) => { e.stopPropagation(); onToggleAll(); }} className="text-xs text-ink-2 underline underline-offset-[3px] hover:text-ink">
                        {allSelected ? 'Зняти всі' : 'Вибрати всі'}
                    </button>
                </div>
                <div className={`rounded-[12px] border border-line bg-panel p-2 px-3 h-[168px] overflow-y-auto ${expandedFilters[key] ? 'block' : 'hidden'} sm:block`}>
                    {isLoading ? <p className="text-xs text-ink-3 p-1">Завантаження...</p> : items.length > 0 ? items.map(item => (
                        <label key={`${key}-${item}`} className={`flex items-center gap-2 py-1 text-[13px] hover:bg-mute -mx-1 px-1 rounded-field ${selected.includes(item) ? 'text-ink' : 'text-ink-2'}`}>
                            <input type="checkbox" checked={selected.includes(item)} onChange={() => onToggle(item)} className="h-4 w-4 rounded-[5px] border-[1.5px] border-line bg-panel accent-ink" />
                            <span className="truncate">{item}</span>
                        </label>
                    )) : <p className="text-xs text-ink-3 p-1">{empty}</p>}
                </div>
            </div>
        );
    };

    // --- РЕНДЕР КОМПОНЕНТА ---
    return (
        <div className="flex flex-col gap-4">
          {/* design-md: fintracker Журнал v1 */}
          {isLoading && !data && <p className="text-sm text-ink-2 text-center py-10">Завантаження...</p>}
          {error && !data && <p className="text-danger text-sm text-center py-10">Помилка завантаження звіту: {error}</p>}
          {data && (
          <>
          <div className="flex gap-2.5 items-center flex-wrap">
              <button type="button" onClick={() => setIsFiltersPanelOpen(open => !open)} className="inline-flex items-center gap-2 px-3.5 py-2 rounded-full border border-line bg-panel text-[13px] hover:border-ink-3">
                  <span className="text-ink-2">Період</span><span className="font-medium tabular-nums">{periodLabel}</span><ChevronDown />
              </button>
              <div className="inline-flex p-[3px] rounded-full border border-line bg-panel">
                  {typeOptions.map(type => (
                      <button key={type} type="button" onClick={() => setSelectedType(type)} className={`px-4 py-[7px] rounded-full text-[13px] font-medium ${selectedType === type ? 'bg-ink text-white' : 'text-ink-2 hover:text-ink'}`}>
                          {type === 'Витрата' ? 'Витрати' : type}
                      </button>
                  ))}
              </div>
              <button type="button" onClick={() => setIsFiltersPanelOpen(open => !open)} className="inline-flex items-center gap-2 px-3.5 py-2 rounded-full border border-line bg-panel text-[13px] hover:border-ink-3" title="Фільтри збережені в цьому браузері — інша людина бачить інші цифри">
                  <span className="text-ink-2">Фільтри</span><span className="font-medium">активних: {activeFilterCount}</span><ChevronDown />
              </button>
              <span className="flex-1" />
              {hasActiveFilters && <button type="button" onClick={resetSelectionFilters} title="Прибрати всі обрані рахунки, категорії, контрагентів, проєкти й тип" className="text-[13px] text-ink-2 underline underline-offset-[3px] hover:text-ink">Скинути</button>}
          </div>

          {isFiltersPanelOpen && (
              <div className="bg-panel border border-line rounded-card px-5 py-[18px] flex flex-col gap-4">
                  <div className="flex justify-between items-center">
                      <span className="font-display text-[14px] font-semibold">Період і фільтри</span>
                      <span className="text-xs text-ink-2">Збережено в цьому браузері</span>
                  </div>
                  <div className="flex flex-col sm:flex-row gap-3">
                      <div className="sm:flex-[0_0_200px]">
                          <label htmlFor="trans-startDate" className="block text-xs text-ink-2 mb-1">Початок</label>
                          <input id="trans-startDate" type="date" value={startDate} onChange={(e) => { setStartDate(e.target.value); setSelectedMonthRange({ start: null, end: null }); }} className="w-full px-3 py-2 rounded-field border border-line bg-panel text-[13px] tabular-nums focus:border-ink focus:outline-none" />
                      </div>
                      <div className="sm:flex-[0_0_200px]">
                          <label htmlFor="trans-endDate" className="block text-xs text-ink-2 mb-1">Кінець</label>
                          <input id="trans-endDate" type="date" value={endDate} onChange={(e) => { setEndDate(e.target.value); setSelectedMonthRange({ start: null, end: null }); }} className="w-full px-3 py-2 rounded-field border border-line bg-panel text-[13px] tabular-nums focus:border-ink focus:outline-none" />
                      </div>
                  </div>
                  <div className="flex flex-col gap-2">
                      {availableYearsAndMonths.map(({ year, months }) => (
                          <div key={year} className="flex gap-1.5 items-center flex-wrap">
                              <button type="button" onClick={() => handleYearClick(year)} className={`h-[30px] px-3 rounded-full text-xs font-semibold border ${isYearFullyActive(year) ? 'bg-ink text-white border-ink' : 'bg-mute text-ink border-line hover:border-ink-3'}`}>
                                  {year}
                              </button>
                              {months.map(month => {
                                  const isActive = isMonthActive(year, month);
                                  const isSelecting = selectedMonthRange.start === `${year}-${month}`;
                                  return (
                                      <button key={`${year}-${month}`} type="button" title={`${MONTH_NAMES_SHORT[month]} ${year}`} onClick={() => handleMonthClick(year, month)} className={`h-[30px] px-3 rounded-full text-xs font-medium border ${isActive ? 'bg-ink text-white border-ink' : 'bg-transparent text-ink-2 border-line hover:border-ink-3'} ${isSelecting ? 'ring-2 ring-ink ring-offset-1' : ''}`}>
                                          {MONTH_NAMES_SHORT[month]}
                                      </button>
                                  );
                              })}
                          </div>
                      ))}
                  </div>
                  <div className="flex flex-col sm:flex-row gap-3.5">
                      {filterList('accounts', 'Рахунки', accounts, selectedAccounts, handleAccountChange, handleSelectAllAccounts, 'Немає рахунків')}
                      {filterList('income', 'Надходження', incomeCategories, selectedCategories, handleCategoryChange, handleSelectAllIncomeCategories, 'Немає категорій надходжень')}
                      {filterList('expense', 'Витрати', expenseCategories, selectedCategories, handleCategoryChange, handleSelectAllExpenseCategories, 'Немає категорій витрат')}
                      {filterList('counterparties', 'Контрагенти', counterparties, selectedCounterparties, handleCounterpartyChange, handleSelectAllCounterparties, 'Немає контрагентів')}
                      {filterList('projects', 'Проєкти', projects, selectedProjects, handleProjectChange, handleSelectAllProjects, 'Немає проєктів')}
                  </div>
              </div>
          )}

          <div className="flex flex-col divide-y divide-line rounded-card bg-panel border border-line px-3.5 sm:px-0 sm:grid sm:grid-cols-3 sm:gap-3 sm:divide-y-0 sm:bg-transparent sm:border-0">
              <div className="flex justify-between items-baseline py-2 sm:block sm:rounded-card sm:px-[18px] sm:py-3.5 sm:bg-income-soft">
                  <div className="text-xs text-ink-2">Надходження</div>
                  <div className="text-base sm:text-[22px] font-semibold tabular-nums text-income"><TooltipWithCalculation calculation={summaryCalculations.income}><span>+ {formatNumber(totalSums.income)}</span></TooltipWithCalculation></div>
              </div>
              <div className="flex justify-between items-baseline py-2 sm:block sm:rounded-card sm:px-[18px] sm:py-3.5 sm:bg-expense-soft">
                  <div className="text-xs text-ink-2">Витрати</div>
                  <div className="text-base sm:text-[22px] font-semibold tabular-nums text-expense"><TooltipWithCalculation calculation={summaryCalculations.expense}><span>− {formatNumber(totalSums.expense)}</span></TooltipWithCalculation></div>
              </div>
              <div className="flex justify-between items-baseline py-2 sm:block sm:rounded-card sm:px-[18px] sm:py-3.5 sm:bg-panel sm:border sm:border-line">
                  <div className="text-xs text-ink-2">Різниця за період</div>
                  <div className={`text-base sm:text-[22px] font-semibold tabular-nums ${totalSums.balance < 0 ? 'text-tout' : 'text-ink'}`}><TooltipWithCalculation calculation={summaryCalculations.balance}><span>{formatMoney(totalSums.balance)}</span></TooltipWithCalculation></div>
              </div>
          </div>

          <div className="bg-panel border border-line rounded-card px-5 py-[18px]">
              <button type="button" className="w-full flex justify-between items-center mb-2.5" onClick={() => setIsChartDynamicsOpen(!isChartDynamicsOpen)}>
                  <span className="font-display text-sm sm:text-[15px] font-semibold">Динаміка за період</span>
                  {!isChartDynamicsOpen && <span className="inline-flex items-center gap-1 text-[13px] text-ink-2">згорнуто <ChevronDown /></span>}
              </button>
              {isChartDynamicsOpen && processedData.barChartData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={260}>
                      <BarChart data={processedData.barChartData} margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke={T.line} />
                          <XAxis dataKey="name" tick={{ fill: T.ink2, fontSize: 11 }} />
                          <YAxis tickFormatter={(value) => Math.round(value).toLocaleString('uk-UA')} tick={{ fill: T.ink2, fontSize: 11 }} width={62} />
                          <Tooltip content={<CustomTooltip />} contentStyle={chartTooltipStyle} wrapperStyle={{ zIndex: 50 }} />
                          <Legend wrapperStyle={{ fontSize: 12, color: T.ink2 }} iconType="circle" />
                          <Bar dataKey="income" fill={T.income} name="Надходження" radius={[2, 2, 0, 0]} />
                          <Bar dataKey="expense" fill={T.expense} name="Витрати" radius={[2, 2, 0, 0]} />
                          {processedData.shouldShowBalance && <Bar dataKey="balance" fill={T.ink3} name="Баланс (кінець міс.)" radius={[2, 2, 0, 0]} />}
                      </BarChart>
                  </ResponsiveContainer>
              ) : isChartDynamicsOpen ? <p className="text-center text-ink-2 py-10">Немає даних для відображення звіту за обраними фільтрами.</p> : null}
          </div>

          <div className="bg-panel border border-line rounded-card px-5 py-[18px]">
              <button type="button" className="w-full flex justify-between items-center" onClick={() => setIsChartDistributionOpen(open => !open)}>
                  <span className="font-display text-sm sm:text-[15px] font-semibold">Розподіл за категоріями</span>
                  {!isChartDistributionOpen && <span className="inline-flex items-center gap-1 text-[13px] text-ink-2">згорнуто <ChevronDown /></span>}
              </button>
              {isChartDistributionOpen && (categoryDistribution.incomeData.length > 0 || categoryDistribution.expenseData.length > 0) ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4">
                      {[
                          { title: 'Надходження', data: categoryDistribution.incomeData, color: 'text-income', empty: 'Немає надходжень за обраний період' },
                          { title: 'Витрати', data: categoryDistribution.expenseData, color: 'text-expense', empty: 'Немає витрат за обраний період' },
                      ].map(group => (
                          <div key={group.title}>
                              <h3 className={`font-display text-[13px] font-semibold mb-2 ${group.color}`}>{group.title}</h3>
                              {group.data.length > 0 ? (
                                  <>
                                      <ResponsiveContainer width="100%" height={220}>
                                          <PieChart>
                                              <Pie data={group.data} cx="50%" cy="50%" outerRadius={80} dataKey="value" label={false} labelLine={false}>
                                                  {group.data.map((entry, index) => <Cell key={`${group.title}-${entry.name}`} fill={CHART_SERIES[index % CHART_SERIES.length]} />)}
                                              </Pie>
                                              <Tooltip formatter={(value: number) => [`${formatNumber(value)} ₴`, 'Сума']} contentStyle={chartTooltipStyle} />
                                          </PieChart>
                                      </ResponsiveContainer>
                                      <div className="mt-2 text-xs text-ink-2 max-h-[120px] overflow-y-auto">
                                          {group.data.map((item, index) => (
                                              <div key={`${group.title}-legend-${item.name}`} className="flex items-center gap-2 mb-1">
                                                  <span className="w-3 h-3 rounded-[3px] flex-shrink-0" style={{ backgroundColor: CHART_SERIES[index % CHART_SERIES.length] }} />
                                                  <span className="truncate">{item.name}</span>
                                                  <span className="ml-auto font-medium tabular-nums">{formatNumber(item.value)} ₴</span>
                                              </div>
                                          ))}
                                      </div>
                                  </>
                              ) : <p className="text-ink-2 text-sm py-10">{group.empty}</p>}
                          </div>
                      ))}
                  </div>
              ) : isChartDistributionOpen ? <p className="text-center text-ink-2 py-6">Немає даних для відображення розподілу за обраними фільтрами.</p> : null}
          </div>

          <div className="bg-panel border border-line rounded-card px-5 py-[18px]">
              <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2 mb-2.5">
                  <span className="font-display text-sm sm:text-[15px] font-semibold">Транзакції за період</span>
                  <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                      {transferWarningText && <span className="text-xs text-expense" title={pairs.unpaired.join(', ')}>⚠ {transferWarningText}</span>}
                      {pairs.broken.length > 0 && <span className="text-xs text-danger" title={pairs.broken.join(', ')}>Битих звʼязків: {pairs.broken.length} — посилання на неіснуючий або не вихідний ID ({pairs.broken.slice(0, 8).join(', ')}{pairs.broken.length > 8 ? '…' : ''})</span>}
                      {pairs.noId > 0 && <span className="text-xs text-danger" title="Рядок без ID — запусти fillMissingIds у скрипті">без ID: {pairs.noId}</span>}
                      <button type="button" onClick={handleCopy} disabled={selectedIds.size === 0} className="inline-flex items-center px-3.5 py-[7px] rounded-full bg-ink text-white text-[13px] font-medium hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed" title="Скопіювати виділені рядки текстом, як у таблиці">Скопіювати ({selectedIds.size})</button>
                      {copiedToast && <span className="text-income text-sm">{copiedToast}</span>}
                      <button type="button" onClick={handleExportXls} disabled={sortedTransactions.length === 0} className="inline-flex items-center px-3.5 py-[7px] rounded-full border border-ink text-ink bg-panel text-[13px] font-medium hover:bg-mute disabled:opacity-40 disabled:cursor-not-allowed" title="Завантажити транзакції звіту у XLSX">XLSX</button>
                  </div>
              </div>
              {skippedRows.length > 0 && (
                  <p className="text-xs text-expense mb-2.5" title="Рядок без дати, рахунку, категорії або з типом не «Надходження»/«Витрата» у звіт не потрапляє">Пропущено {skippedLabel} таблиці з неповними даними: {skippedRows.slice(0, 20).join(', ')}{skippedRows.length > 20 ? '…' : ''}</p>
              )}

              <div className="sm:hidden">
                  {sortedTransactions.length === 0 ? (
                      <div className="py-4 text-center text-ink-2">За обраними фільтрами нічого немає. Активні: {resetLabel} {hasActiveFilters && <button type="button" onClick={resetSelectionFilters} className="ml-2 text-[13px] text-ink-2 underline underline-offset-[3px] hover:text-ink">Скинути</button>}</div>
                  ) : sortedTransactions.map(tx => {
                      const key = rowKey(tx);
                      const linked = tx.id && isOutgoing(tx) ? (pairs.incomingByOut.get(tx.id) || []) : [];
                      const inSum = linked.reduce((sum, i) => sum + i.amount, 0);
                      const status = linked.length ? pairStatus(tx.amount, inSum) : null;
                      return (
                          <React.Fragment key={`mobile-${key}`}>
                              <div className={`flex gap-2.5 py-2.5 border-b border-line ${selectedIds.has(key) ? 'bg-mute -mx-4 px-4' : ''}`}>
                                  <div className="pt-0.5">{renderCheckbox(selectedIds.has(key), () => toggleSelected(key), `Виділити ${tx.id || ''}`)}</div>
                                  <div className="flex-1 min-w-0 flex flex-col gap-1">
                                      <div className="flex justify-between items-baseline gap-2">
                                          <span className="text-xs text-ink-2 tabular-nums truncate">{formatDateShort(tx.date, false)} · {tx.account} · {tx.id || 'без ID'}</span>
                                          <span className={`text-[15px] font-semibold tabular-nums whitespace-nowrap ${amountClass(tx)}`}>{formatMoney(signedAmount(tx))}</span>
                                      </div>
                                      <div className="text-sm">{tx.description}</div>
                                      <div className="flex justify-between items-center gap-2">
                                          <span className="text-xs text-ink-2 truncate">{tx.category}</span>
                                          <span className={`inline-block px-[9px] py-[3px] rounded-full text-[11.5px] font-medium ${typeClasses(tx)}`}>{displayType(tx)}</span>
                                      </div>
                                  </div>
                              </div>
                              {showPairRows && isOutgoing(tx) && (
                                  <div className="text-xs border-b border-line pb-2">
                                      {pairRowContent(tx, linked, inSum, status)}
                                  </div>
                              )}
                          </React.Fragment>
                      );
                  })}
              </div>

              <div className="hidden sm:block overflow-x-auto">
                  <table className="w-full border-collapse text-[13.5px]">
                      <thead>
                          <tr>
                              <th className="px-2.5 py-2 text-left border-b border-line w-8">{renderCheckbox(allVisibleSelected, toggleAllVisible, 'Виділити всі')}</th>
                              {columns.map(col => (
                                  <th key={col.key} className={`px-2.5 py-2 border-b border-line text-[11px] uppercase tracking-[.06em] font-medium cursor-pointer select-none whitespace-nowrap ${col.align} ${sortColumn === col.key ? 'text-ink' : 'text-ink-2'}`} onClick={() => handleSort(col.key)}>
                                      {col.label}{sortColumn === col.key && <SortArrow direction={sortDirection} />}
                                  </th>
                              ))}
                          </tr>
                      </thead>
                      <tbody>
                          {sortedTransactions.length === 0 ? (
                              <tr><td colSpan={10} className="py-4 text-center text-ink-2">За обраними фільтрами нічого немає. Активні: {resetLabel} {hasActiveFilters && <button type="button" onClick={resetSelectionFilters} className="ml-2 text-[13px] text-ink-2 underline underline-offset-[3px] hover:text-ink">Скинути</button>}</td></tr>
                          ) : sortedTransactions.map(tx => {
                              const key = rowKey(tx);
                              const linked = tx.id && isOutgoing(tx) ? (pairs.incomingByOut.get(tx.id) || []) : [];
                              const inSum = linked.reduce((sum, i) => sum + i.amount, 0);
                              const status = linked.length ? pairStatus(tx.amount, inSum) : null;
                              return (
                                  <React.Fragment key={key}>
                                      <tr className={selectedIds.has(key) ? 'bg-mute' : ''}>
                                          <td className="px-2.5 py-2.5 border-b border-line align-top">{renderCheckbox(selectedIds.has(key), () => toggleSelected(key), `Виділити ${tx.id || ''}`)}</td>
                                          <td className="px-2.5 py-2.5 border-b border-line align-top text-[11px] text-ink-3 tabular-nums whitespace-nowrap">{tx.id || <span className="text-danger" title="Рядок без ID — запусти fillMissingIds">без ID</span>}{tx.link && <span className="block text-tin" title="Привʼязано до вихідного переказу">↩ {tx.link}</span>}{isIncoming(tx) && !tx.link && <span className="block text-expense" title="Вхідний переказ без звʼязку з вихідним">⚠ без звʼязку</span>}</td>
                                          <td className="px-2.5 py-2.5 border-b border-line align-top tabular-nums whitespace-nowrap">{formatDateShort(tx.date)}</td>
                                          <td className="px-2.5 py-2.5 border-b border-line align-top whitespace-nowrap">{tx.account}</td>
                                          <td className="px-2.5 py-2.5 border-b border-line align-top"><span className={`inline-block px-[9px] py-[3px] rounded-full text-[11.5px] font-medium whitespace-nowrap ${typeClasses(tx)}`}>{displayType(tx)}</span></td>
                                          <td className={`px-2.5 py-2.5 border-b border-line align-top text-right whitespace-nowrap font-semibold tabular-nums ${amountClass(tx)}`}>{formatMoney(signedAmount(tx))} ₴{tx.noTax && <span className="ml-1 text-xs text-ink-3" title="Без 11%">∅</span>}</td>
                                          <td className="px-2.5 py-2.5 border-b border-line align-top min-w-[220px]">{tx.description}</td>
                                          <td className="px-2.5 py-2.5 border-b border-line align-top text-ink-2 whitespace-nowrap">{tx.category}</td>
                                          <td className="px-2.5 py-2.5 border-b border-line align-top text-ink-2 whitespace-nowrap">{tx.counterparty || '—'}</td>
                                          <td className="px-2.5 py-2.5 border-b border-line align-top text-ink-2 whitespace-nowrap">{tx.project || '—'}</td>
                                      </tr>
                                      {showPairRows && isOutgoing(tx) && (
                                          <tr>
                                              <td className="px-2.5 py-0 border-b border-line"></td>
                                              <td colSpan={9} className="px-2.5 pb-2 pt-0 border-b border-line text-xs">
                                                  {pairRowContent(tx, linked, inSum, status)}
                                              </td>
                                          </tr>
                                      )}
                                  </React.Fragment>
                              );
                          })}
                          {sortedTransactions.length > 0 && (
                              <tr className="border-t-[1.5px] border-ink font-semibold">
                                  <td colSpan={5} className="px-2.5 py-3">Разом за період</td>
                                  <td className="px-2.5 py-3 text-right whitespace-nowrap tabular-nums"><span className="text-income">+ {formatNumber(totalSums.income)}</span> <span className="text-expense">− {formatNumber(totalSums.expense)}</span> = {formatNumber(totalSums.balance)}</td>
                                  <td colSpan={4} className="px-2.5 py-3 text-xs text-ink-2 font-normal">{sortedTransactions.length} транзакцій · надходження − витрати, перекази не рахуються</td>
                              </tr>
                          )}
                      </tbody>
                  </table>
              </div>
          </div>
          </>
          )}
        </div>
      );
};

export default TransactionsPage;
