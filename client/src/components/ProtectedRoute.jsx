import React from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import LoadingSpinner from './LoadingSpinner';

/**
 * Route guard for authenticated pages
 * Enforces:
 * 1. Authentication check
 * 2. Email verification status
 * 3. 14-day trial & subscription lifecycle access
 */
export default function ProtectedRoute() {
  const { isAuthenticated, isLoading, user, isTrialExpired } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <LoadingSpinner size="lg" text="Checking session..." />
      </div>
    );
  }

  if (!isAuthenticated) {
    // Redirect unauthenticated user to login, preserving intended path
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // If user registered but has not verified email, redirect to verify-email
  if (user?.status === 'pending_verification') {
    return <Navigate to="/auth/verify-email" state={{ email: user.email }} replace />;
  }

  // Note: Expired subscriptions are permitted in read-only preserved mode across the app.
  // Ingestion and write actions are strictly gated via HTTP 402 and modal banners.

  return <Outlet />;
}
