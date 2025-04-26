'use client';

import React, { useState, useEffect, useMemo } from 'react'; // Додали useMemo

// --- Типи даних (можна винести в окремий файл types.ts) ---
interface Transaction {
  date: string | null; // Дата тепер рядок
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
// --- Кінець типів ---

// --- Хелпери (можна винести в utils.ts) ---
const formatNumber = (num: number) => {
    return num.toLocaleString('uk-UA', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};
// Функція для парсингу дати з рядка "ДД.ММ.РРРР"
const parseDate = (dateString: string | null): Date | null => {
    if (!dateString) return null;
    const parts = dateString.split('.');
    if (parts.length === 3) {
        // Місяці в Date нумеруються з 0 (0 = січень)
        const date = new Date(+parts[2], +parts[1] - 1, +parts[0]);
        // Перевірка на валідність дати
        if (!isNaN(date.getTime())) {
            return date;
        }
    }
    return null;
};
 // --- Кінець хелперів ---


const TransactionsPage: React.FC = () => {
  // --- Стан для даних ---
  const [allTransactions, setAllTransactions] = useState<Transaction[]>([]);
  const [accounts, setAccounts] = useState<string[]>([]); // Зберігаємо список рахунків
  const [categories, setCategories] = useState<CategoryInfo[]>([]); // Зберігаємо список категорій
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  // --- Кінець стану для даних ---

  // --- Стан для ФІЛЬТРІВ ---
  const [startDate, setStartDate] = useState<string>(''); // YYYY-MM-DD
  const [endDate, setEndDate] = useState<string>('');     // YYYY-MM-DD
  const [selectedAccounts, setSelectedAccounts] = useState<string[]>([]); // Масив обраних рахунків
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]); // Масив обраних категорій
  const [selectedType, setSelectedType] = useState<string>('Всі'); // 'Всі', 'Надходження', 'Витрата'
  // --- Кінець стану для ФІЛЬТРІВ ---

  // --- Завантаження даних ---
  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const response = await fetch('/api/sheet-data');
        if (!response.ok) {
          let errorText = `HTTP error! status: ${response.status}`;
          try { const errorData = await response.json(); errorText = errorData.error || errorText; } catch (e) {}
          throw new Error(errorText);
        }
        const data: {
          transactions: Transaction[];
          accounts: string[];
          categories: CategoryInfo[];
        } = await response.json();

        setAllTransactions(data.transactions);
        setAccounts(data.accounts); // Зберігаємо рахунки
        setCategories(data.categories); // Зберігаємо категорії

      } catch (err) {
         console.error("Failed to fetch data:", err);
         setError(err instanceof Error ? err.message : 'An unknown error occurred.');
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, []);
  // --- Кінець завантаження даних ---


  // --- ЛОГІКА ФІЛЬТРАЦІЇ ---
  // Використовуємо useMemo, щоб перераховувати відфільтровані транзакції
  // тільки коли змінюється повний список або значення фільтрів
  const filteredTransactions = useMemo(() => {
    // Парсимо дати фільтрів один раз
    const start = startDate ? new Date(startDate) : null;
    const end = endDate ? new Date(endDate) : null;
    // Важливо: Встановлюємо час для коректного порівняння дат
    if (start) start.setHours(0, 0, 0, 0);
    if (end) end.setHours(23, 59, 59, 999);


    return allTransactions.filter(tx => {
      // 1. Фільтр по типу
      if (selectedType !== 'Всі' && tx.type !== selectedType) {
        return false;
      }

      // 2. Фільтр по рахунках (якщо є обрані)
      if (selectedAccounts.length > 0 && !selectedAccounts.includes(tx.account)) {
        return false;
      }

      // 3. Фільтр по категоріях (якщо є обрані)
      if (selectedCategories.length > 0 && !selectedCategories.includes(tx.category)) {
        return false;
      }

      // 4. Фільтр по даті
      const txDate = parseDate(tx.date);
      if (!txDate) return false; // Не показуємо транзакції без валідної дати

      if (start && txDate < start) {
        return false;
      }
      if (end && txDate > end) {
        return false;
      }

      // Якщо пройшли всі перевірки - транзакція відповідає фільтрам
      return true;
    });
  }, [allTransactions, startDate, endDate, selectedAccounts, selectedCategories, selectedType]);
  // --- Кінець ЛОГІКИ ФІЛЬТРАЦІЇ ---


  // --- РЕНДЕР КОМПОНЕНТА ---
  return (
    <div>
      <h1 className="text-xl font-semibold mb-4">Транзакції</h1>

      {/* --- Місце для UI Фільтрів (Додамо пізніше) --- */}
      <div className="mb-4 p-4 border rounded bg-gray-50">
        <p className="text-center text-gray-500 font-medium">
          (Тут будуть елементи керування фільтрами: Дати, Рахунки, Категорії, Тип)
        </p>
        {/* Тимчасово виведемо стан фільтрів для перевірки */}
         {/* <div className="text-xs mt-2">
            <p>StartDate: {startDate || 'Не вибрано'}</p>
            <p>EndDate: {endDate || 'Не вибрано'}</p>
            <p>Accounts: {selectedAccounts.join(', ') || 'Всі'}</p>
            <p>Categories: {selectedCategories.join(', ') || 'Всі'}</p>
            <p>Type: {selectedType}</p>
         </div> */}
      </div>
      {/* --- Кінець місця для UI Фільтрів --- */}


      {/* --- Таблиця транзакцій (Тепер використовує filteredTransactions) --- */}
      {isLoading && <p>Завантаження транзакцій...</p>}
      {error && <p className="text-red-600">Помилка завантаження: {error}</p>}

      {!isLoading && !error && (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th scope="col" className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Дата</th>
                <th scope="col" className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Рахунок</th>
                <th scope="col" className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Категорія</th>
                <th scope="col" className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Опис</th>
                <th scope="col" className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Сума</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {/* Показуємо ВІДФІЛЬТРОВАНІ транзакції */}
              {filteredTransactions.length === 0 ? (
                <tr>
                    <td colSpan={5} className="px-4 py-4 text-center text-gray-500">Транзакцій за обраними фільтрами не знайдено</td>
                </tr>
              ) : (
                // Ітеруємо по filteredTransactions замість allTransactions
                filteredTransactions.map((tx, index) => (
                  <tr key={index} className={tx.type === 'Витрата' ? 'bg-red-50 hover:bg-red-100' : 'bg-green-50 hover:bg-green-100'}>
                    <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-900">{tx.date}</td>
                    <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-500">{tx.account}</td>
                    <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-500">{tx.category}</td>
                    <td className="px-4 py-2 text-sm text-gray-500">{tx.description}</td>
                    <td className={`px-4 py-2 whitespace-nowrap text-sm text-right font-medium ${tx.type === 'Витрата' ? 'text-red-600' : 'text-green-600'}`}>
                      {tx.type === 'Витрата' ? '-' : '+'} {formatNumber(tx.amount)} ₴
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
      {/* --- Кінець Таблиці транзакцій --- */}

    </div>
  );
};

export default TransactionsPage;
