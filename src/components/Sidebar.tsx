'use client'; // Вказуємо, що це Клієнтський Компонент для використання хуків

import React, { useState, useEffect } from 'react';

// Описуємо типи даних, які ми очікуємо отримати з API
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

interface Balance {
  [accountName: string]: number;
}

const Sidebar: React.FC = () => {
  const [accounts, setAccounts] = useState<string[]>([]);
  const [balances, setBalances] = useState<Balance>({});
  const [totalBalance, setTotalBalance] = useState<number>(0);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const response = await fetch('/api/sheet-data');
        if (!response.ok) {
          // Спробуємо прочитати тіло помилки, якщо воно є
          let errorText = `HTTP error! status: ${response.status}`;
          try {
              const errorData = await response.json();
              errorText = errorData.error || errorText;
          } catch (jsonError) {
              // Ігноруємо помилку парсингу JSON, використовуємо статус HTTP
          }
          throw new Error(errorText);
        }
        const data: {
          transactions: Transaction[];
          accounts: string[];
          categories: CategoryInfo[]; // Хоча категорії тут не потрібні, API їх повертає
        } = await response.json();

        // ----- Розрахунок Балансів -----
        const calculatedBalances: Balance = {};
        let calculatedTotalBalance = 0;

        // Ініціалізуємо баланси нулями
        data.accounts.forEach(acc => {
          calculatedBalances[acc] = 0;
        });

        // Проходимо по транзакціях для розрахунку
        data.transactions.forEach(tx => {
          if (calculatedBalances.hasOwnProperty(tx.account)) {
            if (tx.type === 'Надходження') {
              calculatedBalances[tx.account] += tx.amount;
            } else if (tx.type === 'Витрата') {
              calculatedBalances[tx.account] -= tx.amount;
            }
          }
        });

        // Розраховуємо загальний баланс
        calculatedTotalBalance = Object.values(calculatedBalances).reduce((sum, bal) => sum + bal, 0);
        // ----- Кінець Розрахунку Балансів -----

        setAccounts(data.accounts);
        setBalances(calculatedBalances);
        setTotalBalance(calculatedTotalBalance);

      } catch (err) {
         console.error("Failed to fetch or process data:", err);
         setError(err instanceof Error ? err.message : 'An unknown error occurred while fetching data.');
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, []); // Пустий масив залежностей означає, що ефект виконається один раз при монтуванні

  // Функція для форматування чисел (додає пробіли як роздільники тисяч)
  const formatNumber = (num: number) => {
    return num.toLocaleString('uk-UA', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  return (
    <aside className="w-64 bg-gray-50 p-4 border-r border-gray-200 flex flex-col h-screen"> {/* Стилі Tailwind */}
      <h2 className="text-lg font-semibold mb-4">Огляд</h2>

      {isLoading && <p className="text-gray-500">Завантаження балансів...</p>}
      {error && <p className="text-red-600">Помилка: {error}</p>}

      {!isLoading && !error && (
        <>
          {/* Загальний Баланс */}
          <div className="mb-6">
            <p className="text-sm text-gray-500">Загальний баланс</p>
            <p className="text-2xl font-bold">₴ {formatNumber(totalBalance)}</p>
          </div>

          {/* Список Рахунків */}
          <h3 className="text-md font-semibold mb-2 border-t pt-4">Мої рахунки</h3>
          <ul className="space-y-2 overflow-y-auto flex-grow"> {/* Додано overflow та flex-grow */}
            {accounts.map((account) => (
              <li key={account} className="flex justify-between items-center text-sm">
                <span>{account}</span>
                <span className="font-medium">₴ {formatNumber(balances[account] ?? 0)}</span>
              </li>
            ))}
          </ul>
        </>
      )}
       {/* Можна додати тут кнопку оновлення даних пізніше */}
    </aside>
  );
};

export default Sidebar;
