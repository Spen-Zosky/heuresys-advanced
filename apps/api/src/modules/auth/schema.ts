/**
 * apps/api/src/modules/auth/schema.ts
 * Thin re-export shim. The canonical schemas live in @heuresys/shared so
 * the future frontend can import them too. Keep this file as a stable
 * import surface for in-API code; if you need a new auth schema, add it
 * to packages/shared/src/schemas/auth.ts and re-export here.
 */

export {
  PasswordPolicy,
  LoginBodySchema,
  LoginResponseSchema,
  LoginMfaRequiredResponseSchema,
  LoginResultResponseSchema,
  MeResponseSchema,
  PasswordResetRequestBodySchema,
  PasswordResetCompleteBodySchema,
  RevokeUserParamsSchema,
  EmptyResponseSchema,
  ErrorEnvelopeSchema,
  RoleCodeSchema,
  RolePermissionsResponseSchema,
  ActiveSessionSchema,
  ListActiveSessionsParamsSchema,
  ListActiveSessionsResponseSchema,
  type LoginBody,
  type LoginResponse,
  type LoginMfaRequiredResponse,
  type LoginResultResponse,
  type MeResponse,
  type PasswordResetRequestBody,
  type PasswordResetCompleteBody,
  type RevokeUserParams,
  type ActiveSession,
  type ListActiveSessionsParams,
  type ListActiveSessionsResponse,
} from "@heuresys/shared";
