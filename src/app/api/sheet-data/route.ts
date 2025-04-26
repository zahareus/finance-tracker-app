export const dynamic = 'force-dynamic'; // Вказує Next.js/Vercel не кешувати цей маршрут

import { NextResponse } from 'next/server';
import { google } from 'googleapis';

// Повна та виправлена функція parseDate
const parseDate = (dateString: string | null): Date | null => {
    if (!dateString) return null;
    let parts = dateString.split('-'); // YYYY-MM-DD
    if (parts.length === 3) {
        const date = new Date(Date.UTC(+parts[0], +parts[1] - 1, +parts[2]));
        if (!isNaN(date.getTime())) { return date; }
    }
    parts = dateString.split('.'); // DD.MM.YYYY
    if (parts.length === 3) {
        const date = new Date(Date.UTC(+parts[2], +parts[1] - 1, +parts[0]));
        if (!isNaN(date.getTime())) { return date; }
    }
    return null;
};

// Основна GET функція для API Route
export async function GET() {
  try {
    const credentialsJson = process.env.GOOGLE_SHEETS_CREDENTIALS;
    const spreadsheetId = process.env.GOOGLE_SHEET_ID;

    if (!credentialsJson || !spreadsheetId) {
      console.error("Missing environment variables for Google Sheets API.");
      throw new Error("Server configuration error.");
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
      'Transactions!A2:F',
      'Accounts!A2:A',
      'Categories!A2:B',
    ];

    const response = await sheets.spreadsheets.values.batchGet({
      spreadsheetId: spreadsheetId,
      ranges: ranges,
      valueRenderOption: 'FORMATTED_VALUE', // Читаємо як текст
    });

    if (!response.data.valueRanges || response.data.valueRanges.length === 0) {
        return NextResponse.json({ transactions: [], accounts: [], categories: [] });
    }

    // Обробка транзакцій
    const rawTransactions = response.data.valueRanges[0]?.values || [];
    const transactions = rawTransactions.map(row => ({
      date: row[0] || null,
      amount: parseFloat(String(row[1]).replace(/,/g, '.').replace(/\s/g, '')) || 0, // Покращене перетворення суми
      type: row[2] || '',
      account: row[3] || '',
      category: row[4] || '',
      description: row[5] || '',
    })).filter(t => t.date); // Відкидаємо рядки без дати

    // Обробка рахунків
    const rawAccounts = response.data.valueRanges[1]?.values || [];
    const accounts = rawAccounts.flat().filter(Boolean); // Спрощено

    // Обробка категорій
    const rawCategories = response.data.valueRanges[2]?.values || [];
    const categories = rawCategories.map(row => ({
        name: row[0] || '',
        type: row[1] || ''
    })).filter(c => c.name && c.type);

    return NextResponse.json({
      transactions,
      accounts,
      categories
    });

  } catch (error) {
    console.error('API Route Error fetching sheet data:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown server error occurred';
    // Додамо більше деталей у відповідь помилки
    return NextResponse.json({ error: `Failed to fetch data: ${errorMessage}`, details: error instanceof Error ? error.stack : undefined }, { status: 500 });
  }
}
