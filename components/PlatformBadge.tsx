import { PLATFORM_LABELS } from '@/lib/platforms';

function ShieldIcon({ dim }: { dim: number }) {
  return (
    <svg viewBox="0 0 24 24" width={dim} height={dim} xmlns="http://www.w3.org/2000/svg">
      <path d="M12 2L3 6V12C3 17.55 6.84 22.74 12 24C17.16 22.74 21 17.55 21 12V6L12 2Z" fill="#0EA5E9" />
      <path d="M10 15.5L7 12.5L8.41 11.09L10 12.67L15.59 7.08L17 8.5L10 15.5Z" fill="white" />
    </svg>
  );
}

function NotVerifiedIcon({ dim }: { dim: number }) {
  return (
    <svg viewBox="0 0 24 24" width={dim} height={dim} xmlns="http://www.w3.org/2000/svg">
      <path d="M12 2 23 21H1L12 2Z" fill="#FACC15" />
      <path d="M12 9v5" stroke="#1a1a1a" strokeWidth={2.5} strokeLinecap="round" />
      <circle cx="12" cy="17.5" r="1.2" fill="#1a1a1a" />
    </svg>
  );
}

function UnknownIcon({ dim }: { dim: number }) {
  return (
    <svg viewBox="0 0 24 24" width={dim} height={dim} xmlns="http://www.w3.org/2000/svg">
      <circle cx="12" cy="12" r="10" fill="#475569" />
      <path
        d="M9.5 9.2c0-1.5 1.1-2.4 2.5-2.4s2.4.8 2.4 2c0 1-0.6 1.5-1.3 2-0.6 0.4-1 0.7-1 1.4"
        fill="none"
        stroke="#cbd5e1"
        strokeWidth={1.6}
        strokeLinecap="round"
      />
      <circle cx="12" cy="16.2" r="1.1" fill="#cbd5e1" />
    </svg>
  );
}

export function PlatformBadge({ platform, size = 'md' }: { platform: string; size?: 'sm' | 'md' }) {
  const label = PLATFORM_LABELS[platform] ?? platform;
  const dim = size === 'sm' ? 14 : 18;
  const isUnknown = platform === 'unknown';
  const isUnverified = !isUnknown && platform.endsWith('_unverified');

  const colorClass = isUnknown ? 'text-slate-400' : isUnverified ? 'text-yellow-400' : 'text-sky-400';
  const icon = isUnknown ? <UnknownIcon dim={dim} /> : isUnverified ? <NotVerifiedIcon dim={dim} /> : <ShieldIcon dim={dim} />;

  return (
    <span
      className={`inline-flex items-center gap-1 font-semibold whitespace-nowrap shrink-0 ${colorClass} ${
        size === 'sm' ? 'text-[9px]' : 'text-xs'
      }`}
    >
      {icon}
      <span className="truncate">{label}</span>
    </span>
  );
}