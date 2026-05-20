"use client";

import { useEffect, useState } from "react";

/**
 * Sidebar group toggle — collapsible section header.
 * Spec: docs/07_sidebar_specification.md § "Group toggles — aria-expanded pattern".
 *
 * Renders a <button> with chevron + the group <ul> as children.
 * Visibility of children is driven by CSS adjacent-sibling selector:
 *   .sidebar-group-toggle[aria-expanded="false"] + .sidebar-group-content
 * No JS mutation on the <ul> itself.
 */

const STORAGE_KEY = "heuresys-sidebar-groups";

type GroupState = Record<string, boolean>;

function readGroupState(): GroupState {
  if (typeof window === "undefined") return {};
  try { return JSON.parse(window.localStorage.getItem(STORAGE_KEY) || "{}") as GroupState; }
  catch { return {}; }
}

function writeGroupState(state: GroupState) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

export type GroupToggleProps = Readonly<{
  groupId: string;
  label: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}>;

export function GroupToggle({ groupId, label, children, className }: GroupToggleProps) {
  const [expanded, setExpanded] = useState(true);

  useEffect(() => {
    const state = readGroupState();
    if (state[groupId] === false) setExpanded(false);
  }, [groupId]);

  function toggle() {
    setExpanded((prev) => {
      const next = !prev;
      const state = readGroupState();
      state[groupId] = next;
      writeGroupState(state);
      return next;
    });
  }

  return (
    <div className={`sidebar-group ${className ?? ""}`.trim()} data-group={groupId}>
      <button
        type="button"
        data-group-toggle={groupId}
        aria-expanded={expanded}
        onClick={toggle}
        className="sidebar-group-toggle flex w-full items-center justify-between gap-2 rounded-control px-2 py-1 text-left text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground/70 transition hover:text-foreground"
      >
        <span>{label}</span>
        <svg data-group-chevron className="h-3 w-3 transition-transform" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>
      <ul className="sidebar-group-content mt-0.5 space-y-0.5">
        {children}
      </ul>
    </div>
  );
}
