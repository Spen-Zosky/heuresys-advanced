/**
 * apps/web/src/lib/api/auth.ts
 *
 * TanStack Query hooks for the auth flow:
 *   useCurrentUser() — GET /v1/auth/me (sessionful)
 *   useLogin()       — POST /v1/auth/login → seeds csrfStore + invalidates user
 *   useLogout()      — POST /v1/auth/logout → clears caches
 *
 * All call sites use apiFetch() so cookies + CSRF + silent refresh are
 * handled transparently.
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { UserPreference, UpdateUserPreferenceBody } from "@heuresys/shared";
import { apiFetch } from "./fetch";
import { csrfStore } from "./csrf-store";

export interface AuthMeUser {
  userId: string;
  email: string;
  displayName: string | null;
  tenantId: string | null;
  locale: string | null;
  timezone: string | null;
  roles: string[];
}

export interface LoginSuccessResponse {
  status: "success";
  user: AuthMeUser;
  roles: string[];
  csrfToken: string;
}

export interface LoginMfaRequiredResponse {
  status: "mfa_required";
  challengeToken: string;
  availableKinds: string[];
}

/** /login 200 body — success bundle OR MFA-required challenge (MVP-3 Tappa E). */
export type LoginResult = LoginSuccessResponse | LoginMfaRequiredResponse;

export interface LoginBody {
  email: string;
  password: string;
  /** MFA second-step handle returned by a prior `mfa_required` response. */
  challengeToken?: string;
  /** MFA second-step 6-digit TOTP code. */
  mfaCode?: string;
}

export const AUTH_ME_QUERY_KEY = ["auth", "me"] as const;

export function useCurrentUser() {
  return useQuery({
    queryKey: AUTH_ME_QUERY_KEY,
    queryFn: ({ signal }) =>
      apiFetch<AuthMeUser>("/v1/auth/me", { signal }),
    staleTime: 30_000,
    // 401 is handled by apiFetch silent-refresh; if it still bubbles up here,
    // the user is genuinely unauthenticated — render the login redirect.
    retry: 0,
  });
}

export interface MePermissions {
  roles: string[];
  permissions: string[];
}

export const ME_PERMISSIONS_QUERY_KEY = ["me", "permissions"] as const;

/**
 * The caller's own flattened RBAC permission codes (GET /v1/me/permissions).
 * Drives per-item sidebar gating so the UI mirrors the API's requirePermission gate.
 */
export function useCurrentUserPermissions() {
  return useQuery({
    queryKey: ME_PERMISSIONS_QUERY_KEY,
    queryFn: ({ signal }) => apiFetch<MePermissions>("/v1/me/permissions", { signal }),
    staleTime: 60_000,
    retry: 0,
  });
}

export interface MyInterface {
  code: string;
  label: string;
  route: string;
  icon: string | null;
  sidebarGroup: string;
  order: number;
}
export interface MyPerspective {
  code: "PROCESS" | "ENTERPRISE" | "TALENT";
  label: string;
  interfaces: MyInterface[];
}
export interface MyInterfaces {
  perspectives: MyPerspective[];
}

export const ME_INTERFACES_QUERY_KEY = ["me", "interfaces"] as const;

/**
 * The caller's DB-driven sidebar registry (GET /v1/me/interfaces), grouped by the 3 PET
 * perspectives. Gating (per-permission + admin-class hybrid) is applied server-side, so the
 * UI renders exactly what this returns — no client-side role/permission filtering needed.
 */
export function useMyInterfaces() {
  return useQuery({
    queryKey: ME_INTERFACES_QUERY_KEY,
    queryFn: ({ signal }) => apiFetch<MyInterfaces>("/v1/me/interfaces", { signal }),
    staleTime: 60_000,
    retry: 0,
  });
}

/* --- UI preferences (WS-4 P1) — server source-of-truth ---------------- */

export type { UserPreference, UpdateUserPreferenceBody } from "@heuresys/shared";

export const ME_PREFERENCES_QUERY_KEY = ["me", "preferences"] as const;

/**
 * The caller's stored UI preferences (GET /v1/me/preferences). Server is the source of truth:
 * theme+palette are re-applied on every session (incl. a new device) by the layout's
 * PreferencesApplier. The API returns the brand defaults (dark / balanced) when no row exists yet.
 */
export function useMyPreferences() {
  return useQuery({
    queryKey: ME_PREFERENCES_QUERY_KEY,
    queryFn: ({ signal }) => apiFetch<UserPreference>("/v1/me/preferences", { signal }),
    staleTime: 60_000,
    retry: 0,
  });
}

/**
 * Persist a partial preference update (PATCH /v1/me/preferences). On success the server response
 * (the full resolved preference) is written into the query cache so the applier re-runs immediately.
 */
export function useUpdateMyPreferences() {
  const qc = useQueryClient();
  return useMutation({
    mutationKey: ["me", "preferences", "update"],
    mutationFn: (body: UpdateUserPreferenceBody) =>
      apiFetch<UserPreference>("/v1/me/preferences", { method: "PATCH", body }),
    onSuccess: (pref) => {
      qc.setQueryData(ME_PREFERENCES_QUERY_KEY, pref);
    },
  });
}

export function useLogin() {
  const qc = useQueryClient();
  return useMutation({
    mutationKey: ["auth", "login"],
    mutationFn: async (body: LoginBody) => {
      const res = await apiFetch<LoginResult>("/v1/auth/login", {
        method: "POST",
        body,
      });
      // MFA-required: no tokens issued yet — caller drives the second step.
      if (res.status === "success") {
        csrfStore.set(res.csrfToken);
      }
      return res;
    },
    onSuccess: async (res) => {
      if (res.status !== "success") return;
      // The login response splits `user` (profile fields) from `roles`. The
      // /v1/auth/me endpoint returns them merged — mirror that shape so the
      // layout's hasAdminRole check sees the roles immediately, no refetch.
      qc.setQueryData(AUTH_ME_QUERY_KEY, { ...res.user, roles: res.roles });
    },
  });
}

export function useLogout() {
  const qc = useQueryClient();
  return useMutation({
    mutationKey: ["auth", "logout"],
    mutationFn: async () => {
      await apiFetch("/v1/auth/logout", { method: "POST" });
      csrfStore.clear();
    },
    onSettled: () => {
      qc.clear();
    },
  });
}
