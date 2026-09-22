import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import DashboardLayout from './layouts/DashboardLayout';
import DashboardPage from './pages/DashboardPage';
import DataSourcesPage from './pages/DataSourcesPage';
import DatasetsPage from './pages/DatasetsPage';
import PlaceholderPage from './pages/PlaceholderPage';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';

/**
 * Main Application Routing Component with Authentication Guards
 */
export default function App() {
  return (
    <AuthProvider>
      <Router>
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

              <Route
                path="/kpis"
                element={
                  <PlaceholderPage
                    title="Key Performance Indicators (KPIs)"
                    phase="Phase 7"
                    description="Define, customize, and monitor key business metrics with dynamic formulas and threshold targets."
                    plannedFeatures={[
                      'Formula builder for custom business metrics',
                      'Target vs actual tracking with progress bars',
                      'Percentage change calculations across custom timeframes',
                      'Status classification (On Track, At Risk, Behind)'
                    ]}
                  />
                }
              />

              <Route
                path="/reports"
                element={
                  <PlaceholderPage
                    title="Automated Reports"
                    phase="Phase 9"
                    description="Build, schedule, and export comprehensive enterprise analytics reports."
                    plannedFeatures={[
                      'Drag-and-drop report builder with charts and KPIs',
                      'One-click PDF and CSV export generation',
                      'Automated recurring email reports for stakeholders',
                      'Report versioning and archival history'
                    ]}
                  />
                }
              />

              <Route
                path="/forecasts"
                element={
                  <PlaceholderPage
                    title="Predictive Forecasting"
                    phase="Phase 11"
                    description="Generate time-series predictions and trend models powered by statistical analysis and Python ML."
                    plannedFeatures={[
                      'Revenue and sales trajectory forecasting',
                      'Confidence intervals and upper/lower variance bounds',
                      'Python FastAPI ML microservice integration',
                      'Historical trend vs predicted divergence analysis'
                    ]}
                  />
                }
              />

              <Route
                path="/alerts"
                element={
                  <PlaceholderPage
                    title="Real-time Alerts Engine"
                    phase="Phase 10"
                    description="Configure automated condition-based alerts and operational incident notifications."
                    plannedFeatures={[
                      'Rule-based triggers (e.g., Revenue < ₹10L, Churn > 5%)',
                      'Real-time in-app and email notification dispatch',
                      'Severity tagging and incident resolution tracking',
                      'Alert history and false-positive filtering'
                    ]}
                  />
                }
              />

              <Route
                path="/ai-insights"
                element={
                  <PlaceholderPage
                    title="AI Analytics Assistant"
                    phase="Phase 12"
                    description="Query your data in plain English and receive instant root-cause diagnostics powered by Gemini AI."
                    plannedFeatures={[
                      'Conversational data querying ("Why did sales drop in Mumbai?")',
                      'Automated root cause diagnostics and anomaly explanation',
                      'Backend data preprocessing for secure, privacy-safe prompts',
                      'Executive summaries and actionable next-step suggestions'
                    ]}
                  />
                }
              />

              <Route
                path="/settings"
                element={
                  <PlaceholderPage
                    title="Platform Settings & Governance"
                    phase="Phase 13"
                    description="Configure team permissions, authentication policies, audit trails, and workspace settings."
                    plannedFeatures={[
                      'Role-based access control (Admin, Analyst, Manager, Viewer)',
                      'Comprehensive user audit logs and activity tracking',
                      'API token generation and webhook endpoints',
                      'Custom branding and notification preferences'
                    ]}
                  />
                }
              />
            </Route>
          </Route>

          {/* Catch-all fallback */}
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </Router>
    </AuthProvider>
  );
}
