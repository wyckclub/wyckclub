export function VerifyBadge({ verified, className = 'w-5 h-5' }: { verified: boolean; className?: string }) {
  if (verified) {
    return (
      <span className="inline-flex items-center gap-1 text-emerald-400 text-xs font-semibold whitespace-nowrap">
        <svg viewBox="0 0 24 24" className={className} aria-label="Verified" xmlns="http://www.w3.org/2000/svg">
          <path d="M12 2L3 6V12C3 17.55 6.84 22.74 12 24C17.16 22.74 21 17.55 21 12V6L12 2Z" fill="#0EA5E9" />
          <path d="M10 15.5L7 12.5L8.41 11.09L10 12.67L15.59 7.08L17 8.5L10 15.5Z" fill="white" />
        </svg>
        Verified
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-slate-400 text-xs font-semibold whitespace-nowrap">
      <svg viewBox="0 0 24 24" fill="none" className={className} aria-label="Not Verified">
        <circle cx="12" cy="12" r="10" fill="#64748b" />
        <path d="M8.5 8.5l7 7M15.5 8.5l-7 7" stroke="white" strokeWidth={2} strokeLinecap="round" />
      </svg>
      Not Verified
    </span>
  );
}