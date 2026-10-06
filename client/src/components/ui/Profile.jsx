import React, { useRef, useEffect } from 'react';
import { LogOut, ChevronDown, Settings, ShieldCheck, Users, Building2, Check } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import UserAvatar, { getCleanDisplayName } from './UserAvatar';
import RoleBadge from './RoleBadge';

/**
 * Enterprise User Profile Control — Top Right Navbar
 * Single source of truth for the primary account menu.
 */
export default function Profile({
  isOpen,
  onToggle,
  onClose
}) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const localRef = useRef(null);

  // Allow controlled or uncontrolled state
  const isMenuOpen = typeof isOpen === 'boolean' ? isOpen : false;

  const handleToggle = () => {
    if (onToggle) {
      onToggle();
    }
  };

  const handleClose = () => {
    if (onClose) {
      onClose();
    }
  };

  // Outside click & Escape listener
  useEffect(() => {
    if (!isMenuOpen) return;

    const handleClickOutside = (e) => {
      if (localRef.current && !localRef.current.contains(e.target)) {
        handleClose();
      }
    };

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        handleClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isMenuOpen]);

  const handleLogout = () => {
    handleClose();
    logout();
    navigate('/login', { replace: true });
  };

  const displayName = getCleanDisplayName(user);
  const orgName = user?.organization_name || 'Ricoz Primary Organization';
  const userEmail = user?.email || 'user@ricoz.test';
  const role = user?.role || 'viewer';

  return (
    <div className="relative inline-block text-left" ref={localRef} id="global-profile-container">
      {/* Clickable Profile Trigger Control */}
      <button
        type="button"
        id="top-profile-menu-button"
        onClick={handleToggle}
        className={`group flex items-center gap-2.5 h-10 px-2.5 rounded-xl border transition-all cursor-pointer select-none ${
          isMenuOpen
            ? 'border-blue-500 bg-blue-50/40 dark:bg-blue-950/40 ring-2 ring-blue-100 dark:ring-blue-900/50 shadow-xs'
            : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:border-slate-300 dark:hover:border-slate-600 hover:bg-slate-50/80 dark:hover:bg-slate-750 shadow-2xs'
        }`}
        aria-label="User Account Menu"
        aria-expanded={isMenuOpen}
        aria-haspopup="true"
      >
        {/* Consistent Universal Avatar */}
        <UserAvatar user={user} size="sm" showStatus={true} status="online" />

        {/* Identity & Role Badge */}
        <div className="hidden sm:flex items-center gap-2 text-left leading-none">
          <span className="text-xs font-bold text-slate-800 dark:text-slate-100 tracking-tight max-w-[110px] truncate">
            {displayName}
          </span>
          <RoleBadge role={role} size="xs" />
        </div>

        {/* Dropdown Chevron */}
        <ChevronDown
          className={`h-3.5 w-3.5 text-slate-400 dark:text-slate-400 group-hover:text-slate-600 dark:group-hover:text-slate-200 transition-transform duration-150 ${
            isMenuOpen ? 'rotate-180 text-blue-600 dark:text-blue-400' : ''
          }`}
        />
      </button>

      {/* Profile Dropdown Popover */}
      {isMenuOpen && (
        <div
          role="menu"
          aria-orientation="vertical"
          aria-labelledby="top-profile-menu-button"
          className="absolute right-0 mt-2 w-72 rounded-2xl border border-slate-200 dark:border-slate-750 bg-white dark:bg-slate-850 p-2 shadow-xl z-50 animate-in fade-in slide-in-from-top-2 duration-150 text-slate-800 dark:text-slate-100"
        >
          {/* User Account Context Header */}
          <div className="p-3 border-b border-slate-100 dark:border-slate-750 bg-slate-50/70 dark:bg-slate-800/80 rounded-xl mb-1.5">
            <div className="flex items-center gap-3">
              <UserAvatar user={user} size="md" showStatus={true} status="online" />
              <div className="min-w-0 flex-1">
                <p className="font-bold text-slate-900 dark:text-slate-50 text-xs sm:text-sm truncate leading-snug">
                  {displayName}
                </p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate font-mono mt-0.5">
                  {userEmail}
                </p>
              </div>
            </div>

            {/* Workspace & Role Metadata Strip */}
            <div className="mt-3 pt-2.5 border-t border-slate-200/60 dark:border-slate-700/60 space-y-1.5 text-[11px]">
              <div className="flex items-center justify-between text-slate-600 dark:text-slate-300">
                <span className="text-slate-400 dark:text-slate-500 font-medium">Workspace:</span>
                <span className="font-semibold text-slate-800 dark:text-slate-200 truncate max-w-[150px]" title={orgName}>
                  {orgName}
                </span>
              </div>
              <div className="flex items-center justify-between text-slate-600 dark:text-slate-300">
                <span className="text-slate-400 dark:text-slate-500 font-medium">Role Authority:</span>
                <RoleBadge role={role} size="xs" />
              </div>
            </div>
          </div>

          {/* Navigation Menu Links */}
          <div className="space-y-0.5 py-1">
            <button
              type="button"
              onClick={() => {
                handleClose();
                navigate('/settings');
              }}
              className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white transition text-xs font-semibold cursor-pointer"
            >
              <Settings className="h-4 w-4 text-slate-400 dark:text-slate-400" />
              <span>Workspace Settings</span>
            </button>

            <button
              type="button"
              onClick={() => {
                handleClose();
                navigate('/governance');
              }}
              className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white transition text-xs font-semibold cursor-pointer"
            >
              <ShieldCheck className="h-4 w-4 text-blue-600 dark:text-blue-400" />
              <span>Platform Governance</span>
            </button>

            <button
              type="button"
              onClick={() => {
                handleClose();
                navigate('/collaboration');
              }}
              className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white transition text-xs font-semibold cursor-pointer"
            >
              <Users className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
              <span>Team Collaboration</span>
            </button>
          </div>

          {/* Sign Out Action */}
          <div className="pt-1.5 border-t border-slate-100 dark:border-slate-750 mt-1">
            <button
              type="button"
              onClick={handleLogout}
              id="top-profile-logout-button"
              className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 hover:text-rose-700 dark:hover:text-rose-300 transition text-xs font-semibold cursor-pointer"
            >
              <LogOut className="h-4 w-4 text-rose-500 dark:text-rose-400" />
              <span>Sign Out</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
