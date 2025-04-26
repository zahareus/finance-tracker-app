import { NextResponse } from 'next/server';
import { google } from 'googleapis';
import type { NextRequest } from 'next/server'; // Потрібен для доступу до заголовків

// Функція перевірки паролю
function isAuthenticated(req: NextRequest): boolean {
  const sitePassword = process.env.SITE_PASSWORD; // Пароль з Vercel

  // Якщо пароль не задано на Vercel, завжди забороняємо доступ
  if (!sitePassword) {
    console.error('API_AUTH: SITE_PASSWORD environment variable is not set! Access denied.');
    return false;
  }

  // Отримуємо пароль з кастомного заголовка
  const providedPassword = req.headers.get('X-App-Password');

  if (providedPassword === sitePassword) {
    return true; // Пароль вірний
  } else {
    // Не логуємо сам невірний пароль, тільки факт невдачі
    console.warn(`API_AUTH: Failed auth attempt (password provided: ${providedPassword ? 'yes' : 'no'})`);
    return false; // Пароль невірний або відсутній
  }
}

// Функція парсингу дати (скопійовано з page.tsx для консистентності, якщо буде розширення API)
const parseDate = (dateString: string | null): Date | null => {
    if (!dateString || typeof dateString !== 'string') return null; try { let parts = dateString.split('-'); if (parts.length === 3) { const date = new Date(Date.UTC(+parts[0], +parts[1] - 1, +parts[2])); if (!isNaN(date.getTime())) return date; } parts = dateString.split('.'); if (parts.length === 3) { const date = new Date(Date.UTC(+parts[2], +parts[1] - 1, +parts[0])); if (!isNaN(date.getTime())) return date; } } catch (e) {} return null;
};

// Основна GET функція API
export async function GET(req: NextRequest) { // Додаємо req
  // **ПЕРЕВІРКА АВТЕНТИФІКАЦІЇ НА ПОЧАТКУ**
  if (!isAuthenticated(req)) {
    // Повертаємо помилку 401 Unauthorized, якщо пароль невірний
    // Браузерний fetch отримає цю помилку
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Якщо автентифікація пройдена, продовжуємо отримувати дані...
  try {
    const credentialsJson = process.env.GOOGLE_SHEETS_CREDENTIALS;
    const spreadsheetId = process.env.GOOGLE_SHEET_ID;

    if (!credentialsJson || !spreadsheetId) { throw new Error("Server configuration error: Missing credentials or Sheet ID."); }
    let credentials;
    try { credentials = JSON.parse(credentialsJson); }
    catch (e) { throw new Error("Server configuration error: Invalid credentials format."); }

    const auth = new google.auth.GoogleAuth({
      credentials: { client_email: credentials.client_email, private_key: credentials.private_key?.replace(/\\n/g, '\n') },
      scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
    });
    const sheets = google.sheets({ version: 'v4', auth });
    const ranges = [ 'Transactions!A2:F', 'Accounts!A2:A', 'Categories!A2:B' ]; // Зміни діапазони, якщо потрібно

    const response = await sheets.spreadsheets.values.batchGet({
        spreadsheetId: spreadsheetId,
        ranges: ranges,
        valueRenderOption: 'FORMATTED_VALUE', // Читаємо як текст
    });

    if (!response.data.valueRanges) {
        console.warn("API: No data found in spreadsheet ranges.");
        return NextResponse.json({ transactions: [], accounts: [], categories: [] });
    }

    // Обробка та очистка даних (важливо для консистентності)
    const rawTransactions = response.data.valueRanges[0]?.values || [];
    const transactions = rawTransactions.map((tx: any) => ({
        date: typeof tx[0] === 'string' ? tx[0].trim() : null,
        // Перевіряємо і другий елемент перед доступом
        amount: typeof tx[1] !== 'undefined' ? parseFloat(String(tx[1]).replace(/,/g, '.').replace(/\s/g, '')) || 0 : 0,
        type: typeof tx[2] === 'string' ? tx[2].trim() : '',
        account: typeof tx[3] === 'string' ? tx[3].trim() : '',
        category: typeof tx[4] === 'string' ? tx[4].trim() : '',
        description: typeof tx[5] === 'string' ? tx[5].trim() : '',
    })).filter((tx: Transaction) => tx.date && tx.type && tx.account && tx.category && typeof tx.amount === 'number'); // Базова фільтрація неповних даних

    const rawAccounts = response.data.valueRanges[1]?.values || [];
    const accounts = rawAccounts.flat().map((acc: any) => String(acc || '').trim()).filter(Boolean);

    const rawCategories = response.data.valueRanges[2]?.values || [];
    const categories = rawCategories.map((cat: any) => ({
        name: String(cat[0] || '').trim(),
        type: String(cat[1] || '').trim()
    })).filter((cat: CategoryInfo) => cat.name && (cat.type === 'Надходження' || cat.type === 'Витрата'));


    return NextResponse.json({ transactions, accounts, categories });

  } catch (error) {
    console.error('API Route Error fetching sheet data:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown server error occurred';
    return NextResponse.json({ error: `Failed to fetch data: ${errorMessage}` }, { status: 500 });
  }
}
