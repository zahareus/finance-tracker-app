import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    // Оновлено шляхи для App Router у папці src
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}', 
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}', 
  ],
  theme: {
    extend: {
      // Тут можна буде додати кастомні кольори, шрифти тощо
    },
  },
  plugins: [],
}
export default config
