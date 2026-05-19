"use client";

import { PALETTE_LIST } from "./palettes";
import { usePalette } from "./PaletteProvider";

/**
 * 4-box-style palette switcher per bundle docs/06_header_specification.md.
 * We render all 5 palette swatches as a horizontal row of buttons; active
 * one has a ring. Click cycles palette + persists to localStorage + writes
 * CSS variables.
 */
export function PaletteSwitcher({ className = "" }: { className?: string }) {
  const { paletteId, setPalette } = usePalette();
  return (
    <div
      role="radiogroup"
      aria-label="Brand palette"
      className={`inline-flex items-center gap-1 rounded-full border border-[var(--border)] bg-[var(--card)] p-0.5 ${className}`}
      style={{ transition: "background-color 200ms, border-color 200ms" }}
    >
      {PALETTE_LIST.map((p) => {
        const active = p.id === paletteId;
        return (
          <button
            key={p.id}
            type="button"
            role="radio"
            aria-checked={active}
            aria-label={`Palette ${p.name}`}
            title={`${p.name} — ${p.thesis}`}
            onClick={() => setPalette(p.id)}
            className={`relative inline-flex h-6 w-6 items-center justify-center rounded-full transition-transform hover:scale-110 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--background)] ${
              active ? "ring-2 ring-offset-2 ring-offset-[var(--card)] scale-110" : ""
            }`}
            style={{
              backgroundColor: p.accent.p1,
              boxShadow: active
                ? `0 0 0 2px var(--card), 0 0 0 4px ${p.accent.p1}`
                : undefined,
            }}
          >
            <span className="sr-only">{p.name}</span>
          </button>
        );
      })}
    </div>
  );
}
