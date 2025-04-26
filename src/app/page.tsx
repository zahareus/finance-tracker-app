'use client'; // Залишаємо на випадок майбутньої інтерактивності

import React from 'react';

const TransactionsPage: React.FC = () => {
  // Додаємо лог, щоб бачити в консолі браузера, чи цей компонент взагалі запускається
  console.log("ЗАПУСК: Спрощена сторінка TransactionsPage");

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6 text-blue-700">Транзакції (Тестова Спрощена Версія)</h1>

      {/* --- Тестовий Блок 1 (Замість Фільтрів) --- */}
      <div className="mb-6 p-6 border-4 border-dashed border-red-400 bg-red-50">
        <p className="text-red-800 font-semibold text-lg text-center">
          ТЕСТОВИЙ БЛОК №1
        </p>
        <p className="text-red-700 text-center mt-2">
          Якщо ти бачиш цей червоний блок, значить оновлений файл сторінки дійсно працює!
        </p>
      </div>
      {/* --- Кінець Тестового Блоку 1 --- */}

      {/* --- Тестовий Блок 2 (Замість Таблиці) --- */}
      <div className="mt-6 p-6 border-4 border-dashed border-green-400 bg-green-50">
        <p className="text-green-800 font-semibold text-lg text-center">
           ТЕСТОВИЙ БЛОК №2
        </p>
         <p className="text-green-700 text-center mt-2">
           Стара логіка завантаження та відображення даних тимчасово видалена.
         </p>
      </div>
       {/* --- Кінець Тестового Блоку 2 --- */}

    </div>
  );
};

export default TransactionsPage;
