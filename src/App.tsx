import { BrowserRouter } from 'react-router'
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClient } from '@/lib/queryClient'
import { ThemeProvider } from '@/context/ThemeContext'
import { AuthProvider } from '@/context/AuthContext'
import { GalpaoProvider } from '@/context/GalpaoContext'
import { GalpaoDadosProvider } from '@/context/GalpaoDadosContext'
import { ToastProvider } from '@/components/ui/Toast'
import { AppRouter } from '@/routes'

export default function App() {
  return (
    <ThemeProvider>
      <ToastProvider>
        <QueryClientProvider client={queryClient}>
          <AuthProvider>
            <GalpaoProvider>
              <GalpaoDadosProvider>
                <BrowserRouter>
                  <AppRouter />
                </BrowserRouter>
              </GalpaoDadosProvider>
            </GalpaoProvider>
          </AuthProvider>
        </QueryClientProvider>
      </ToastProvider>
    </ThemeProvider>
  )
}
