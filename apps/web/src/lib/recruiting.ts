/**
 * apps/web/src/lib/recruiting.ts — il cluster `/recruiting` (`#54` F4): chiavi di query,
 * chiamate e vocabolari, in un posto solo.
 *
 * ⚠ I vocabolari sono LETTERALI e non import di valore da `@heuresys/shared`: `apps/web` puo'
 * importare solo TIPI dal pacchetto (il barrel `.js` non si risolve per i valori sotto
 * Turbopack `transpilePackages`). Sono copie dichiarate degli `z.enum` di
 * `packages/shared/src/schemas/{candidate-applications,job-requisitions,job-postings,
 * candidates,interviews,interview-feedback,job-offers}.ts`, e i tipi qui sotto li ancorano:
 * se uno dei due elenchi cambia, `satisfies` fa fallire il typecheck invece di lasciar
 * divergere le due liste in silenzio.
 */
import { useQuery } from "@tanstack/react-query";
import type {
  ApplicationStage,
  Candidate,
  CandidateApplication,
  CandidateApplicationListResponse,
  CandidateListResponse,
  CandidateSource,
  FeedbackRecommendation,
  InterviewKind,
  InterviewStatus,
  JobOfferStatus,
  JobPosting,
  JobPostingListResponse,
  JobPostingStatus,
  JobPostingVisibility,
  JobRequisition,
  JobRequisitionListResponse,
  JobRequisitionReason,
  JobRequisitionStatus,
  PositionListResponse,
} from "@heuresys/shared";
import { apiFetch } from "@/lib/api/fetch";

export const APPLICATION_STAGES = [
  "APPLIED", "SCREENING", "INTERVIEWING", "OFFER", "HIRED", "REJECTED", "WITHDRAWN",
] as const satisfies readonly ApplicationStage[];

export const REQUISITION_STATUSES = [
  "DRAFT", "APPROVED", "OPEN", "ON_HOLD", "FILLED", "CANCELLED",
] as const satisfies readonly JobRequisitionStatus[];

export const REQUISITION_REASONS = [
  "NEW_ROLE", "REPLACEMENT", "GROWTH", "TEMPORARY", "INTERNAL_MOBILITY",
] as const satisfies readonly JobRequisitionReason[];

export const POSTING_STATUSES = [
  "DRAFT", "PUBLISHED", "CLOSED", "EXPIRED",
] as const satisfies readonly JobPostingStatus[];

export const POSTING_VISIBILITIES = [
  "INTERNAL", "EXTERNAL", "PUBLIC",
] as const satisfies readonly JobPostingVisibility[];

export const CANDIDATE_SOURCES = [
  "DIRECT", "REFERRAL", "AGENCY", "JOB_BOARD", "INTERNAL", "EVENT",
] as const satisfies readonly CandidateSource[];

export const INTERVIEW_KINDS = [
  "SCREENING", "TECHNICAL", "BEHAVIORAL", "PANEL", "FINAL",
] as const satisfies readonly InterviewKind[];

export const INTERVIEW_STATUSES = [
  "SCHEDULED", "COMPLETED", "CANCELLED", "NO_SHOW",
] as const satisfies readonly InterviewStatus[];

export const FEEDBACK_RECOMMENDATIONS = [
  "STRONG_YES", "YES", "NEUTRAL", "NO", "STRONG_NO",
] as const satisfies readonly FeedbackRecommendation[];

export const OFFER_STATUSES = [
  "DRAFT", "SENT", "ACCEPTED", "DECLINED", "EXPIRED", "WITHDRAWN",
] as const satisfies readonly JobOfferStatus[];

/** Chiavi di query del cluster: `invalidateQueries({ queryKey: KEY.applications })` dopo ogni
 *  mutazione, cosi' la verita' torna dall'API e mai da uno stato locale. */
export const KEY = {
  requisitions: ["recruiting", "requisitions"] as const,
  postings: ["recruiting", "postings"] as const,
  candidates: ["recruiting", "candidates"] as const,
  applications: ["recruiting", "applications"] as const,
  application: (id: string) => ["recruiting", "application", id] as const,
  interviews: (applicationId: string) => ["recruiting", "interviews", applicationId] as const,
  feedback: (interviewId: string) => ["recruiting", "feedback", interviewId] as const,
  offers: (applicationId: string) => ["recruiting", "offers", applicationId] as const,
  positions: ["recruiting", "positions"] as const,
} as const;

const OPTS = { staleTime: 30_000, retry: 0 } as const;

export function useRequisitions() {
  return useQuery({
    queryKey: KEY.requisitions,
    queryFn: ({ signal }) =>
      apiFetch<JobRequisitionListResponse>("/v1/job-requisitions?limit=200", { signal }),
    ...OPTS,
  });
}

export function usePostings() {
  return useQuery({
    queryKey: KEY.postings,
    queryFn: ({ signal }) =>
      apiFetch<JobPostingListResponse>("/v1/job-postings?limit=200", { signal }),
    ...OPTS,
  });
}

export function useCandidates() {
  return useQuery({
    queryKey: KEY.candidates,
    queryFn: ({ signal }) =>
      apiFetch<CandidateListResponse>("/v1/candidates?limit=200", { signal }),
    ...OPTS,
  });
}

export function useApplications() {
  return useQuery({
    queryKey: KEY.applications,
    queryFn: ({ signal }) =>
      apiFetch<CandidateApplicationListResponse>("/v1/candidate-applications?limit=200", { signal }),
    ...OPTS,
  });
}

/** Le posizioni attive del tenant: il form della requisizione sceglie un POSTO (I1). */
export function useActivePositions() {
  return useQuery({
    queryKey: KEY.positions,
    queryFn: ({ signal }) =>
      apiFetch<PositionListResponse>("/v1/positions?limit=200&isActive=true", { signal }),
    staleTime: 60_000,
    retry: 0,
  });
}

export type { Candidate, CandidateApplication, JobPosting, JobRequisition };

/** «Mario Rossi» — il candidato non e' un utente, e il suo nome sta su due colonne. */
export function candidateName(c: Pick<Candidate, "firstName" | "lastName">): string {
  return `${c.firstName} ${c.lastName}`.trim();
}

/** Pattern del codice imposto da `JobRequisitionCreateBodySchema` / `JobPostingCreateBodySchema`. */
export const CODE_PATTERN = /^[A-Z0-9][A-Z0-9_-]*$/;
