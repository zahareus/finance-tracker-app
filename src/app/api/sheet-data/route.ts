import { NextResponse } from 'next/server';
import { google } from 'googleapis';

// export const dynamic = 'force-dynamic'; // Розкоментуй, якщо дані мають бути свіжими при кожному запиті

export async function GET() {
  try {
    const credentialsJson = process.env.GOOGLE_SHEETS_CREDENTIALS;
    const spreadsheetId = process.env.GOOGLE_SHEET_ID;

    if (!credentialsJson) {
      console.error("GOOGLE_SHEETS_CREDENTIALS not set.");
      throw new Error("Server configuration error: Missing credentials.");
    }
    if (!spreadsheetId) {
      console.error("GOOGLE_SHEET_ID not set.");
      throw new Error("Server configuration error: Missing Sheet ID.");
    }

    let credentials;
    try {
        credentials = JSON.parse(credentialsJson);
    } catch (e) {
        console.error("Failed to parse GOOGLE_SHEETS_CREDENTIALS JSON.");
        throw new Error("Server configuration error: Invalid credentials format.");
    }

    const auth = new google.auth.GoogleAuth({
      credentials: {
        client_email: credentials.client_email,
        private_key: credentials.private_key?.replace(/\\n/g, '\n'),
      },
      scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
    });

    const sheets = google.sheets({ version: 'v4', auth });

    const ranges = [
      'Transactions!A2:F', // Транзакції: Дата, Сума, Тип, Рахунок, Категорія, Опис
      'Accounts!A2:A',     // Рахунки: Тільки назви
      'Categories!A2:B',   // Категорії: Назва та Тип
    ];

    const response = await sheets.spreadsheets.values.batchGet({
      spreadsheetId: spreadsheetId,
      ranges: ranges,
      // Читаємо значення так, як вони відформатовані в таблиці (дати будуть текстом)
      valueRenderOption: 'FORMATTED_VALUE',
    });

    if (!response.data.valueRanges || response.data.valueRanges.length === 0) {
        console.warn("No data found in the specified ranges.");
        return NextResponse.json({
          transactions: [],
          accounts: [],
          categories: [],
        });
    }

    // Обробляємо отримані дані
    const rawTransactions = response.data.valueRanges[0]?.values || [];
    const transactions = rawTransactions.map(row => ({
      date: row[0] || null,        // Читаємо дату як текст
      amount: parseFloat(String(row[1]).replace(/,/g, '.')) || 0, // Конвертуємо суму в число (враховуємо кому як десятковий роздільник)
      type: row[2] || '',       // Тип
      account: row[3] || '',    // Рахунок
      category: row[4] || '',   // Категорія
      description: row[5] || '',// Опис
    })).filter(t => t.date); // Фільтруємо ті, де немає дати

    const rawAccounts = response.data.valueRanges[1]?.values || [];
    const accounts = rawAccounts.map(row => row[0]).filter(Boolean); // Список назв рахунків

    const rawCategories = response.data.valueRanges[2]?.values || [];
    const categories = rawCategories.map(row => ({
        name: row[0] || '',
        type: row[1] || ''
    })).filter(c => c.name && c.type); // Список категорій з типом

    return NextResponse.json({
      transactions,
      accounts,
      categories
    });

  } catch (error) {
    console.error('API Route Error fetching sheet data:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown server error occurred';
    return NextResponse.json({ error: `Failed to fetch data: ${errorMessage}` }, { status: 500 });
  }
}
