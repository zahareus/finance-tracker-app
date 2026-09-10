import type { Config } from 'tailwindcss'

// design-md: fintracker «Журнал» v1 — токени тут, компоненти беруть ЛИШЕ ці імена (див. DESIGN.md)
const config: Config = {
  content: [
    // Оновлено шляхи для App Router у папці src
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        paper: '#FAFAF6',          // фон сторінки
        panel: '#FFFFFF',          // картки/панелі
        ink: { DEFAULT: '#1B1B1F', 2: '#66666E', 3: '#9A9AA2' }, // текст: основний / вторинний / muted
        line: '#E6E6E0',           // бордери, дільники
        mute: '#F3F3EE',           // виділений рядок, idle-чип року
        // 4 типи транзакцій: зелений/синій = плюс, жовтий/червоний = мінус
        income:  { DEFAULT: '#1E8E5A', soft: '#E3F4EA' },  // Надходження
        tin:     { DEFAULT: '#2B6CB0', soft: '#E3ECF7' },  // Переказ ВХІД
        expense: { DEFAULT: '#B7791F', soft: '#FBF1DC' },  // Витрата
        tout:    { DEFAULT: '#C53030', soft: '#F9E3E3' },  // ВИХІД Переказ
        danger:  '#B91C1C',        // помилки застосунку (не витрати)
      },
      fontFamily: {
        sans: ['var(--font-golos)', 'system-ui', 'sans-serif'],
        display: ['var(--font-unbounded)', 'system-ui', 'sans-serif'],
      },
      borderRadius: { card: '14px', field: '10px' },
    },
  },
  plugins: [],
}
export default config
