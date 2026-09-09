// Спільні правила моделі обліку (09–10.09.2026): три напрямки руху грошей, перекази парами, база 11%.
export const TRANSFER_LEGACY = 'Переказ';          // старе значення типу — приймається до кінця міграції
export const TRANSFER_IN = 'Переказ вхідний';
export const TRANSFER_OUT = 'Переказ вихідний';
export const OUT_CAT = 'Переказ вихідний';
export const VIA_CAT = 'Гранти через посередника';
export const OPENING_CAT = 'Початковий баланс';
export const TECH_CAT = 'Технічна транзакція';
export const FOP_FEE_CAT = 'Обслуговування ФОП';
export const FOP_ACCOUNTS = ['СБ', 'СЧ', 'ВЗ', 'СЛ', 'КМ'];
export const TAX_RATE = 0.11;
export const VALID_TYPES = ['Надходження', 'Витрата', TRANSFER_LEGACY, TRANSFER_IN, TRANSFER_OUT];
export const RUNWAY_EXCLUDED_DEFAULT = [TECH_CAT];

export interface TxLike {
  id?: string | null;
  type: string;
  account: string;
  category: string;
  amount: number;
  link?: string | null;
  noTax?: boolean;
}

export const isFop = (account: string) => FOP_ACCOUNTS.includes(account);
export const isTransfer = (tx: TxLike) => tx.type === TRANSFER_LEGACY || tx.type === TRANSFER_IN || tx.type === TRANSFER_OUT;
// Напрямок: категорія має пріоритет (на час міграції, поки тип може бути старим «Переказ»), тип — фолбек.
export const isOutgoing = (tx: TxLike) => isTransfer(tx) && (tx.category === OUT_CAT || (tx.category !== TRANSFER_IN && tx.category !== VIA_CAT && tx.type === TRANSFER_OUT));
export const isIncoming = (tx: TxLike) => isTransfer(tx) && !isOutgoing(tx);

// Знак для балансу рахунку
export const signedAmount = (tx: TxLike): number => {
  if (tx.type === 'Надходження') return tx.amount;
  if (tx.type === 'Витрата') return -tx.amount;
  if (isTransfer(tx)) return isOutgoing(tx) ? -tx.amount : tx.amount;
  return 0;
};

// База 11% на ФОП: усе, що зайшло на ФОП-рахунок без галочки «Без 11%», крім «через посередника» і початкового балансу
export const isTaxBase = (tx: TxLike): boolean => {
  if (!isFop(tx.account) || tx.noTax) return false;
  if (tx.category === VIA_CAT || tx.category === OPENING_CAT) return false;
  return tx.type === 'Надходження' || isIncoming(tx);
};

// Оцінка пари: різниця 0 (між своїми) або ≈11% (посередник) з допуском 2% від суми — ✓, інакше ⚠
export type PairStatus = 'ok' | 'warn';
export const pairStatus = (outAmount: number, inSum: number): PairStatus => {
  const diff = outAmount - inSum;
  if (Math.abs(diff) < 0.01) return 'ok';
  if (diff < 0 || diff > outAmount * 0.2) return 'warn';
  return Math.abs(diff - outAmount * TAX_RATE) <= outAmount * 0.02 ? 'ok' : 'warn';
};

// Один парсер дат на всі сторінки: YYYY-MM-DD або DD.MM.YYYY, з перевіркою діапазону
export const parseDate = (dateString: string | null | undefined): Date | null => {
  if (!dateString || typeof dateString !== 'string') return null;
  const s = dateString.trim();
  let y: number, m: number, d: number;
  let p = s.split('-');
  if (p.length === 3) { y = +p[0]; m = +p[1]; d = +p[2]; }
  else { p = s.split('.'); if (p.length !== 3) return null; y = +p[2]; m = +p[1]; d = +p[0]; }
  if (!Number.isInteger(y) || !Number.isInteger(m) || !Number.isInteger(d) || m < 1 || m > 12 || d < 1 || d > 31 || y < 2000 || y > 2100) return null;
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.getUTCMonth() === m - 1 && date.getUTCDate() === d ? date : null;
};
export const monthKey = (dateString: string | null | undefined): string | null => {
  const dt = parseDate(dateString); if (!dt) return null;
  return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, '0')}`;
};
