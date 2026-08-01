"use client";

/**
 * Sinonimi e legami di UNA competenza (#43 — linea C2).
 *
 * `skill-aliases` (5 endpoint) e `skill-taxonomy-edges` (4) erano gli ultimi
 * due moduli del catalogo competenze senza interfaccia.
 *
 * Stanno dentro la scheda della competenza e non su una pagina a sé perché
 * sono suoi attributi: "come altro si chiama" e "a cosa è legata". Aprire una
 * competenza e vederli lì è il gesto naturale; cercarli altrove no.
 *
 * Due vincoli dell'API rispettati alla lettera:
 *  - i **legami sono immutabili**: l'API espone solo creazione e cancellazione
 *    (lo dichiara il suo stesso schema). Quindi niente modifica: per cambiare
 *    un legame lo si elimina e lo si ricrea, ed è ciò che l'interfaccia offre.
 *  - la competenza all'altro capo si sceglie **cercandola**: su 14.000 voci un
 *    menù a tendina completo non è utilizzabile.
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button, Card, CardContent, CardHeader, CardTitle, Input } from "@heuresys/ui";
import type { Skill, SkillAlias, SkillEdgeKind, SkillTaxonomyEdge } from "@heuresys/shared";
import { apiFetch } from "@/lib/api/fetch";
import { isApiError } from "@/lib/api/errors";
import { useCurrentUserPermissions } from "@/lib/api/auth";

const SELECT_CLASS =
  "w-full rounded-control border border-border bg-card px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

// Lista locale: il web importa TIPI, non valori.
const EDGE_KINDS: readonly SkillEdgeKind[] = ["IS_A", "PART_OF", "RELATED", "PREREQUISITE_OF"];

function messaggioErrore(err: unknown, t: (k: string) => string): string {
  if (isApiError(err)) {
    if (err.status === 403) return t("skills.relations.forbidden");
    if (err.status === 409) return t("skills.relations.duplicate");
  }
  return t("skills.relations.saveError");
}

/* --- sinonimi ------------------------------------------------------------ */

