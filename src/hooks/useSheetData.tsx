'use client';

import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';

/**
 * Один fetch /api/sheet-data на весь застосунок. Layout і сторінки беруть сирий JSON звідси
 * замість власних запитів; чистка даних лишається на сторінках, як і була.
 * При refresh старі дані не обнуляються — таблиці не блимають порожнім.
 */
interface SheetDataContextValue {
  data: any | null;
  isLoading: boolean;
  error: string | null;
  refresh: () => void;
}

const SheetDataContext = createContext<SheetDataContextValue>({ data: null, isLoading: true, error: null, refresh: () => {} });

export function SheetDataProvider({ children }: { children: React.ReactNode }) {
  const [data, setData] = useState<any | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const refresh = useCallback(async () => {
    abortRef.current?.abort(); // попередній запит ще летить — скасовуємо, щоб не виграла стара відповідь
    const controller = new AbortController();
    abortRef.current = controller;
    setIsLoading(true); setError(null);
    try {
      const response = await fetch('/api/sheet-data', { signal: controller.signal, cache: 'no-store' });
      if (!response.ok) { throw new Error(`HTTP error! status: ${response.status}`); }
      const json = await response.json();
      if (!Array.isArray(json.transactions) || !Array.isArray(json.accounts) || !Array.isArray(json.categories) || !Array.isArray(json.counterparties) || !Array.isArray(json.projects)) { throw new Error("Invalid data structure."); }
      setData(json);
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return;
      setError(err instanceof Error ? err.message : 'An unknown error occurred.');
      console.error("Failed to fetch sheet data:", err);
    } finally {
      if (abortRef.current === controller) setIsLoading(false);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  return (
    <SheetDataContext.Provider value={{ data, isLoading, error, refresh }}>
      {children}
    </SheetDataContext.Provider>
  );
}

export const useSheetData = () => useContext(SheetDataContext);
