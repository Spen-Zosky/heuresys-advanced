type HeuresysLogoProps = {
  variant?: "horizontal" | "symbol" | "monochrome";
  className?: string;
};

export function HeuresysLogo({
  variant = "horizontal",
  className,
}: HeuresysLogoProps) {
  if (variant === "symbol") {
    return (
      <svg viewBox="0 0 48 48" className={className} aria-label="Heuresys" role="img">
        <rect x="6" y="6" width="36" height="36" rx="12" fill="none" stroke="currentColor" strokeWidth="3" />
        <path d="M16 31V17M16 24h16M32 17v14" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 220 48" className={className} aria-label="Heuresys" role="img">
      <rect x="4" y="6" width="36" height="36" rx="12" fill="none" stroke="currentColor" strokeWidth="3" />
      <path d="M14 31V17M14 24h16M30 17v14" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
      <text x="52" y="31" fontFamily="var(--font-sans, system-ui)" fontSize="24" fontWeight="700" fill="currentColor">
        Heuresys
      </text>
    </svg>
  );
}
