import React, { useState } from 'react';

/**
 * Universal initials extractor:
 * - Strips role suffixes like "(Admin)"
 * - Returns 2 letters if 2+ words (e.g. "Gowtham Gannamaneedi" -> "GG")
 * - Returns 1 letter if 1 word (e.g. "Gowtham" -> "G")
 * - 100% consistent across entire application
 */
export function getCleanDisplayName(user) {
  if (!user) return 'User';
  const raw = typeof user === 'string' ? user : (user.name || user.email || 'User');
  return raw.replace(/\s*\([^)]*\)/g, '').trim() || 'User';
}

export function getUserInitials(user) {
  if (!user) return 'U';
  const name = typeof user === 'string' ? user : (user.name || '');
  const email = typeof user === 'object' ? (user.email || '') : '';

  const clean = name.replace(/\s*\([^)]*\)/g, '').replace(/[^a-zA-Z\s]/g, '').trim();
  if (clean) {
    const parts = clean.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    if (parts.length === 1 && parts[0].length > 0) {
      return parts[0][0].toUpperCase();
    }
  }

  if (email) {
    const emailClean = email.split('@')[0].replace(/[^a-zA-Z]/g, '');
    if (emailClean) return emailClean[0].toUpperCase();
  }

  return 'U';
}

const SIZE_CONFIGS = {
  xs: {
    container: 'h-6 w-6 text-[10px]',
    dot: 'h-2 w-2 -bottom-0.5 -right-0.5 ring-[1.5px]'
  },
  sm: {
    container: 'h-8 w-8 text-xs',
    dot: 'h-2.5 w-2.5 -bottom-0.5 -right-0.5 ring-2'
  },
  md: {
    container: 'h-9 w-9 text-xs',
    dot: 'h-2.5 w-2.5 -bottom-0.5 -right-0.5 ring-2'
  },
  lg: {
    container: 'h-10 w-10 text-sm',
    dot: 'h-3 w-3 -bottom-0.5 -right-0.5 ring-2'
  },
  xl: {
    container: 'h-12 w-12 text-base',
    dot: 'h-3.5 w-3.5 -bottom-0.5 -right-0.5 ring-2'
  }
};

/**
 * Enterprise User Avatar Component
 * Single source of truth for all user avatars in RicozAnalytics.
 */
export default function UserAvatar({
  user,
  size = 'sm',
  showStatus = true,
  status = 'online',
  className = ''
}) {
  const [imgError, setImgError] = useState(false);
  const sizeConfig = SIZE_CONFIGS[size] || SIZE_CONFIGS.sm;

  const displayName = getCleanDisplayName(user);
  const initials = getUserInitials(user);
  const avatarUrl = typeof user === 'object' ? (user?.avatar || user?.avatar_url || null) : null;

  return (
    <div className={`relative inline-flex shrink-0 select-none ${className}`}>
      <div
        className={`${sizeConfig.container} flex items-center justify-center rounded-full font-bold font-sans text-white bg-rose-600 shadow-2xs overflow-hidden`}
        title={displayName}
      >
        {avatarUrl && !imgError ? (
          <img
            src={avatarUrl}
            alt={displayName}
            onError={() => setImgError(true)}
            className="h-full w-full object-cover rounded-full"
          />
        ) : (
          <span className="tracking-tight">{initials}</span>
        )}
      </div>

      {showStatus && (
        <span
          className={`absolute ${sizeConfig.dot} block rounded-full ring-white ${
            status === 'online'
              ? 'bg-emerald-500'
              : status === 'away'
              ? 'bg-amber-500'
              : 'bg-slate-400'
          }`}
          title={status === 'online' ? 'Online' : status}
        />
      )}
    </div>
  );
}
