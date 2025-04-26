import { NextResponse } from 'next/server';
import { google } from 'googleapis';
import type { NextRequest } from 'next/server'; // Імпортуємо NextRequest

// Перевірка паролю винесена в окрему функцію для чистоти
function checkAuth(req: NextRequest): boolean {
    const sitePassword = process.env.SITE_PASSWORD;
    // Якщо пароль не заданий на Vercel, вважаємо авторизацію пройденою (небезпечно для продакшену!)
    if (!sitePassword) {
        console.warn("API_AUTH: SITE_PASSWORD environment variable is not set. Access granted without password check.");
        return true;
    }

    // Отримуємо пароль з кастомного заголовка
    const providedPassword = req.headers.get('X-App-Password');

    if (!providedPassword || providedPassword !== sitePassword) {
        console.warn(`API_AUTH: Authentication failed. Provided: ${providedPassword ? '***' : 'None'}`);
        return false; // Пароль невірний або відсутній
    }

    // console.log("API_AUTH: Authentication successful.");
    return true; // Пароль вірний
}


export async function GET(req: NextRequest) { // Додаємо req як параметр
  console.log("API: Request received for /api/sheet-data");

  // **КРОК 1: Перевірка Авторизації**
  if (!checkAuth(req)) {
      // Якщо перевірка не пройдена, повертаємо помилку 401
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  console.log("API: Auth check passed.");

  // **КРОК 2: Отримання даних (якщо авторизація пройдена)**
  try {
    const credentialsJson = process.env.GOOGLE_SHEETS_CREDENTIALS;
    const spreadsheetId = process.env.GOOGLE_SHEET_ID;

    if (!credentialsJson || !spreadsheetId) { throw new Error("Server configuration error."); }
    let credentials;
    try { credentials = JSON.parse(credentialsJson); }
    catch (e) { throw new Error("Server configuration error: Invalid credentials format."); }

    const auth = new google.auth.GoogleAuth({ /* ... */ });
    const sheets = google.sheets({ version: 'v4', auth });
    const ranges = [ 'Transactions!A2:F', 'Accounts!A2:A', 'Categories!A2:B' ];

    const response = await sheets.spreadsheets.values.batchGet({ /* ... */ });

    if (!response.data.valueRanges) { return NextResponse.json({ transactions: [], accounts: [], categories: [] }); }

    // Обробка даних (як і раніше)
    const rawTransactions = response.data.valueRanges[0]?.values || [];
    const transactions = rawTransactions.map(/* ... */).filter(/* ... */);
    const rawAccounts = response.data.valueRanges[1]?.values || [];
    const accounts = rawAccounts.flat().filter(Boolean);
    const rawCategories = response.data.valueRanges[2]?.values || [];
    const categories = rawCategories.map(/* ... */).filter(/* ... */);

    console.log("API: Successfully fetched and processed data. Returning to client.");
    return NextResponse.json({ transactions, accounts, categories });

  } catch (error) {
    console.error('API: Error fetching sheet data:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown server error occurred';
    return NextResponse.json({ error: `Failed to fetch data: ${errorMessage}` }, { status: 500 });
  }
}

// Цей файл більше не експортує 'dynamic', кешування контролюється Vercel/Next.js
// export const dynamic = 'force-dynamic';
