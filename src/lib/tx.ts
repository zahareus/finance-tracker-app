// Спільні правила моделі обліку (вирішено 09.09.2026): три типи, перекази, база 11%.
export const TRANSFER = 'Переказ';
export const OUT_CAT = 'Переказ вихідний';
export const VIA_CAT = 'Гранти через посередника';
export const OPENING_CAT = 'Початковий баланс';
export const FOP_FEE_CAT = 'Обслуговування ФОП';
export const FOP_ACCOUNTS = ['СБ', 'СЧ', 'ВЗ', 'СЛ', 'КМ'];
export const TAX_RATE = 0.11;

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
export const isTransfer = (tx: TxLike) => tx.type === TRANSFER;
export const isOutgoing = (tx: TxLike) => tx.type === TRANSFER && tx.category === OUT_CAT;

// Знак для балансу рахунку. Надходження +, Витрата −, Переказ — за категорією.
export const signedAmount = (tx: TxLike): number => {
  if (tx.type === 'Надходження') return tx.amount;
  if (tx.type === 'Витрата') return -tx.amount;
  if (tx.type === TRANSFER) return tx.category === OUT_CAT ? -tx.amount : tx.amount;
  return 0;
};

// Рядок входить у базу 11% на ФОП: усе, що зайшло на ФОП-рахунок без галочки «Без 11%»,
// крім «Гранти через посередника» (уже без 11%) і початкового балансу.
export const isTaxBase = (tx: TxLike): boolean => {
  if (!isFop(tx.account) || tx.noTax) return false;
  if (tx.category === VIA_CAT || tx.category === OPENING_CAT) return false;
  if (tx.type === 'Надходження') return true;
  return tx.type === TRANSFER && tx.category !== OUT_CAT;
};

// Оцінка пари: різниця 0 (між своїми) або ≈11% (посередник) — ✓, інакше ⚠
export type PairStatus = 'ok' | 'warn';
export const pairStatus = (outAmount: number, inSum: number): PairStatus => {
  const diff = outAmount - inSum;
  if (diff === 0) return 'ok';
  if (diff < 0 || diff > outAmount * 0.2) return 'warn';
  return Math.abs(diff - Math.round(outAmount * TAX_RATE)) <= 50 ? 'ok' : 'warn';
};
