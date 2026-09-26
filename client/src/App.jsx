import React, { Suspense, lazy } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import DashboardLayout from './layouts/DashboardLayout';
import ErrorBoundary from './components/ErrorBoundary';
import LoadingSpinner from './components/LoadingSpinner';

// Route-level code splitting with React.lazy
const DashboardPage = lazy(() => import('./pages/DashboardPage'));
const DataSourcesPage = lazy(() => import('./pages/DataSourcesPage'));
const DatasetsPage = lazy(() => import('./pages/DatasetsPage'));
const KpisPage = lazy(() => import('./pages/KpisPage'));
const ReportsPage = lazy(() => import('./pages/ReportsPage'));
const AlertsPage = lazy(() => import('./pages/AlertsPage'));
const ForecastsPage = lazy(() => import('./pages/ForecastsPage'));
const AIAnalyticsAssistant = lazy(() => import('./pages/AIAnalyticsAssistant'));
const AIInsightsPage = lazy(() => import('./pages/AIInsightsPage'));
const DataModelingPage = lazy(() => import('./pages/DataModelingPage'));
const DataQualityPage = lazy(() => import('./pages/DataQualityPage'));
const CollaborationPage = lazy(() => import('./pages/CollaborationPage'));
const GovernancePage = lazy(() => import('./pages/GovernancePage'));
const LoginPage = lazy(() => import('./pages/LoginPage'));
const RegisterPage = lazy(() => import('./pages/RegisterPage'));

/**
 * Main Application Routing Component with Authentication Guards & Error Boundary
 */
export default function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <Router future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
          <Suspense fallback={<LoadingSpinner size="lg" text="Loading RicozAnalytics..." className="min-h-screen" />}>
            <Routes>
              {/* Public Authentication Routes */}
              <Route path="/login" element={<LoginPage />} />
              <Route path="/register" element={<RegisterPage />} />

              {/* Protected Application Routes */}
              <Route element={<ProtectedRoute />}>
                <Route element={<DashboardLayout />}>
                  <Route path="/" element={<Navigate to="/dashboard" replace />} />
                  <Route path="/dashboard" element={<DashboardPage />} />
                  <Route path="/data-sources" element={<DataSourcesPage />} />
                  <Route path="/datasets" element={<DatasetsPage />} />
                  <Route path="/relationships" element={<DataModelingPage />} />
                  <Route path="/data-model" element={<DataModelingPage />} />
                  <Route path="/data-quality" element={<DataQualityPage />} />
                  <Route path="/kpis" element={<KpisPage />} />
                  <Route path="/reports" element={<ReportsPage />} />
                  <Route path="/forecasts" element={<ForecastsPage />} />
                  <Route path="/alerts" element={<AlertsPage />} />
                  <Route path="/ai-insights" element={<AIInsightsPage />} />
                  <Route path="/ai-assistant" element={<AIAnalyticsAssistant />} />
                  <Route path="/ai" element={<AIInsightsPage />} />
                  <Route path="/collaboration" element={<CollaborationPage />} />
                  <Route path="/favorites" element={<CollaborationPage />} />
                  <Route path="/settings" element={<GovernancePage />} />
                  <Route path="/governance" element={<GovernancePage />} />
                </Route>
              </Route>

              {/* Catch-all fallback */}
              <Route path="*" element={<Navigate to="/dashboard" replace />} />
            </Routes>
          </Suspense>
        </Router>
      </AuthProvider>
    </ErrorBoundary>
  );
}
