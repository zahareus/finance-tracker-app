import { NextResponse } from 'next/server';
import { google } from 'googleapis';

// Кешування для оптимізації (не отримувати дані при кожному запиті в development)
// У Vercel за замовчуванням API routes кешуються. Можна додати 'force-dynamic' для зміни поведінки.
// export const dynamic = 'force-dynamic'; // Розкоментуй, якщо дані мають бути свіжими при кожному запиті

export async function GET() {
  try {
    // Отримуємо облікові дані та ID таблиці з змінних середовища
    const credentialsJson = process.env.GOOGLE_SHEETS_CREDENTIALS;
    const spreadsheetId = process.env.GOOGLE_SHEET_ID;

    // Перевірка наявності змінних
    if (!credentialsJson) {
      console.error("GOOGLE_SHEETS_CREDENTIALS not set.");
      throw new Error("Server configuration error: Missing credentials.");
    }
    if (!spreadsheetId) {
      console.error("GOOGLE_SHEET_ID not set.");
      throw new Error("Server configuration error: Missing Sheet ID.");
    }

    // Парсимо JSON облікових даних
    let credentials;
    try {
        credentials = JSON.parse(credentialsJson);
    } catch (e) {
        console.error("Failed to parse GOOGLE_SHEETS_CREDENTIALS JSON.");
        throw new Error("Server configuration error: Invalid credentials format.");
    }


    // Автентифікація за допомогою сервісного акаунта
    const auth = new google.auth.GoogleAuth({
      credentials: {
        client_email: credentials.client_email,
        // Важливо: заміна \n для коректної роботи приватного ключа на Vercel
        private_key: credentials.private_key?.replace(/\\n/g, '\n'),
      },
      // Вказуємо 'scopes' - які дозволи нам потрібні. Тільки читання.
      scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
    });

    // Створюємо клієнт Google Sheets API
    const sheets = google.sheets({ version: 'v4', auth });

    // Вказуємо діапазони аркушів, з яких читати дані
    // Зверни увагу: читаємо до останньої заповненої колонки (A:F для транзакцій)
    const ranges = [
      'Transactions!A2:F', // Транзакції: Дата, Сума, Тип, Рахунок, Категорія, Опис
      'Accounts!A2:A',     // Рахунки: Тільки назви (колонка А)
      'Categories!A2:B',   // Категорії: Назва та Тип (колонки А, B)
    ];

    // Виконуємо запит batchGet для одночасного отримання даних з усіх діапазонів
    const response = await sheets.spreadsheets.values.batchGet({
      spreadsheetId: spreadsheetId,
      ranges: ranges,
      valueRenderOption: 'UNFORMATTED_VALUE', // Отримати чисті значення (числа, дати як числа)
      dateTimeRenderOption: 'SERIAL_NUMBER', // Отримати дати як серійні номери Excel
    });

    // Перевіряємо, чи є дані
    if (!response.data.valueRanges || response.data.valueRanges.length === 0) {
        console.warn("No data found in the specified ranges.");
        // Повертаємо порожні масиви, якщо даних немає, а не помилку
        return NextResponse.json({
          transactions: [],
          accounts: [],
          categories: [],
        });
    }

    // Функція для конвертації серійного номера дати Excel в об'єкт Date
    // (Excel/Sheets рахують дні з 30 грудня 1899)
    const excelSerialDateToJSDate = (serial: number): Date | null => {
      if (typeof serial !== 'number' || serial <= 0) return null;
      // Важливо: Різниця в днях між базою Excel (умовно 0) та Unix Epoch (1 січня 1970)
      // Плюс один день, бо Excel помилково вважає 1900 рік високосним
      const excelEpochDiff = 25569;
      // Конвертуємо дні в мілісекунди
      const milliseconds = (serial - excelEpochDiff) * 86400 * 1000;
      const date = new Date(milliseconds);
      // Перевірка на валідність дати
      return isNaN(date.getTime()) ? null : date;
    };

    // Обробляємо отримані дані
    const rawTransactions = response.data.valueRanges[0]?.values || [];
    const transactions = rawTransactions.map(row => ({
      date: excelSerialDateToJSDate(row[0]), // Конвертуємо дату
      amount: typeof row[1] === 'number' ? row[1] : 0, // Сума (перевіряємо тип)
      type: row[2] || '',       // Тип
      account: row[3] || '',    // Рахунок
      category: row[4] || '',   // Категорія
      description: row[5] || '',// Опис
    })).filter(t => t.date); // Фільтруємо транзакції без валідної дати

    const rawAccounts = response.data.valueRanges[1]?.values || [];
    const accounts = rawAccounts.map(row => row[0]).filter(Boolean); // Список назв рахунків

    const rawCategories = response.data.valueRanges[2]?.values || [];
    const categories = rawCategories.map(row => ({
        name: row[0] || '',
        type: row[1] || ''
    })).filter(c => c.name && c.type); // Список категорій з типом

    // Повертаємо оброблені дані у форматі JSON
    return NextResponse.json({
      transactions,
      accounts,
      categories
    });

  } catch (error) {
    // Обробка помилок
    console.error('API Route Error fetching sheet data:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown server error occurred';
    // Повертаємо JSON з помилкою та статусом 500
    return NextResponse.json({ error: `Failed to fetch data: ${errorMessage}` }, { status: 500 });
  }
}
