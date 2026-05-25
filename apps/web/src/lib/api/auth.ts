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
