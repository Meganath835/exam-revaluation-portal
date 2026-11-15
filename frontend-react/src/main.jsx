import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MotionConfig } from 'motion/react';
import App from './App';
import { AuthProvider } from './auth/AuthContext';
import { ToastProvider } from './components/Toast';
import { TooltipProvider } from './components/ui/tooltip';
import { ThemeProvider } from './components/theme';
import './index.css';

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: true, staleTime: 1000 } },
});

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthProvider>
          {/* Magic UI animations follow the operating system's "reduce motion" setting. */}
          <ThemeProvider>
            <MotionConfig reducedMotion="user">
              <TooltipProvider delayDuration={200}>
                <ToastProvider>
                  <App />
                </ToastProvider>
              </TooltipProvider>
            </MotionConfig>
          </ThemeProvider>
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  </React.StrictMode>,
);
