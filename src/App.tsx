import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AppProvider, useApp } from './context/AppContext';
import { ThemeProvider } from './context/ThemeContext';
import { I18nProvider } from './context/I18nContext';
import { AppLayout } from './components/layout/AppLayout';
import { WelcomePage } from './pages/WelcomePage';
import { LoginPage } from './pages/LoginPage';
import { RegisterPage } from './pages/RegisterPage';
import { DashboardPage } from './pages/DashboardPage';
import { FamilyManagementPage } from './pages/FamilyManagementPage';
import { RequestMoneyPage } from './pages/RequestMoneyPage';
import { ScanPayPage } from './pages/ScanPayPage';
import { SpendingLimitsPage } from './pages/SpendingLimitsPage';
import { TransactionHistoryPage } from './pages/TransactionHistoryPage';
import { AIAssistantPage } from './pages/AIAssistantPage';
import { SettingsPage } from './pages/SettingsPage';

// Route guard component: enforces Administrator-only access for family management
const OwnerRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { currentUser } = useApp();
  if (currentUser.role !== 'owner') {
    return <Navigate to="/dashboard" replace />;
  }
  return <>{children}</>;
};

export const App: React.FC = () => {
  return (
    <ThemeProvider>
      <I18nProvider>
        <AppProvider>
          <BrowserRouter>
            <Routes>
              {/* Public / Auth routes */}
              <Route path="/" element={<WelcomePage />} />
              <Route path="/login" element={<LoginPage />} />
              <Route path="/register" element={<RegisterPage />} />

              {/* Authenticated / Demo Portal Layout */}
              <Route element={<AppLayout />}>
                <Route path="/dashboard" element={<DashboardPage />} />
                <Route
                  path="/family"
                  element={
                    <OwnerRoute>
                      <FamilyManagementPage />
                    </OwnerRoute>
                  }
                />
                <Route path="/request-money" element={<RequestMoneyPage />} />
                <Route path="/scan-pay" element={<ScanPayPage />} />
                <Route path="/spending-limits" element={<SpendingLimitsPage />} />
                <Route path="/transactions" element={<TransactionHistoryPage />} />
                <Route path="/ai-assistant" element={<AIAssistantPage />} />
                <Route path="/settings" element={<SettingsPage />} />
                <Route path="/app" element={<Navigate to="/dashboard" replace />} />
              </Route>

              {/* Catch-all */}
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </BrowserRouter>
        </AppProvider>
      </I18nProvider>
    </ThemeProvider>
  );
};

export default App;

