import React, { useEffect, useState, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Capacitor } from '@capacitor/core';
import { App } from '@capacitor/app';
import { Network } from '@capacitor/network';
import { SplashScreen } from '@capacitor/splash-screen';
import { StatusBar, Style } from '@capacitor/status-bar';

/**
 * NativeMobileBridge handles Android native device integration:
 * 1. Hardware Back Button handling (modal dismissal, routing back, debounced double-tap to exit).
 * 2. Network connectivity monitoring and offline/online toast alerts.
 * 3. Native file download notifications.
 * 4. Status Bar and Splash Screen lifecycle management.
 */
export default function NativeMobileBridge() {
  const location = useLocation();
  const navigate = useNavigate();
  const lastBackPressRef = useRef(0);
  const [toastMessage, setToastMessage] = useState(null);
  const [isOffline, setIsOffline] = useState(false);
  const [justReconnected, setJustReconnected] = useState(false);
  const toastTimeoutRef = useRef(null);

  // Helper to show transient in-app toast
  const showToast = (message, duration = 2500) => {
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    setToastMessage(message);
    toastTimeoutRef.current = setTimeout(() => {
      setToastMessage(null);
    }, duration);
  };

  // 1. Initialize Splash Screen and Status Bar
  useEffect(() => {
    if (Capacitor.isNativePlatform()) {
      // Hide Splash screen once React tree has mounted
      SplashScreen.hide().catch(() => {});

      // Configure native status bar
      StatusBar.setBackgroundColor({ color: '#0F172A' }).catch(() => {});
      StatusBar.setStyle({ style: Style.Dark }).catch(() => {});
    }
  }, []);

  // 2. Hardware Back Button Handling
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    let backHandler = null;

    const setupBackButton = async () => {
      backHandler = await App.addListener('backButton', ({ canGoBack }) => {
        // Step A: Check if any open modals, dropdowns or drawers exist
        const modalElement = document.querySelector('[role="dialog"], [data-modal-open="true"], .fixed.inset-0.z-50');
        if (modalElement) {
          // Attempt to find and click a close button within the modal
          const closeBtn = modalElement.querySelector('button[aria-label*="close" i], button.btn-close, [data-testid="modal-close"]');
          if (closeBtn) {
            closeBtn.click();
            return;
          }
          // Otherwise emit an Escape key event
          document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape', keyCode: 27, bubbles: true }));
          return;
        }

        // Step B: Determine current route
        const currentPath = window.location.pathname;
        const rootPaths = ['/dashboard', '/login', '/auth/login', '/'];
        const isRootPage = rootPaths.includes(currentPath);

        if (!isRootPage && canGoBack) {
          // Navigate to previous screen in history
          navigate(-1);
          return;
        }

        // Step C: On root screen, require double tap within 2 seconds to exit
        const now = Date.now();
        if (now - lastBackPressRef.current < 2000) {
          App.exitApp();
        } else {
          lastBackPressRef.current = now;
          showToast('Press back again to exit RicozAnalytics', 2000);
        }
      });
    };

    setupBackButton();

    return () => {
      if (backHandler && backHandler.remove) {
        backHandler.remove();
      }
    };
  }, [navigate, location]);

  // 3. Network Connectivity Monitoring
  useEffect(() => {
    let networkHandler = null;

    const checkInitialNetwork = async () => {
      try {
        const status = await Network.getStatus();
        setIsOffline(!status.connected);
      } catch (e) {
        // Fallback to navigator.onLine if plugin fails
        setIsOffline(!navigator.onLine);
      }
    };

    checkInitialNetwork();

    const setupNetworkListener = async () => {
      try {
        networkHandler = await Network.addListener('networkStatusChange', status => {
          if (!status.connected) {
            setIsOffline(true);
            setJustReconnected(false);
          } else {
            setIsOffline(false);
            setJustReconnected(true);
            setTimeout(() => setJustReconnected(false), 3500);
          }
        });
      } catch {
        // Fallback web event listeners
        const handleOnline = () => {
          setIsOffline(false);
          setJustReconnected(true);
          setTimeout(() => setJustReconnected(false), 3500);
        };
        const handleOffline = () => {
          setIsOffline(true);
          setJustReconnected(false);
        };
        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);
      }
    };

    setupNetworkListener();

    return () => {
      if (networkHandler && networkHandler.remove) {
        networkHandler.remove();
      }
    };
  }, []);

  // 4. Listen for Native File Download Events
  useEffect(() => {
    const handleFileDownloaded = (event) => {
      const { filename, status, error } = event.detail || {};
      if (status === 'success') {
        showToast(`Saved ${filename} to Documents`, 3500);
      } else if (status === 'error') {
        showToast(`Download failed: ${error || 'Unknown error'}`, 3500);
      }
    };

    window.addEventListener('native-file-downloaded', handleFileDownloaded);
    return () => {
      window.removeEventListener('native-file-downloaded', handleFileDownloaded);
    };
  }, []);

  return (
    <>
      {/* Offline Alert Banner */}
      {isOffline && (
        <aside 
          aria-label="Offline status notification"
          className="fixed top-0 left-0 right-0 z-50 bg-rose-600 text-white text-xs sm:text-sm font-medium px-4 py-2 flex items-center justify-between shadow-lg"
        >
          <div className="flex items-center space-x-2">
            <svg className="w-4 h-4 animate-pulse flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 5.636a9 9 0 010 12.728m0 0l-2.829-2.829m2.829 2.829L21 21M15.536 8.464a5 5 0 010 7.072m0 0l-2.829-2.829m-4.243 4.243a9 9 0 01-2.829-2.829m0 0l2.829-2.829m-2.829 2.829L3 21m0 0l18-18" />
            </svg>
            <span>You are currently offline. Live analytics sync is paused.</span>
          </div>
          <span className="text-[10px] uppercase font-bold tracking-wider bg-rose-700/60 px-2 py-0.5 rounded">Offline</span>
        </aside>
      )}

      {/* Online Reconnected Alert Banner */}
      {justReconnected && !isOffline && (
        <aside 
          aria-label="Connection restored notification"
          className="fixed top-0 left-0 right-0 z-50 bg-emerald-600 text-white text-xs sm:text-sm font-medium px-4 py-2 flex items-center justify-between shadow-lg animate-fade-in"
        >
          <div className="flex items-center space-x-2">
            <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            <span>Back online. Reconnecting to live analytics...</span>
          </div>
          <span className="text-[10px] uppercase font-bold tracking-wider bg-emerald-700/60 px-2 py-0.5 rounded">Connected</span>
        </aside>
      )}

      {/* Android Native Feedback Toast */}
      {toastMessage && (
        <aside 
          aria-label="Application notification message"
          className="fixed bottom-16 left-1/2 -translate-x-1/2 z-50 bg-slate-900/95 text-white text-xs sm:text-sm px-4 py-2.5 rounded-full shadow-2xl border border-slate-700 flex items-center space-x-2 backdrop-blur-md transition-all duration-300 pointer-events-none max-w-[90vw] text-center"
        >
          <svg className="w-4 h-4 text-emerald-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span className="truncate">{toastMessage}</span>
        </aside>
      )}
    </>
  );
}

