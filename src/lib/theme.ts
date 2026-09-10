// design-md: fintracker Журнал v1 — єдине джерело кольорів для Recharts і inline-стилів.
// Дублює semantic-шар tailwind.config.ts (Recharts не читає Tailwind-класи).
export const T = {
  ink: '#1B1B1F', ink2: '#66666E', ink3: '#9A9AA2', line: '#E6E6E0', mute: '#F3F3EE', panel: '#FFFFFF', paper: '#FAFAF6',
  income: '#1E8E5A', incomeSoft: '#E3F4EA',
  tin: '#2B6CB0', tinSoft: '#E3ECF7',
  expense: '#B7791F', expenseSoft: '#FBF1DC',
  tout: '#C53030', toutSoft: '#F9E3E3',
  danger: '#B91C1C',
} as const;

// Лінії категорій на /earn і сектори пирогів: зелений/синій/жовтий — ті самі, що й типи, далі нейтральні відтінки.
export const CHART_SERIES = ['#1E8E5A', '#2B6CB0', '#B7791F', '#7A4FBF', '#3A8F8A', '#C53030', '#8E8E96', '#D08C2B', '#5B6ABF', '#A0A0A8'];

export const chartTooltipStyle = { border: `1px solid ${T.line}`, borderRadius: 10, boxShadow: 'none', background: T.panel, fontSize: 13 };
