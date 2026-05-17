type HeuresysComLogoProps = {
  className?: string;
};

export function HeuresysComLogo({ className }: HeuresysComLogoProps) {
  return (
    <svg viewBox="0 0 190 32" className={className} aria-label="Heuresys.com" role="img">
      <rect x="2" y="5" width="22" height="22" rx="7" fill="none" stroke="currentColor" strokeWidth="2" />
      <path d="M9 20V12M9 16h8M17 12v8" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <text x="34" y="21" fontFamily="var(--font-sans, system-ui)" fontSize="16" fontWeight="700" fill="currentColor">
        heuresys.com
      </text>
    </svg>
  );
}
