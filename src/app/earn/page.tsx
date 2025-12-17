'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
    ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend
} from 'recharts';

// --- Типи даних ---
interface Transaction {
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

// --- Хелпери ---
const formatNumber = (num: number): string => {
    if (typeof num !== 'number' || isNaN(num)) { return '0,00'; }
    return num.toLocaleString('uk-UA', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

const parseDate = (dateString: string | null): Date | null => {
    if (!dateString || typeof dateString !== 'string') return null;
    try {
        let parts = dateString.split('-');
        if (parts.length === 3 && parts[0].length === 4) {
            const year = parseInt(parts[0], 10);
            const month = parseInt(parts[1], 10);
            const day = parseInt(parts[2], 10);
            if (!isNaN(year) && !isNaN(month) && !isNaN(day) && month >= 1 && month <= 12 && day >= 1 && day <= 31) {
               const date = new Date(Date.UTC(year, month - 1, day));
               if (!isNaN(date.getTime())) return date;
            }
        }
        parts = dateString.split('.');
        if (parts.length === 3 && parts[2].length === 4) {
            const day = parseInt(parts[0], 10);
            const month = parseInt(parts[1], 10);
            const year = parseInt(parts[2], 10);
             if (!isNaN(year) && !isNaN(month) && !isNaN(day) && month >= 1 && month <= 12 && day >= 1 && day <= 31) {
                 const date = new Date(Date.UTC(year, month - 1, day));
                 if (!isNaN(date.getTime())) return date;
             }
        }
    } catch (e) {
        console.error("Error parsing date string:", dateString, e);
    }
    return null;
};

const formatDateForInput = (date: Date): string => {
    if (!(date instanceof Date) || isNaN(date.getTime())) {
        date = new Date();
    }
    const year = date.getUTCFullYear();
    const month = (date.getUTCMonth() + 1).toString().padStart(2, '0');
    const day = date.getUTCDate().toString().padStart(2, '0');
    return `${year}-${month}-${day}`;
};

// Категорії, які виключаємо (не є реальними надходженнями)
const EXCLUDED_CATEGORIES = ['Початковий баланс', 'Переказ вхідний'];

// Кольори для ліній графіка
const LINE_COLORS = ['#8884D8', '#00C49F', '#FFBB28', '#FF8042', '#0088FE', '#82CA9D', '#FFC658', '#FF7C7C', '#A4DE6C', '#D0ED57'];

const EarnPage: React.FC = () => {
    // --- Стан ---
    const [allTransactions, setAllTransactions] = useState<Transaction[]>([]);
    const [categories, setCategories] = useState<CategoryInfo[]>([]);
    const [isLoading, setIsLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);

    // Стан для дат
    const getInitialDates = useCallback(() => {
        const today = new Date();
        const startOfYear = new Date(Date.UTC(today.getFullYear(), 0, 1));
        return { start: formatDateForInput(startOfYear), end: formatDateForInput(today) };
    }, []);

    const initialDates = useMemo(() => getInitialDates(), [getInitialDates]);
    const [startDate, setStartDate] = useState<string>(initialDates.start);
    const [endDate, setEndDate] = useState<string>(initialDates.end);

    // Стан для вибору місяців
    const [selectedMonthRange, setSelectedMonthRange] = useState<{start: string | null, end: string | null}>({start: null, end: null});

    // Стан для вибору категорій (множинний вибір)
    const [selectedCategories, setSelectedCategories] = useState<string[]>([]);

    // Стан для згортання блоків
    const [isDateIntervalOpen, setIsDateIntervalOpen] = useState<boolean>(true);
    const [isDynamicsOpen, setIsDynamicsOpen] = useState<boolean>(true);

    // Стан для сортування таблиці
    const [sortColumn, setSortColumn] = useState<string>('date');
    const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

    // Скорочені назви місяців українською
    const MONTH_NAMES_SHORT = ['СІЧ', 'ЛЮТ', 'БЕР', 'КВІ', 'ТРА', 'ЧЕР', 'ЛИП', 'СЕР', 'ВЕР', 'ЖОВ', 'ЛИС', 'ГРУ'];

    // --- Завантаження даних ---
    useEffect(() => {
        const fetchData = async () => {
           setIsLoading(true); setError(null);
           try {
             const response = await fetch('/api/sheet-data');
             if (!response.ok) { throw new Error(`HTTP error! status: ${response.status}`); }
             const data = await response.json();

             const cleanedTransactions = data.transactions.map((tx: any) => ({
               date: typeof tx.date === 'string' ? tx.date.trim() : null,
               amount: typeof tx.amount === 'number' && !isNaN(tx.amount) ? tx.amount : parseFloat(String(tx.amount || '0').replace(/,/g, '.').replace(/\s/g, '')) || 0,
               type: String(tx?.type || '').trim(),
               account: String(tx?.account || '').trim(),
               category: String(tx?.category || '').trim(),
               description: String(tx?.description || '').trim(),
               counterparty: tx?.counterparty ? String(tx.counterparty).trim() : '',
               project: tx?.project ? String(tx.project).trim() : '',
             })).filter((tx: Transaction) => {
               return tx.date && (tx.type === 'Надходження' || tx.type === 'Витрата') && tx.account && tx.category && typeof tx.amount === 'number' && !isNaN(tx.amount);
             });

             setAllTransactions(cleanedTransactions);

             // Категорії надходжень (виключаємо технічні)
             const cleanedCategories = data.categories
                 .map((cat: any) => ({ name: String(cat?.name || '').trim(), type: String(cat?.type || '').trim() }))
                 .filter((cat: CategoryInfo) => cat.name && cat.type === 'Надходження' && !EXCLUDED_CATEGORIES.includes(cat.name));

             setCategories(cleanedCategories);

             // Встановлюємо першу категорію як обрану за замовчуванням
             if (cleanedCategories.length > 0 && selectedCategories.length === 0) {
               setSelectedCategories([cleanedCategories[0].name]);
             }
           } catch (err) {
             setError(err instanceof Error ? err.message : 'An unknown error occurred.');
             console.error("Failed to fetch data:", err);
           }
           finally { setIsLoading(false); }
        };
        fetchData();
     }, []);

    // --- Генерація років та місяців ---
    const availableYearsAndMonths = useMemo(() => {
        const today = new Date();
        const currentYear = today.getFullYear();
        const currentMonth = today.getMonth();
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

    // Перевірка чи місяць активний
    const isMonthActive = useCallback((year: number, month: number) => {
        const monthStart = new Date(Date.UTC(year, month, 1));
        const monthEnd = new Date(Date.UTC(year, month + 1, 0));
        const start = parseDate(startDate);
        const end = parseDate(endDate);
        if (!start || !end) return false;
        return monthStart <= end && monthEnd >= start;
    }, [startDate, endDate]);

    // Перевірка чи весь рік активний
    const isYearFullyActive = useCallback((year: number) => {
        const yearData = availableYearsAndMonths.find(y => y.year === year);
        if (!yearData) return false;
        return yearData.months.every(month => isMonthActive(year, month));
    }, [availableYearsAndMonths, isMonthActive]);

    // Обробник кліку на рік
    const handleYearClick = useCallback((year: number) => {
        const today = new Date();
        const isCurrentYear = year === today.getFullYear();
        const yearStart = new Date(Date.UTC(year, 0, 1));
        const yearEnd = isCurrentYear
            ? new Date(Date.UTC(year, today.getMonth() + 1, 0))
            : new Date(Date.UTC(year, 11, 31));
        setStartDate(formatDateForInput(yearStart));
        setEndDate(formatDateForInput(yearEnd));
        setSelectedMonthRange({ start: null, end: null });
    }, []);

    // Обробник кліку на місяць
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
            let rangeStart: Date, rangeEnd: Date;
            if (clickedDate < startDateObj) {
                rangeStart = clickedDate;
                rangeEnd = new Date(Date.UTC(startYear, startMonth + 1, 0));
            } else {
                rangeStart = startDateObj;
                rangeEnd = new Date(Date.UTC(year, month + 1, 0));
            }
            setStartDate(formatDateForInput(rangeStart));
            setEndDate(formatDateForInput(rangeEnd));
            setSelectedMonthRange({ start: null, end: null });
        }
    }, [selectedMonthRange]);

    // Обробник вибору категорії (toggle)
    const handleCategoryToggle = useCallback((categoryName: string) => {
        setSelectedCategories(prev => {
            if (prev.includes(categoryName)) {
                // Не дозволяємо зняти останню категорію
                if (prev.length === 1) return prev;
                return prev.filter(c => c !== categoryName);
            } else {
                return [...prev, categoryName];
            }
        });
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

    // --- Обробка даних для графіка та таблиці ---
    const processedData = useMemo(() => {
        const startFilterDate = startDate ? parseDate(startDate) : null;
        const endFilterDate = endDate ? parseDate(endDate) : null;
        if (startFilterDate) startFilterDate.setUTCHours(0, 0, 0, 0);
        if (endFilterDate) endFilterDate.setUTCHours(23, 59, 59, 999);

        // Фільтруємо транзакції надходжень за вибраними категоріями
        const filteredTransactions = allTransactions.filter(tx => {
            if (tx.type !== 'Надходження') return false;
            if (EXCLUDED_CATEGORIES.includes(tx.category)) return false;
            if (selectedCategories.length > 0 && !selectedCategories.includes(tx.category)) return false;
            const txDate = parseDate(tx.date);
            if (!txDate) return false;
            if (startFilterDate && txDate < startFilterDate) return false;
            if (endFilterDate && txDate > endFilterDate) return false;
            return true;
        });

        // Генеруємо місяці для графіка
        const allMonthsInRange: { key: string; name: string }[] = [];
        if (startFilterDate && endFilterDate && startFilterDate <= endFilterDate) {
            let currentMonth = new Date(Date.UTC(startFilterDate.getUTCFullYear(), startFilterDate.getUTCMonth(), 1));
            while (currentMonth <= endFilterDate) {
                const monthYearKey = `${currentMonth.getUTCFullYear()}-${(currentMonth.getUTCMonth() + 1).toString().padStart(2, '0')}`;
                const monthName = currentMonth.toLocaleString('uk-UA', { month: 'short', year: 'numeric', timeZone: 'UTC' });
                allMonthsInRange.push({ key: monthYearKey, name: monthName });
                if (currentMonth.getUTCMonth() === 11) {
                    currentMonth = new Date(Date.UTC(currentMonth.getUTCFullYear() + 1, 0, 1));
                } else {
                    currentMonth.setUTCMonth(currentMonth.getUTCMonth() + 1);
                }
            }
        }

        // Групуємо по місяцям та категоріям
        const monthlyData: { [monthKey: string]: { [category: string]: number } } = {};
        allMonthsInRange.forEach(({ key }) => {
            monthlyData[key] = {};
            selectedCategories.forEach(cat => {
                monthlyData[key][cat] = 0;
            });
        });

        filteredTransactions.forEach(tx => {
            const txDate = parseDate(tx.date);
            if (txDate) {
                const monthYear = `${txDate.getUTCFullYear()}-${(txDate.getUTCMonth() + 1).toString().padStart(2, '0')}`;
                if (monthlyData[monthYear] && selectedCategories.includes(tx.category)) {
                    monthlyData[monthYear][tx.category] = (monthlyData[monthYear][tx.category] || 0) + tx.amount;
                }
            }
        });

        // Формуємо дані для графіка
        const chartData = allMonthsInRange.map(({ key, name }) => {
            const dataPoint: { name: string; [key: string]: string | number } = { name };
            selectedCategories.forEach(cat => {
                dataPoint[cat] = monthlyData[key][cat] || 0;
            });
            return dataPoint;
        });

        // Загальна сума надходжень
        const totalIncome = filteredTransactions.reduce((sum, tx) => sum + tx.amount, 0);

        return { filteredTransactions, chartData, totalIncome };
    }, [allTransactions, startDate, endDate, selectedCategories]);

    // --- РЕНДЕР КОМПОНЕНТА ---
    return (
        <div>
          {/* --- БЛОК ІНТЕРВАЛ ДАТ --- */}
          <div className="mb-4 border rounded bg-white shadow">
              <h2
                  className="text-lg font-semibold p-4 cursor-pointer hover:bg-gray-50 transition-colors duration-200 select-none flex items-center justify-between"
                  onClick={() => setIsDateIntervalOpen(!isDateIntervalOpen)}
              >
                  <span>Інтервал дат</span>
                  <span className="text-gray-400 text-sm">{isDateIntervalOpen ? '▲' : '▼'}</span>
              </h2>
              {isDateIntervalOpen && (
                  <div className="p-4 pt-0 space-y-4">
                      {/* Верхній рядок: Початок та Кінець */}
                      <div className="flex flex-col sm:flex-row gap-4">
                          <div className='flex-1'>
                              <label htmlFor="earn-startDate" className="block text-xs font-medium text-gray-600 mb-1">Початок</label>
                              <input
                                  id="earn-startDate"
                                  type="date"
                                  value={startDate}
                                  onChange={(e) => {
                                      setStartDate(e.target.value);
                                      setSelectedMonthRange({ start: null, end: null });
                                  }}
                                  className="w-full p-1.5 sm:p-2 border border-gray-300 rounded text-xs sm:text-sm shadow-sm focus:ring-2 focus:ring-[#8884D8] focus:border-[#8884D8]"
                              />
                          </div>
                          <div className='flex-1'>
                              <label htmlFor="earn-endDate" className="block text-xs font-medium text-gray-600 mb-1">Кінець</label>
                              <input
                                  id="earn-endDate"
                                  type="date"
                                  value={endDate}
                                  onChange={(e) => {
                                      setEndDate(e.target.value);
                                      setSelectedMonthRange({ start: null, end: null });
                                  }}
                                  className="w-full p-1.5 sm:p-2 border border-gray-300 rounded text-xs sm:text-sm shadow-sm focus:ring-2 focus:ring-[#8884D8] focus:border-[#8884D8]"
                              />
                          </div>
                      </div>

                      {/* Таймлайн років та місяців */}
                      <div className="space-y-3">
                          {availableYearsAndMonths.map(({ year, months }) => (
                              <div key={year} className="space-y-2">
                                  <div className="flex items-center gap-3">
                                      <button
                                          onClick={() => handleYearClick(year)}
                                          className={`text-sm font-bold px-3 py-1 rounded-lg transition-colors duration-150 ${
                                              isYearFullyActive(year)
                                                  ? 'bg-[#8884D8] text-white'
                                                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                          }`}
                                      >
                                          {year}
                                      </button>
                                      <div className="flex-1 grid grid-cols-6 md:grid-cols-12 gap-1">
                                          {months.map((month) => {
                                              const isActive = isMonthActive(year, month);
                                              const monthKey = `${year}-${month}`;
                                              const isSelecting = selectedMonthRange.start === monthKey;

                                              return (
                                                  <button
                                                      key={month}
                                                      onClick={() => handleMonthClick(year, month)}
                                                      className={`
                                                          w-full aspect-square rounded-full text-xs font-medium
                                                          transition-all duration-150 flex items-center justify-center
                                                          ${isActive
                                                              ? 'bg-[#8884D8] text-white shadow-md'
                                                              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                                          }
                                                          ${isSelecting ? 'ring-2 ring-[#00C49F] ring-offset-1' : ''}
                                                      `}
                                                      title={`${MONTH_NAMES_SHORT[month]} ${year}`}
                                                  >
                                                      {MONTH_NAMES_SHORT[month]}
                                                  </button>
                                              );
                                          })}
                                      </div>
                                  </div>
                              </div>
                          ))}
                      </div>
                  </div>
              )}
          </div>

          {/* --- БЛОК КАТЕГОРІЇ НАДХОДЖЕНЬ --- */}
          <div className="mb-6">
              <h2 className="text-lg font-semibold mb-3 text-center">Категорії надходжень</h2>
              {isLoading ? (
                  <p className="text-center text-gray-500">Завантаження категорій...</p>
              ) : error ? (
                  <p className="text-center text-red-600">Помилка: {error}</p>
              ) : categories.length === 0 ? (
                  <p className="text-center text-gray-500">Категорій не знайдено</p>
              ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2 sm:gap-3">
                      {categories.map((category, index) => (
                          <button
                              key={category.name}
                              onClick={() => handleCategoryToggle(category.name)}
                              className={`p-3 sm:p-4 rounded-lg border-2 text-center transition-all duration-200 ${
                                  selectedCategories.includes(category.name)
                                      ? 'border-[#8884D8] bg-[#8884D8] text-white shadow-lg'
                                      : 'border-gray-200 bg-white hover:border-[#8884D8] hover:shadow-md'
                              }`}
                          >
                              <span className="text-xs sm:text-sm font-medium block truncate">
                                  {category.name}
                              </span>
                              {selectedCategories.includes(category.name) && (
                                  <span className="text-xs mt-1 block text-white/80">
                                      <span className="inline-block w-3 h-3 rounded-full mr-1" style={{ backgroundColor: LINE_COLORS[index % LINE_COLORS.length] }}></span>
                                  </span>
                              )}
                          </button>
                      ))}
                  </div>
              )}
          </div>

          {/* --- ГРАФІК ДИНАМІКИ НАДХОДЖЕНЬ --- */}
          {!isLoading && !error && (
              <div className="p-4 border rounded shadow bg-white mb-6">
                  <h2
                      className="text-lg font-semibold mb-4 cursor-pointer hover:bg-gray-50 transition-colors duration-200 select-none flex items-center justify-between"
                      onClick={() => setIsDynamicsOpen(!isDynamicsOpen)}
                  >
                      <span>Динаміка надходжень</span>
                      <span className="text-gray-400 text-sm">{isDynamicsOpen ? '▲' : '▼'}</span>
                  </h2>
                  {isDynamicsOpen && processedData.chartData.length > 0 ? (
                      <>
                          <ResponsiveContainer width="100%" height={350}>
                              <LineChart data={processedData.chartData} margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
                                  <CartesianGrid strokeDasharray="3 3" />
                                  <XAxis dataKey="name" fontSize={12} />
                                  <YAxis tickFormatter={(value) => formatNumber(value)} fontSize={12} width={70}/>
                                  <Tooltip
                                      formatter={(value: number, name: string) => [`${formatNumber(value)} ₴`, name]}
                                      contentStyle={{ backgroundColor: 'white', border: '1px solid #ccc', borderRadius: '8px' }}
                                  />
                                  <Legend wrapperStyle={{fontSize: "12px"}}/>
                                  {selectedCategories.map((category, index) => (
                                      <Line
                                          key={category}
                                          type="monotone"
                                          dataKey={category}
                                          stroke={LINE_COLORS[categories.findIndex(c => c.name === category) % LINE_COLORS.length]}
                                          strokeWidth={2}
                                          dot={{ r: 4 }}
                                          activeDot={{ r: 6 }}
                                      />
                                  ))}
                              </LineChart>
                          </ResponsiveContainer>

                          {/* Сума надходжень під графіком */}
                          <div className="mt-6 flex justify-center">
                              <div className="text-center">
                                  <p className="text-sm text-gray-600 mb-1">Сума надходжень</p>
                                  <p className="text-2xl font-bold" style={{ color: '#00C49F' }}>
                                      {formatNumber(processedData.totalIncome)} ₴
                                  </p>
                              </div>
                          </div>
                      </>
                  ) : isDynamicsOpen ? (
                      <p className="text-center text-gray-500 py-10">Немає даних для відображення за обраними фільтрами.</p>
                  ) : null}
              </div>
          )}

          {/* --- ТАБЛИЦЯ ТРАНЗАКЦІЙ --- */}
          {isLoading && <p className="mt-4 text-center">Завантаження транзакцій...</p>}
          {!isLoading && !error && (
              <div className="overflow-x-auto mt-4">
                 <h2 className="text-lg font-semibold mb-2 text-center">Детальні надходження за період</h2>
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
                     </tr>
                   </thead>
                   <tbody className="bg-white divide-y divide-gray-200">
                     {processedData.filteredTransactions.length === 0 ? (
                       <tr> <td colSpan={6} className="px-4 py-4 text-center text-gray-500">Транзакцій за обраними фільтрами не знайдено</td> </tr>
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
                               comparison = a.amount - b.amount;
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
                             default:
                               comparison = 0;
                           }
                           return sortDirection === 'asc' ? comparison : -comparison;
                         })
                         .map((tx, index) => (
                           <tr key={`${tx.date}-${index}-${tx.amount}`} className="bg-green-50 hover:bg-green-100 transition-colors duration-150 ease-in-out">
                             <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-900">{tx.date}</td>
                             <td className="px-4 py-2 whitespace-nowrap text-sm text-right font-medium text-[#00C49F]">+ {formatNumber(tx.amount)} ₴</td>
                             <td className="px-4 py-2 text-sm text-gray-500 max-w-[200px] truncate">{tx.description}</td>
                             <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-500">{tx.category}</td>
                             <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-500">{tx.account}</td>
                             <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-500">{tx.counterparty || '-'}</td>
                           </tr>
                         ))
                     )}
                     {/* Підсумковий рядок */}
                     {processedData.filteredTransactions.length > 0 && (
                         <tr className="bg-green-100 border-t-2 border-green-300">
                             <td className="px-4 py-2 whitespace-nowrap text-sm font-medium text-green-800">
                                 Разом
                             </td>
                             <td className="px-4 py-2 whitespace-nowrap text-sm text-right font-bold text-green-800">
                                 + {formatNumber(processedData.totalIncome)} ₴
                             </td>
                             <td colSpan={4} className="px-4 py-2 text-sm text-green-800">
                                 Сума надходжень за обраний період
                             </td>
                         </tr>
                     )}
                   </tbody>
                 </table>
              </div>
          )}
        </div>
      );
};

export default EarnPage;