export function SkillAliasesPanel({ skillId }: { skillId: string }) {
  const { t } = useTranslation("hr");
  const qc = useQueryClient();
  const perms = new Set(useCurrentUserPermissions().data?.permissions ?? []);
  const canWrite = perms.has("skill:update");
  const canDelete = perms.has("skill:delete");

  const [label, setLabel] = useState("");
  const [locale, setLocale] = useState("");

  const key = ["skill-aliases", skillId] as const;
  const aliases = useQuery({
    queryKey: key,
    queryFn: () => apiFetch<{ items: SkillAlias[] }>(`/v1/skill-aliases?skillId=${skillId}&limit=200`),
    enabled: !!skillId,
  });

  const add = useMutation({
    mutationFn: () =>
      apiFetch<SkillAlias>("/v1/skill-aliases", {
        method: "POST",
        body: { skillId, label: label.trim(), locale: locale.trim() === "" ? null : locale.trim() },
      }),
    onSuccess: () => {
      setLabel("");
      setLocale("");
      void qc.invalidateQueries({ queryKey: key });
    },
  });

  const remove = useMutation({
    mutationFn: (aliasId: string) => apiFetch<void>(`/v1/skill-aliases/${aliasId}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: key }),
  });

  const items = aliases.data?.items ?? [];
  const errore = add.isError ? add.error : remove.isError ? remove.error : null;

  return (
    <Card data-testid="skill-aliases-panel">
      <CardHeader>
        <CardTitle>
          {t("skills.relations.aliasesTitle")}
          <span className="ml-2 text-sm font-normal text-muted-foreground">{items.length}</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {aliases.isLoading && <p className="text-sm text-muted-foreground">{t("common:loading")}</p>}
        {!aliases.isLoading && items.length === 0 && (
          <p data-testid="skill-aliases-empty" className="text-sm text-muted-foreground">
            {t("skills.relations.aliasesEmpty")}
          </p>
        )}

        {items.length > 0 && (
          <ul className="space-y-2" data-testid="skill-aliases-list">
            {items.map((a) => (
              <li key={a.aliasId} className="flex items-center gap-3 text-sm" data-testid="skill-alias-row">
                <span className="font-medium text-foreground">{a.label}</span>
                {a.locale && <span className="text-xs uppercase text-muted-foreground">{a.locale}</span>}
                {canDelete && (
                  <Button
                    type="button"
                    variant="outline"
                    data-testid={`skill-alias-delete-${a.label}`}
                    disabled={remove.isPending}
                    onClick={() => remove.mutate(a.aliasId)}
                  >
                    {t("skills.relations.remove")}
                  </Button>
                )}
              </li>
            ))}
          </ul>
        )}

        {canWrite && (
          <div className="flex flex-wrap items-end gap-3 border-t pt-3" data-testid="skill-alias-add">
            <div className="min-w-56 flex-1">
              <label htmlFor="alias-label" className="mb-1 block text-sm font-medium text-foreground">
                {t("skills.relations.aliasLabel")}
              </label>
              <Input id="alias-label" data-testid="skill-alias-label" value={label} onChange={(e) => setLabel(e.target.value)} />
            </div>
            <div className="w-32">
              <label htmlFor="alias-locale" className="mb-1 block text-sm font-medium text-foreground">
                {t("skills.relations.aliasLocale")}
              </label>
              <Input id="alias-locale" data-testid="skill-alias-locale" value={locale} onChange={(e) => setLocale(e.target.value)} placeholder="it" />
            </div>
            <Button
              type="button"
              data-testid="skill-alias-add-submit"
              disabled={add.isPending || label.trim() === ""}
              onClick={() => add.mutate()}
            >
              {add.isPending ? t("common:saving") : t("skills.relations.add")}
            </Button>
          </div>
        )}

        {errore && (
          <p data-testid="skill-aliases-error" className="text-sm text-danger">
            {messaggioErrore(errore, t)}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

/* --- legami tassonomici -------------------------------------------------- */

export function SkillEdgesPanel({ skillId }: { skillId: string }) {
  const { t } = useTranslation("hr");
  const qc = useQueryClient();
  const perms = new Set(useCurrentUserPermissions().data?.permissions ?? []);
  const canCreate = perms.has("skill_taxonomy:create");
  const canDelete = perms.has("skill_taxonomy:delete");

  const [cerca, setCerca] = useState("");
  const [altra, setAltra] = useState("");
  const [kind, setKind] = useState<SkillEdgeKind>("IS_A");
  const [verso, setVerso] = useState<"child" | "parent">("child");

  // Due elenchi: i legami dove questa competenza è il PADRE e quelli dove è
  // il FIGLIO. L'API filtra per un capo alla volta, quindi si chiede due volte.
  const comePadre = useQuery({
    queryKey: ["skill-edges", skillId, "parent"],
    queryFn: () => apiFetch<{ items: SkillTaxonomyEdge[] }>(`/v1/skill-taxonomy-edges?parentSkillId=${skillId}&limit=200`),
    enabled: !!skillId,
  });
  const comeFiglio = useQuery({
    queryKey: ["skill-edges", skillId, "child"],
    queryFn: () => apiFetch<{ items: SkillTaxonomyEdge[] }>(`/v1/skill-taxonomy-edges?childSkillId=${skillId}&limit=200`),
    enabled: !!skillId,
  });

  // Su 14.000 competenze l'altro capo si CERCA: un menù completo non si usa.
  const risultati = useQuery({
    queryKey: ["skills", "edge-picker", cerca],
    queryFn: () => apiFetch<{ items: Skill[] }>(`/v1/skills?limit=20&search=${encodeURIComponent(cerca.trim())}`),
    enabled: canCreate && cerca.trim().length >= 2,
  });

  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: ["skill-edges", skillId] });
  };

  const add = useMutation({
    mutationFn: () =>
      apiFetch<SkillTaxonomyEdge>("/v1/skill-taxonomy-edges", {
        method: "POST",
        body:
          verso === "child"
            ? { parentSkillId: skillId, childSkillId: altra, kind }
            : { parentSkillId: altra, childSkillId: skillId, kind },
      }),
    onSuccess: () => {
      setAltra("");
      setCerca("");
      invalidate();
    },
  });

  const remove = useMutation({
    mutationFn: (edgeId: string) => apiFetch<void>(`/v1/skill-taxonomy-edges/${edgeId}`, { method: "DELETE" }),
    onSuccess: invalidate,
  });

  const righe = [
    ...(comePadre.data?.items ?? []).map((e) => ({ e, ruolo: "parent" as const })),
    ...(comeFiglio.data?.items ?? []).map((e) => ({ e, ruolo: "child" as const })),
  ];
  const errore = add.isError ? add.error : remove.isError ? remove.error : null;

  return (
    <Card data-testid="skill-edges-panel">
      <CardHeader>
        <CardTitle>
          {t("skills.relations.edgesTitle")}
          <span className="ml-2 text-sm font-normal text-muted-foreground">{righe.length}</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* L'API dichiara i legami IMMUTABILI (solo create/delete): non si
            offre una modifica che non esiste. */}
        <p className="text-xs text-muted-foreground">{t("skills.relations.edgesImmutableNote")}</p>

        {righe.length === 0 && !comePadre.isLoading && !comeFiglio.isLoading && (
          <p data-testid="skill-edges-empty" className="text-sm text-muted-foreground">
            {t("skills.relations.edgesEmpty")}
          </p>
        )}

        {righe.length > 0 && (
          <ul className="space-y-2" data-testid="skill-edges-list">
            {righe.map(({ e, ruolo }) => (
              <li key={e.edgeId} className="flex flex-wrap items-center gap-3 text-sm" data-testid="skill-edge-row">
                <span className="rounded-control border border-border px-2 py-0.5 text-xs uppercase text-muted-foreground">
                  {t(`skills.relations.kind.${e.kind}`)}
                </span>
                <span className="text-muted-foreground">
                  {ruolo === "parent" ? t("skills.relations.towardsChild") : t("skills.relations.towardsParent")}
                </span>
                <span className="font-mono text-xs text-muted-foreground">
                  {ruolo === "parent" ? e.childSkillId.slice(0, 8) : e.parentSkillId.slice(0, 8)}
                </span>
                {canDelete && (
                  <Button
                    type="button"
                    variant="outline"
                    data-testid={`skill-edge-delete-${e.edgeId}`}
                    disabled={remove.isPending}
                    onClick={() => remove.mutate(e.edgeId)}
                  >
                    {t("skills.relations.remove")}
                  </Button>
                )}
              </li>
            ))}
          </ul>
        )}

        {canCreate && (
          <div className="space-y-3 border-t pt-3" data-testid="skill-edge-add">
            <div className="flex flex-wrap items-end gap-3">
              <div className="min-w-56 flex-1">
                <label htmlFor="edge-search" className="mb-1 block text-sm font-medium text-foreground">
                  {t("skills.relations.otherSkill")}
                </label>
                <Input
                  id="edge-search"
                  data-testid="skill-edge-search"
                  value={cerca}
                  onChange={(e) => setCerca(e.target.value)}
                  placeholder={t("skills.relations.otherSkillPlaceholder")}
                />
              </div>
              <div className="min-w-56">
                <label htmlFor="edge-other" className="mb-1 block text-sm font-medium text-foreground">
                  {t("skills.relations.pick")}
                </label>
                <select id="edge-other" data-testid="skill-edge-other" className={SELECT_CLASS} value={altra} onChange={(e) => setAltra(e.target.value)}>
                  <option value="">{t("skills.relations.pickNone")}</option>
                  {(risultati.data?.items ?? [])
                    .filter((s) => s.skillId !== skillId)
                    .map((s) => (
                      <option key={s.skillId} value={s.skillId}>
                        {s.name}
                      </option>
                    ))}
                </select>
              </div>
            </div>
            <div className="flex flex-wrap items-end gap-3">
              <div className="min-w-48">
                <label htmlFor="edge-kind" className="mb-1 block text-sm font-medium text-foreground">
                  {t("skills.relations.edgeKind")}
                </label>
                <select id="edge-kind" data-testid="skill-edge-kind" className={SELECT_CLASS} value={kind} onChange={(e) => setKind(e.target.value as SkillEdgeKind)}>
                  {EDGE_KINDS.map((k) => (
                    <option key={k} value={k}>
                      {t(`skills.relations.kind.${k}`)}
                    </option>
                  ))}
                </select>
              </div>
              <div className="min-w-48">
                <label htmlFor="edge-direction" className="mb-1 block text-sm font-medium text-foreground">
                  {t("skills.relations.direction")}
                </label>
                <select id="edge-direction" data-testid="skill-edge-direction" className={SELECT_CLASS} value={verso} onChange={(e) => setVerso(e.target.value as "child" | "parent")}>
                  <option value="child">{t("skills.relations.towardsChild")}</option>
                  <option value="parent">{t("skills.relations.towardsParent")}</option>
                </select>
              </div>
              <Button
                type="button"
                data-testid="skill-edge-add-submit"
                disabled={add.isPending || altra === ""}
                onClick={() => add.mutate()}
              >
                {add.isPending ? t("common:saving") : t("skills.relations.add")}
              </Button>
            </div>
          </div>
        )}

        {errore && (
          <p data-testid="skill-edges-error" className="text-sm text-danger">
            {messaggioErrore(errore, t)}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
