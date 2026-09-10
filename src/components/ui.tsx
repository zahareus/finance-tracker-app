'use client';

import React, { useState } from 'react';
import { isIncoming, isOutgoing } from '@/lib/tx';

export const ChevronDown = ({ className = '' }: { className?: string }) => (
  <svg className={className} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M6 9l6 6 6-6" />
  </svg>
);

export const SortArrow = ({ direction }: { direction: 'asc' | 'desc' }) => (
  <svg className={`inline ml-1 ${direction === 'asc' ? 'rotate-180' : ''}`} width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
    <path d="M12 5v14M6 13l6 6 6-6" />
  </svg>
);

export const TextAction = ({
  children,
  onClick,
  disabled = false,
  className = '',
}: {
  children: React.ReactNode;
  onClick?: React.MouseEventHandler<HTMLButtonElement>;
  disabled?: boolean;
  className?: string;
}) => (
  <button
    type="button"
    onClick={onClick}
    disabled={disabled}
    className={`text-[13px] underline underline-offset-[3px] ${disabled ? 'text-ink-3 no-underline cursor-not-allowed' : 'text-ink-2 hover:text-ink'} ${className}`}
  >
    {children}
  </button>
);

export const Button = ({
  children,
  onClick,
  disabled = false,
  variant = 'secondary',
  title,
}: {
  children: React.ReactNode;
  onClick?: React.MouseEventHandler<HTMLButtonElement>;
  disabled?: boolean;
  variant?: 'primary' | 'secondary';
  title?: string;
}) => (
  <button
    type="button"
    onClick={onClick}
    disabled={disabled}
    title={title}
    className={`inline-flex items-center px-3.5 py-[7px] rounded-full text-[13px] font-medium disabled:opacity-40 disabled:cursor-not-allowed ${
      variant === 'primary' ? 'bg-ink text-white hover:opacity-90' : 'border border-ink text-ink bg-panel hover:bg-mute'
    }`}
  >
    {children}
  </button>
);

export const ChipSummary = ({
  label,
  value,
  onClick,
  className = '',
}: {
  label?: string;
  value: React.ReactNode;
  onClick?: React.MouseEventHandler<HTMLButtonElement>;
  className?: string;
}) => (
  <button
    type="button"
    onClick={onClick}
    className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-full border border-line bg-panel text-[13px] hover:border-ink-3 ${className}`}
  >
    {label && <span className="text-ink-2">{label}</span>}
    <span className="font-medium tabular-nums">{value}</span>
    <ChevronDown />
  </button>
);

export const SectionCard = ({
  title,
  aside,
  children,
  className = '',
}: {
  title?: React.ReactNode;
  aside?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) => (
  <section className={`bg-panel border border-line rounded-card px-5 py-[18px] ${className}`}>
    {(title || aside) && (
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2 mb-2.5">
        {title && <span className="font-display text-sm sm:text-[15px] font-semibold">{title}</span>}
        {aside}
      </div>
    )}
    {children}
  </section>
);

export const StatTile = ({
  label,
  value,
  tone = 'neutral',
  suffix,
  calculation,
}: {
  label: React.ReactNode;
  value: React.ReactNode;
  tone?: 'income' | 'expense' | 'tout' | 'neutral' | 'mute';
  suffix?: React.ReactNode;
  calculation?: string;
}) => {
  const tileClass =
    tone === 'income' ? 'bg-income-soft'
    : tone === 'expense' ? 'bg-expense-soft'
    : tone === 'tout' ? 'bg-tout-soft'
    : tone === 'mute' ? 'bg-mute'
    : 'bg-panel border border-line';
  const valueClass =
    tone === 'income' ? 'text-income'
    : tone === 'expense' ? 'text-expense'
    : tone === 'tout' ? 'text-tout'
    : 'text-ink';

  const content = calculation ? (
    <TooltipWithCalculation calculation={calculation}><span>{label}</span></TooltipWithCalculation>
  ) : label;

  return (
    <div className={`rounded-card px-[18px] py-3.5 min-w-0 ${tileClass}`}>
      <div className="text-xs text-ink-2 min-h-[18px]">{content}</div>
      <div className={`text-[20px] sm:text-[22px] font-semibold tabular-nums whitespace-nowrap ${valueClass}`}>{value}{suffix}</div>
    </div>
  );
};

export const TooltipWithCalculation: React.FC<{
  children: React.ReactNode;
  calculation: string;
}> = ({ children, calculation }) => {
  const [isVisible, setIsVisible] = useState(false);

  return (
    <span className="relative inline-flex items-center gap-1">
      {children}
      <button
        type="button"
        className="text-ink-2 hover:text-ink cursor-help text-xs font-bold"
        onMouseEnter={() => setIsVisible(true)}
        onMouseLeave={() => setIsVisible(false)}
        onClick={() => setIsVisible(!isVisible)}
        aria-label="Показати розрахунок"
      >
        (+)
      </button>
      {isVisible && (
        <span className="absolute z-50 bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-ink text-white text-xs rounded-field whitespace-pre-line min-w-[200px] max-w-[300px] text-left">
          {calculation}
        </span>
      )}
    </span>
  );
};

export const TypeChip = ({ tx }: { tx: { type: string; account: string; category: string; amount: number; link?: string | null } }) => {
  const label = isOutgoing(tx) ? 'Переказ вихідний' : isIncoming(tx) ? 'Переказ вхідний' : tx.type;
  const classes = isOutgoing(tx)
    ? 'bg-tout-soft text-tout'
    : isIncoming(tx)
      ? 'bg-tin-soft text-tin'
      : tx.type === 'Витрата'
        ? 'bg-expense-soft text-expense'
        : 'bg-income-soft text-income';

  return <span className={`inline-block px-[9px] py-[3px] rounded-full text-[11.5px] font-medium whitespace-nowrap ${classes}`}>{label}</span>;
};

export const Checkbox = ({ checked, onChange, label }: { checked: boolean; onChange: () => void; label: string }) => (
  <input type="checkbox" aria-label={label} checked={checked} onChange={onChange} className="h-4 w-4 rounded-[5px] border-[1.5px] border-line bg-panel accent-ink" />
);
