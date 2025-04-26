'use client'; // Потрібен для useEffect, useState

import React, { useState, useEffect } from 'react';

// Повторно опишемо типи (в ідеалі їх треба винести в окремий файл)
interface Transaction {
  date: string | null;
  amount: number;
  type: string;
  account: string;
  category: string;
  description: string;
}

// Функція форматування чисел (можна теж винести)
const formatNumber = (num: number) => {
    return num.toLocaleString('uk-UA', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

const TransactionsPage: React.FC = () => {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      setError(null);
      try {
        // Звертаємось до нашого API для отримання даних
        const response = await fetch('/api/sheet-data');
        if (!response.ok) {
          let errorText = `HTTP error! status: ${response.status}`;
          try {
              const errorData = await response.json();
              errorText = errorData.error || errorText;
          } catch (jsonError) {}
          throw new Error(errorText);
        }
        // Отримуємо тільки транзакції, інші дані поки ігноруємо
        const data: { transactions: Transaction[] } = await response.json();
        setTransactions(data.transactions);

      } catch (err) {
         console.error("Failed to fetch transactions:", err);
         setError(err instanceof Error ? err.message : 'An unknown error occurred while fetching data.');
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, []);

  return (
    <div>
      <h1 className="text-xl font-semibold mb-4">Транзакції</h1>

      {/* Тут пізніше будуть фільтри */}
      <div className="mb-4 p-4 border rounded bg-gray-50">
        (Місце для фільтрів)
      </div>

      {/* Таблиця транзакцій */}
      {isLoading && <p>Завантаження транзакцій...</p>}
      {error && <p className="text-red-600">Помилка завантаження: {error}</p>}

      {!isLoading && !error && (
        <div className="overflow-x-auto"> {/* Для прокрутки на малих екранах */}
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
              {transactions.length === 0 ? (
                <tr>
                    <td colSpan={5} className="px-4 py-4 text-center text-gray-500">Транзакцій не знайдено</td>
                </tr>
              ) : (
                transactions.map((tx, index) => (
                  <tr key={index} className={tx.type === 'Витрата' ? 'bg-red-50' : 'bg-green-50'}> {/* Підсвітка рядка */}
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
    </div>
  );
};

export default TransactionsPage;
