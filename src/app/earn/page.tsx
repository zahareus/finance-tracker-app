'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';
import { parseDate, VALID_TYPES } from '@/lib/tx';
import { usePersistedFilters } from '@/hooks/usePersistedState';
import { useSheetData } from '@/hooks/useSheetData';
import { T, CHART_SERIES, chartTooltipStyle } from '@/lib/theme';
import { Button, Checkbox, ChevronDown, ChipSummary, SectionCard, SortArrow, StatTile, TextAction } from '@/components/ui';
import { copyRowsToClipboard, useCopyToast } from '@/lib/copyRows';

interface Transaction {
  row?: number;
  id?: string | null;
  link?: string | null;
  noTax?: boolean;
  date: string | null;
  amount: number;
  type: string;
  account: string;
  category: string;
  description: string;
  counterparty?: string;
  project?: string;
}

interface CategoryInfo {
  name: string;
  type: string;
}

interface SharedPeriodFilters {
  startDate: string;
  endDate: string;
}

interface EarnViewFilters {
  selectedCategories: string[] | null;
  isDateIntervalOpen: boolean;
  isDynamicsOpen: boolean;
  sortColumn: string;
  sortDirection: 'asc' | 'desc';
}

const EXCLUDED_CATEGORIES = ['Початковий баланс', 'Переказ вхідний'];
const MONTH_NAMES_SHORT = ['СІЧ', 'ЛЮТ', 'БЕР', 'КВІ', 'ТРА', 'ЧЕР', 'ЛИП', 'СЕР', 'ВЕР', 'ЖОВ', 'ЛИС', 'ГРУ'];

