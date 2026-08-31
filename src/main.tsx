import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App.tsx'
import { AuthProvider } from './context/AuthContext'
import { CropProvider } from './context/CropContext'
import { CurrencyProvider } from './context/CurrencyContext'
import { MessagingProvider } from './context/MessagingContext'
import { OrdersProvider } from './context/OrdersContext'
import { WatchlistProvider } from './context/WatchlistContext'
import './index.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <CurrencyProvider>
          <CropProvider>
            <WatchlistProvider>
              <MessagingProvider>
                <OrdersProvider>
                  <App />
                </OrdersProvider>
              </MessagingProvider>
            </WatchlistProvider>
          </CropProvider>
        </CurrencyProvider>
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
)
