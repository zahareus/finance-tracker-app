import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css' // Імпортуємо глобальні стилі

const inter = Inter({ subsets: ['latin'] }) // Можна замінити шрифт пізніше

export const metadata: Metadata = {
  title: 'Finance Tracker', // Назва вкладки браузера
  description: 'Minimalist finance tracking',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="uk"> {/* Встановлюємо українську мову */}
      <body className={inter.className}>{children}</body>
    </html>
  )
}