const formatNumber = (num: number): string => {
  if (typeof num !== 'number' || isNaN(num)) return '0,00';
  return num.toLocaleString('uk-UA', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

const formatDateForInput = (date: Date): string => {
  if (!(date instanceof Date) || isNaN(date.getTime())) date = new Date();
  const year = date.getUTCFullYear();
  const month = (date.getUTCMonth() + 1).toString().padStart(2, '0');
  const day = date.getUTCDate().toString().padStart(2, '0');
  return `${year}-${month}-${day}`;
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

const getDefaultEarnDates = () => {
  const today = new Date();
  const startOfYear = new Date(Date.UTC(today.getFullYear(), 0, 1));
  return { start: formatDateForInput(startOfYear), end: formatDateForInput(today) };
};

const categoryColor = (category: string, categories: CategoryInfo[]) => {
  const index = Math.max(0, categories.findIndex(c => c.name === category));
  return CHART_SERIES[index % CHART_SERIES.length];
};

const EarnPage: React.FC = () => {
  const [allTransactions, setAllTransactions] = useState<Transaction[]>([]);
  const [categories, setCategories] = useState<CategoryInfo[]>([]);
  const { data, isLoading, error } = useSheetData();
  const defaultDates = useMemo(() => getDefaultEarnDates(), []);

  const [periodFilters, updatePeriodFilters] = usePersistedFilters<SharedPeriodFilters>(
    'finance-tracker-main-filters-v2',
    { startDate: defaultDates.start, endDate: defaultDates.end }
  );
  const [viewFilters, updateViewFilters] = usePersistedFilters<EarnViewFilters>(
    'finance-tracker-earn-filters-v2',
    { selectedCategories: null, isDateIntervalOpen: false, isDynamicsOpen: true, sortColumn: 'date', sortDirection: 'desc' }
  );

  const { startDate, endDate } = periodFilters;
  const { selectedCategories, isDateIntervalOpen, isDynamicsOpen, sortColumn, sortDirection } = viewFilters;

  const setStartDate = useCallback((value: string) => updatePeriodFilters({ startDate: value }), [updatePeriodFilters]);
  const setEndDate = useCallback((value: string) => updatePeriodFilters({ endDate: value }), [updatePeriodFilters]);
  const setSelectedCategories = useCallback((value: string[] | null | ((prev: string[] | null) => string[] | null)) => {
    updateViewFilters(prev => ({ selectedCategories: typeof value === 'function' ? value(prev.selectedCategories) : value }));
  }, [updateViewFilters]);
  const setIsDateIntervalOpen = useCallback((value: boolean) => updateViewFilters({ isDateIntervalOpen: value }), [updateViewFilters]);
  const setIsDynamicsOpen = useCallback((value: boolean) => updateViewFilters({ isDynamicsOpen: value }), [updateViewFilters]);
  const setSortColumn = useCallback((value: string) => updateViewFilters({ sortColumn: value }), [updateViewFilters]);
  const setSortDirection = useCallback((value: 'asc' | 'desc') => updateViewFilters({ sortDirection: value }), [updateViewFilters]);
  const [selectedMonthRange, setSelectedMonthRange] = useState<{start: string | null, end: string | null}>({ start: null, end: null });

  useEffect(() => {
    if (!data) return;
    try {
      const cleanedTransactions = data.transactions.map((tx: any) => ({
        row: typeof tx.row === 'number' ? tx.row : undefined,
        id: tx.id ? String(tx.id).trim() : null,
        link: tx.link ? String(tx.link).trim() : null,
        noTax: !!tx.noTax,
        date: typeof tx.date === 'string' ? tx.date.trim() : null,
        amount: typeof tx.amount === 'number' && !isNaN(tx.amount) ? tx.amount : parseFloat(String(tx.amount || '0').replace(/,/g, '.').replace(/\s/g, '')) || 0,
        type: String(tx?.type || '').trim(),
        account: String(tx?.account || '').trim(),
        category: String(tx?.category || '').trim(),
        description: String(tx?.description || '').trim(),
        counterparty: tx?.counterparty ? String(tx.counterparty).trim() : '',
        project: tx?.project ? String(tx.project).trim() : '',
      })).filter((tx: Transaction) => tx.date && VALID_TYPES.includes(tx.type) && tx.account && tx.category && typeof tx.amount === 'number' && !isNaN(tx.amount));

      setAllTransactions(cleanedTransactions);
      const cleanedCategories = data.categories
        .map((cat: any) => ({ name: String(cat?.name || '').trim(), type: String(cat?.type || '').trim() }))
        .filter((cat: CategoryInfo) => cat.name && cat.type === 'Надходження' && !EXCLUDED_CATEGORIES.includes(cat.name));
      setCategories(cleanedCategories);

      if (cleanedCategories.length > 0) {
        const savedCategories = selectedCategories;
        if (savedCategories === null) {
          setSelectedCategories(cleanedCategories.map((c: CategoryInfo) => c.name));
        } else {
          const validCategories = savedCategories.filter(cat => cleanedCategories.some((c: CategoryInfo) => c.name === cat));
          if (validCategories.length !== savedCategories.length) setSelectedCategories(validCategories);
        }
      }
    } catch (err) {
      console.error('Failed to process sheet data:', err);
    }
  }, [data, selectedCategories, setSelectedCategories]);

  const activeCategories = selectedCategories || [];

  const availableYearsAndMonths = useMemo(() => {
    const today = new Date();
    const currentYear = today.getFullYear();
    const currentMonth = today.getMonth();
    const years: {year: number, months: number[]}[] = [];
    for (let year = 2025; year <= currentYear; year++) {
      const months: number[] = [];
      const maxMonth = year === currentYear ? currentMonth : 11;
      for (let month = 0; month <= maxMonth; month++) months.push(month);
      if (months.length > 0) years.push({ year, months });
    }
    return years;
  }, []);

  const isMonthActive = useCallback((year: number, month: number) => {
    const monthStart = new Date(Date.UTC(year, month, 1));
    const monthEnd = new Date(Date.UTC(year, month + 1, 0));
    const start = parseDate(startDate);
    const end = parseDate(endDate);
    if (!start || !end) return false;
    return monthStart <= end && monthEnd >= start;
  }, [startDate, endDate]);

  const isYearFullyActive = useCallback((year: number) => {
    const yearData = availableYearsAndMonths.find(y => y.year === year);
    if (!yearData) return false;
    return yearData.months.every(month => isMonthActive(year, month));
  }, [availableYearsAndMonths, isMonthActive]);

  const handleYearClick = useCallback((year: number) => {
    const today = new Date();
    const isCurrentYear = year === today.getFullYear();
    const yearStart = new Date(Date.UTC(year, 0, 1));
    const yearEnd = isCurrentYear ? new Date(Date.UTC(year, today.getMonth() + 1, 0)) : new Date(Date.UTC(year, 11, 31));
    setStartDate(formatDateForInput(yearStart));
    setEndDate(formatDateForInput(yearEnd));
    setSelectedMonthRange({ start: null, end: null });
  }, [setStartDate, setEndDate]);

  const handleMonthClick = useCallback((year: number, month: number) => {
    const monthKey = `${year}-${month}`;
    if (!selectedMonthRange.start) {
      const monthStart = new Date(Date.UTC(year, month, 1));
      const monthEnd = new Date(Date.UTC(year, month + 1, 0));
      setStartDate(formatDateForInput(monthStart));
      setEndDate(formatDateForInput(monthEnd));
      setSelectedMonthRange({ start: monthKey, end: monthKey });
    } else {
      const [startYear, startMonth] = selectedMonthRange.start.split('-').map(Number);
      const clickedDate = new Date(Date.UTC(year, month, 1));
      const startDateObj = new Date(Date.UTC(startYear, startMonth, 1));
      const rangeStart = clickedDate < startDateObj ? clickedDate : startDateObj;
      const rangeEnd = clickedDate < startDateObj ? new Date(Date.UTC(startYear, startMonth + 1, 0)) : new Date(Date.UTC(year, month + 1, 0));
      setStartDate(formatDateForInput(rangeStart));
      setEndDate(formatDateForInput(rangeEnd));
      setSelectedMonthRange({ start: null, end: null });
    }
  }, [selectedMonthRange, setStartDate, setEndDate]);

  const handleCategoryToggle = useCallback((categoryName: string) => {
    setSelectedCategories(prev => {
      const current = prev || [];
      return current.includes(categoryName) ? current.filter(c => c !== categoryName) : [...current, categoryName];
    });
  }, [setSelectedCategories]);

  const handleSelectAllCategories = useCallback(() => setSelectedCategories(categories.map(c => c.name)), [categories, setSelectedCategories]);
  const handleClearCategories = useCallback(() => setSelectedCategories([]), [setSelectedCategories]);

  const handleSort = useCallback((column: string) => {
    if (sortColumn === column) setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    else {
      setSortColumn(column);
      setSortDirection(column === 'date' ? 'desc' : 'asc');
    }
  }, [sortColumn, sortDirection, setSortColumn, setSortDirection]);

  const processedData = useMemo(() => {
    const startFilterDate = startDate ? parseDate(startDate) : null;
    const endFilterDate = endDate ? parseDate(endDate) : null;
    if (startFilterDate) startFilterDate.setUTCHours(0, 0, 0, 0);
    if (endFilterDate) endFilterDate.setUTCHours(23, 59, 59, 999);

    const filteredTransactions = allTransactions.filter(tx => {
      if (tx.type !== 'Надходження') return false;
      if (EXCLUDED_CATEGORIES.includes(tx.category)) return false;
      if (!activeCategories.includes(tx.category)) return false;
      const txDate = parseDate(tx.date);
      if (!txDate) return false;
      if (startFilterDate && txDate < startFilterDate) return false;
      if (endFilterDate && txDate > endFilterDate) return false;
      return true;
    });

    const allMonthsInRange: { key: string; name: string }[] = [];
    if (startFilterDate && endFilterDate && startFilterDate <= endFilterDate) {
      let currentMonth = new Date(Date.UTC(startFilterDate.getUTCFullYear(), startFilterDate.getUTCMonth(), 1));
      while (currentMonth <= endFilterDate) {
        const monthYearKey = `${currentMonth.getUTCFullYear()}-${(currentMonth.getUTCMonth() + 1).toString().padStart(2, '0')}`;
        const monthName = currentMonth.toLocaleString('uk-UA', { month: 'short', year: 'numeric', timeZone: 'UTC' });
        allMonthsInRange.push({ key: monthYearKey, name: monthName });
        currentMonth = currentMonth.getUTCMonth() === 11 ? new Date(Date.UTC(currentMonth.getUTCFullYear() + 1, 0, 1)) : new Date(Date.UTC(currentMonth.getUTCFullYear(), currentMonth.getUTCMonth() + 1, 1));
      }
    }

    const monthlyData: { [monthKey: string]: { [category: string]: number } } = {};
    allMonthsInRange.forEach(({ key }) => {
      monthlyData[key] = {};
      activeCategories.forEach(cat => { monthlyData[key][cat] = 0; });
    });

    filteredTransactions.forEach(tx => {
      const txDate = parseDate(tx.date);
      if (!txDate) return;
      const monthYear = `${txDate.getUTCFullYear()}-${(txDate.getUTCMonth() + 1).toString().padStart(2, '0')}`;
      if (monthlyData[monthYear] && activeCategories.includes(tx.category)) monthlyData[monthYear][tx.category] = (monthlyData[monthYear][tx.category] || 0) + tx.amount;
    });

    const chartData = allMonthsInRange.map(({ key, name }) => {
      const dataPoint: { name: string; [key: string]: string | number } = { name };
      activeCategories.forEach(cat => { dataPoint[cat] = monthlyData[key][cat] || 0; });
      return dataPoint;
    });

    const totalIncome = filteredTransactions.reduce((sum, tx) => sum + tx.amount, 0);
    return { filteredTransactions, chartData, totalIncome };
  }, [allTransactions, startDate, endDate, activeCategories]);

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
        case 'amount': comparison = a.amount - b.amount; break;
        case 'description': comparison = (a.description || '').localeCompare(b.description || '', 'uk'); break;
        case 'category': comparison = (a.category || '').localeCompare(b.category || '', 'uk'); break;
        case 'account': comparison = (a.account || '').localeCompare(b.account || '', 'uk'); break;
        case 'counterparty': comparison = (a.counterparty || '').localeCompare(b.counterparty || '', 'uk'); break;
        default: comparison = 0;
      }
      return sortDirection === 'asc' ? comparison : -comparison;
    });
  }, [processedData.filteredTransactions, sortColumn, sortDirection]);

  const categoryTotals = useMemo(() => {
    const totals = new Map<string, number>();
    processedData.filteredTransactions.forEach(tx => totals.set(tx.category, (totals.get(tx.category) || 0) + tx.amount));
    return Array.from(totals.entries()).sort((a, b) => b[1] - a[1]);
  }, [processedData.filteredTransactions]);

  const monthsWithData = useMemo(() => {
    const months = new Set<string>();
    processedData.filteredTransactions.forEach(tx => {
      const dt = parseDate(tx.date);
      if (dt) months.add(`${dt.getUTCFullYear()}-${dt.getUTCMonth()}`);
    });
    return months.size;
  }, [processedData.filteredTransactions]);

  const handleExportXls = useCallback(async () => {
    const writeXlsxFile = (await import('write-excel-file/browser')).default;
    const header = (value: string) => ({ value, fontWeight: 'bold' as const });
    const columns = [
      { header: header('ID'), width: 8, cell: (tx: Transaction) => ({ type: String, value: tx.id || '' }) },
      { header: header('Дата'), width: 12, cell: (tx: Transaction) => { const dt = parseDate(tx.date); return dt ? { type: Date, format: 'dd.mm.yyyy', value: dt } : { type: String, value: tx.date || '' }; } },
      { header: header('Сума'), width: 12, cell: (tx: Transaction) => ({ type: Number, format: '#,##0.00', value: tx.amount }) },
      { header: header('Категорія'), width: 24, cell: (tx: Transaction) => ({ type: String, value: tx.category || '' }) },
      { header: header('Опис'), width: 40, cell: (tx: Transaction) => ({ type: String, value: tx.description || '' }) },
      { header: header('Рахунок'), width: 12, cell: (tx: Transaction) => ({ type: String, value: tx.account || '' }) },
      { header: header('Контрагент'), width: 18, cell: (tx: Transaction) => ({ type: String, value: tx.counterparty || '' }) },
    ];
    await writeXlsxFile(sortedTransactions, { columns, stickyRowsCount: 1 }).toFile(`earn-${new Date().toISOString().slice(0, 10)}.xlsx`);
  }, [sortedTransactions]);

  // Виділення рядків і «Скопіювати (N)» — той самий хелпер, що на Балансі
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

  const periodLabel = `${formatDateShort(startDate, false)} – ${formatDateShort(endDate)}`;
  const topCategory = categoryTotals[0];
  const topCategoryLabel = topCategory && processedData.totalIncome > 0 ? `${topCategory[0]} · ${Math.round((topCategory[1] / processedData.totalIncome) * 100)}%` : '—';
  const averageMonth = monthsWithData > 0 ? processedData.totalIncome / monthsWithData : 0;
  const categoriesAllSelected = categories.length > 0 && activeCategories.length === categories.length;
  const columns = [
    { key: 'id', label: 'ID', align: 'text-left' },
    { key: 'date', label: 'Дата', align: 'text-left' },
    { key: 'amount', label: 'Сума', align: 'text-right' },
    { key: 'category', label: 'Категорія', align: 'text-left' },
    { key: 'description', label: 'Опис', align: 'text-left' },
    { key: 'account', label: 'Рахунок', align: 'text-left' },
    { key: 'counterparty', label: 'Контрагент', align: 'text-left' },
  ];

  return (
    <div className="flex flex-col gap-4">
      {/* design-md: fintracker Журнал v1 */}
      {isLoading && !data && <p className="text-sm text-ink-2 text-center py-10">Завантаження...</p>}
      {error && !data && <p className="text-danger text-sm text-center py-10">Помилка завантаження звіту: {error}</p>}
      {data && (
        <>
          <div className="flex gap-2.5 items-center flex-wrap">
            <ChipSummary label="Період" value={periodLabel} onClick={() => setIsDateIntervalOpen(!isDateIntervalOpen)} />
            <span className="flex-1" />
            <TextAction onClick={() => { setStartDate(defaultDates.start); setEndDate(defaultDates.end); setSelectedMonthRange({ start: null, end: null }); setSelectedCategories(categories.map(c => c.name)); }}>Скинути</TextAction>
          </div>

          {isDateIntervalOpen && (
            <SectionCard title="Період">
              <div className="flex flex-col gap-4">
                <div className="flex flex-col sm:flex-row gap-3">
                  <div className="sm:flex-[0_0_200px]">
                    <label htmlFor="earn-startDate" className="block text-xs text-ink-2 mb-1">Початок</label>
                    <input id="earn-startDate" type="date" value={startDate} onChange={(e) => { setStartDate(e.target.value); setSelectedMonthRange({ start: null, end: null }); }} className="w-full px-3 py-2 rounded-field border border-line bg-panel text-[13px] tabular-nums focus:border-ink focus:outline-none" />
                  </div>
                  <div className="sm:flex-[0_0_200px]">
                    <label htmlFor="earn-endDate" className="block text-xs text-ink-2 mb-1">Кінець</label>
                    <input id="earn-endDate" type="date" value={endDate} onChange={(e) => { setEndDate(e.target.value); setSelectedMonthRange({ start: null, end: null }); }} className="w-full px-3 py-2 rounded-field border border-line bg-panel text-[13px] tabular-nums focus:border-ink focus:outline-none" />
                  </div>
                </div>
                <div className="flex flex-col gap-2">
                  {availableYearsAndMonths.map(({ year, months }) => (
                    <div key={year} className="flex gap-1.5 items-center flex-wrap">
                      <button type="button" onClick={() => handleYearClick(year)} className={`h-[30px] px-3 rounded-full text-xs font-semibold border ${isYearFullyActive(year) ? 'bg-ink text-white border-ink' : 'bg-mute text-ink border-line hover:border-ink-3'}`}>{year}</button>
                      {months.map(month => {
                        const isActive = isMonthActive(year, month);
                        const isSelecting = selectedMonthRange.start === `${year}-${month}`;
                        return <button key={`${year}-${month}`} type="button" title={`${MONTH_NAMES_SHORT[month]} ${year}`} onClick={() => handleMonthClick(year, month)} className={`h-[30px] px-3 rounded-full text-xs font-medium border ${isActive ? 'bg-ink text-white border-ink' : 'bg-transparent text-ink-2 border-line hover:border-ink-3'} ${isSelecting ? 'ring-2 ring-ink ring-offset-1' : ''}`}>{MONTH_NAMES_SHORT[month]}</button>;
                      })}
                    </div>
                  ))}
                </div>
              </div>
            </SectionCard>
          )}

          <SectionCard
            title="Категорії надходжень"
            aside={<TextAction className="text-xs" onClick={categoriesAllSelected ? handleClearCategories : handleSelectAllCategories}>{categoriesAllSelected ? 'Зняти всі' : 'Вибрати всі'}</TextAction>}
          >
            {isLoading ? <p className="text-xs text-ink-3">Завантаження категорій...</p> : categories.length === 0 ? <p className="text-xs text-ink-3">Категорій не знайдено</p> : (
              <div className="flex gap-1.5 flex-wrap">
                {categories.map((category, index) => {
                  const active = activeCategories.includes(category.name);
                  return (
                    <button key={category.name} type="button" onClick={() => handleCategoryToggle(category.name)} className={`inline-flex items-center gap-2 h-7 sm:h-[32px] px-2.5 sm:px-3.5 rounded-full text-xs sm:text-[13px] font-medium border ${active ? 'bg-ink text-white border-ink' : 'bg-transparent text-ink-2 border-line hover:border-ink-3'}`}>
                      <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: CHART_SERIES[index % CHART_SERIES.length] }} />
                      <span>{category.name}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </SectionCard>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <StatTile label="Усі надходження за період" value={`${formatMoney(processedData.totalIncome)} ₴`} tone="income" />
            <StatTile label="Найбільше джерело" value={topCategoryLabel} />
            <StatTile label="Середнє за місяць" value={`${formatNumber(averageMonth)} ₴`} />
          </div>

          <SectionCard
            title={<button type="button" className="font-display text-sm sm:text-[15px] font-semibold" onClick={() => setIsDynamicsOpen(!isDynamicsOpen)}>Динаміка надходжень за категоріями</button>}
            aside={!isDynamicsOpen && <button type="button" className="inline-flex items-center gap-1 text-[13px] text-ink-2" onClick={() => setIsDynamicsOpen(!isDynamicsOpen)}>згорнуто <ChevronDown /></button>}
          >
            {isDynamicsOpen && processedData.chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={260}>
                <LineChart data={processedData.chartData} margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={T.line} />
                  <XAxis dataKey="name" tick={{ fill: T.ink2, fontSize: 11 }} />
                  <YAxis tickFormatter={(value) => Math.round(value).toLocaleString('uk-UA')} tick={{ fill: T.ink2, fontSize: 11 }} width={62} />
                  <Tooltip formatter={(value: number, name: string) => [`${formatNumber(value)} ₴`, name]} contentStyle={chartTooltipStyle} />
                  <Legend wrapperStyle={{ fontSize: 12, color: T.ink2 }} iconType="circle" />
                  {activeCategories.map(category => (
                    <Line key={category} type="monotone" dataKey={category} stroke={categoryColor(category, categories)} strokeWidth={2.2} dot={{ r: 3 }} activeDot={{ r: 5 }} />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            ) : isDynamicsOpen ? <p className="text-center text-ink-2 py-10">Немає даних для відображення за обраними фільтрами.</p> : null}
          </SectionCard>

          <SectionCard
            title="Надходження за період"
            aside={
              <div className="flex flex-wrap items-center gap-2">
                <Button onClick={handleCopy} disabled={selectedIds.size === 0} variant="primary" title="Скопіювати виділені рядки текстом, як у таблиці">Скопіювати ({selectedIds.size})</Button>
                {copiedToast && <span className="text-income text-sm">{copiedToast}</span>}
                <Button onClick={handleExportXls} disabled={sortedTransactions.length === 0} title="Завантажити надходження у XLSX">XLSX</Button>
              </div>
            }
          >
            <div className="sm:hidden">
              {sortedTransactions.length === 0 ? <div className="py-4 text-center text-ink-2">Транзакцій за обраними фільтрами не знайдено</div> : sortedTransactions.map((tx, index) => {
                const key = rowKey(tx);
                return (
                  <div key={`${tx.id || ''}-${tx.date}-${index}-${tx.amount}`} className={`flex gap-2.5 py-2.5 border-b border-line ${selectedIds.has(key) ? 'bg-mute -mx-4 px-4' : ''}`}>
                    <div className="pt-0.5"><Checkbox checked={selectedIds.has(key)} onChange={() => toggleSelected(key)} label={`Виділити ${tx.id || ''}`} /></div>
                    <div className="flex-1 min-w-0 flex flex-col gap-1">
                      <div className="flex justify-between items-baseline gap-2">
                        <span className="text-xs text-ink-2 tabular-nums truncate">{formatDateShort(tx.date, false)} · {tx.account} · {tx.id || 'без ID'}</span>
                        <span className="text-[15px] font-semibold tabular-nums whitespace-nowrap text-income">+ {formatNumber(tx.amount)}</span>
                      </div>
                      <div className="text-sm">{tx.description}</div>
                      <div className="inline-flex items-center gap-1.5 text-xs text-ink-2 min-w-0">
                        <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: categoryColor(tx.category, categories) }} />
                        <span className="truncate">{tx.category}{tx.counterparty ? ` · ${tx.counterparty}` : ''}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="hidden sm:block overflow-x-auto">
              <table className="w-full border-collapse text-[13.5px]">
                <thead>
                  <tr>
                    <th className="px-2.5 py-2 text-left border-b border-line w-8"><Checkbox checked={allVisibleSelected} onChange={toggleAllVisible} label="Виділити всі" /></th>
                    {columns.map(col => (
                      <th key={col.key} className={`px-2.5 py-2 border-b border-line text-[11px] uppercase tracking-[.06em] font-medium cursor-pointer select-none whitespace-nowrap ${col.align} ${sortColumn === col.key ? 'text-ink' : 'text-ink-2'}`} onClick={() => handleSort(col.key)}>
                        {col.label}{sortColumn === col.key && <SortArrow direction={sortDirection} />}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {sortedTransactions.length === 0 ? (
                    <tr><td colSpan={8} className="py-4 text-center text-ink-2">Транзакцій за обраними фільтрами не знайдено</td></tr>
                  ) : sortedTransactions.map((tx, index) => {
                    const key = rowKey(tx);
                    return (
                      <tr key={`${tx.id || ''}-${tx.date}-${index}-${tx.amount}`} className={selectedIds.has(key) ? 'bg-mute' : ''}>
                        <td className="px-2.5 py-2.5 border-b border-line align-top"><Checkbox checked={selectedIds.has(key)} onChange={() => toggleSelected(key)} label={`Виділити ${tx.id || ''}`} /></td>
                        <td className="px-2.5 py-2.5 border-b border-line align-top text-[11px] text-ink-3 tabular-nums whitespace-nowrap">{tx.id || 'без ID'}</td>
                        <td className="px-2.5 py-2.5 border-b border-line align-top tabular-nums whitespace-nowrap">{formatDateShort(tx.date)}</td>
                        <td className="px-2.5 py-2.5 border-b border-line align-top text-right whitespace-nowrap font-semibold tabular-nums text-income">+ {formatNumber(tx.amount)} ₴</td>
                        <td className="px-2.5 py-2.5 border-b border-line align-top text-ink-2 whitespace-nowrap"><span className="inline-flex items-center gap-1.5"><span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: categoryColor(tx.category, categories) }} />{tx.category}</span></td>
                        <td className="px-2.5 py-2.5 border-b border-line align-top min-w-[220px]">{tx.description}</td>
                        <td className="px-2.5 py-2.5 border-b border-line align-top whitespace-nowrap">{tx.account}</td>
                        <td className="px-2.5 py-2.5 border-b border-line align-top text-ink-2 whitespace-nowrap">{tx.counterparty || '—'}</td>
                      </tr>
                    );
                  })}
                  {sortedTransactions.length > 0 && (
                    <tr className="border-t-[1.5px] border-ink font-semibold">
                      <td colSpan={3} className="px-2.5 py-3">Разом надходжень</td>
                      <td className="px-2.5 py-3 text-right whitespace-nowrap tabular-nums text-income">+ {formatNumber(processedData.totalIncome)} ₴</td>
                      <td colSpan={4} className="px-2.5 py-3 text-xs text-ink-2 font-normal">{sortedTransactions.length} транзакцій · без «Початковий баланс» і переказів</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </SectionCard>
        </>
      )}
    </div>
  );
};

export default EarnPage;
