import { useCallback, useState } from 'react';

// Спільний хелпер для «Скопіювати (N)»: TSV-текст, як у таблиці, щоб вставлялось у Sheets/Excel/месенджер
export async function copyRowsToClipboard(header: string[], rows: (string | number)[][]): Promise<{ ok: boolean }> {
  const headerLine = header.join('\t');
  const lines = rows.map(row => row.map(v => String(v ?? '').replace(/\t/g, ' ')).join('\t'));
  try {
    await navigator.clipboard.writeText([headerLine, ...lines].join('\n'));
    return { ok: true };
  } catch {
    return { ok: false };
  }
}

// «Скопійовано N рядків/рядок/рядки» — та сама плюралізація, що була в /
export const copyCountLabel = (n: number) => `${n} ${n === 1 ? 'рядок' : n < 5 ? 'рядки' : 'рядків'}`;

// Тост «Скопійовано N рядків» на 2,5 с — той самий, що був продубльований на кожній сторінці
export function useCopyToast() {
  const [toast, setToast] = useState<string | null>(null);
  const showToast = useCallback((n: number) => {
    setToast(`Скопійовано ${copyCountLabel(n)}`);
    setTimeout(() => setToast(null), 2500);
  }, []);
  const showError = useCallback(() => {
    setToast('Не вдалося скопіювати — дозволь доступ до буфера');
    setTimeout(() => setToast(null), 2500);
  }, []);
  return { toast, showToast, showError };
}
