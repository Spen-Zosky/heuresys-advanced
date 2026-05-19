"use client";

import { usePalette } from "./PaletteProvider";

export function ThemeToggle({ className = "" }: { className?: string }) {
  const { mode, toggleMode } = usePalette();
  const isDark = mode === "dark";
  return (
    <button
      type="button"
      onClick={toggleMode}
      aria-label={`Switch to ${isDark ? "light" : "dark"} theme`}
      aria-pressed={isDark}
      title={`Theme: ${mode}`}
      className={`relative inline-flex h-7 w-12 shrink-0 cursor-pointer items-center rounded-full border border-[var(--border)] bg-[var(--card)] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--background)] ${className}`}
      style={{ transition: "background-color 200ms, border-color 200ms" }}
    >
      <span
        aria-hidden
        className="pointer-events-none inline-flex h-5 w-5 items-center justify-center rounded-full bg-[var(--palette-1)] text-[10px] text-white shadow-sm transition-transform duration-200 will-change-transform"
        style={{
          transform: `translateX(${isDark ? "22px" : "2px"})`,
        }}
      >
        {isDark ? "◐" : "☼"}
      </span>
    </button>
  );
}
