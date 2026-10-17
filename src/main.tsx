import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { ThemeProvider } from 'next-themes'
import './index.css'
import App from './App.tsx'
import { enableGlobalPersianDigits } from './lib/persian-numbers.ts'

const rootElement = document.getElementById('root')!
enableGlobalPersianDigits(rootElement)

createRoot(rootElement).render(
  <BrowserRouter>
    <ThemeProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      storageKey="karnex-theme"
      themes={['light', 'dark']}
      disableTransitionOnChange
    >
      <App />
    </ThemeProvider>
  </BrowserRouter>,
)
