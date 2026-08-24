import { PLATFORM_LABELS } from '@/lib/platforms';

export function PlatformBadge({ platform, size = 'md' }: { platform: string; size?: 'sm' | 'md' }) {
  const label = PLATFORM_LABELS[platform] ?? platform;
  const dim = size === 'sm' ? 14 : 18;

  return (
    <span className={`inline-flex items-center gap-1 text-sky-400 font-semibold whitespace-nowrap ${size === 'sm' ? 'text-[10px]' : 'text-xs'}`}>
      <svg viewBox="0 0 24 24" width={dim} height={dim} aria-label={label} xmlns="http://www.w3.org/2000/svg">
        <path d="M12 2L3 6V12C3 17.55 6.84 22.74 12 24C17.16 22.74 21 17.55 21 12V6L12 2Z" fill="#0EA5E9" />
        <path d="M10 15.5L7 12.5L8.41 11.09L10 12.67L15.59 7.08L17 8.5L10 15.5Z" fill="white" />
      </svg>
      {label}
    </span>
  );
}