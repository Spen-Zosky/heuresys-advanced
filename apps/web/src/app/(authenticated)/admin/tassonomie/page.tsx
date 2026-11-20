"use client";

/**
 * /admin/tassonomie — i cataloghi globali, senza tenant, con cui si descrivono le professioni e le
 * imprese (ondata 5a degli endpoint senza consumatori, 2026-11-19): professioni ISCO-08 e CP 2021,
 * attività economiche ATECO e NACE con le loro corrispondenze, fasce dimensionali e modelli
 * operativi. Le loro scritture (`POST`/`PATCH`/`PUT`) esistevano senza schermata; la pagina di un
 * tenant (`/tenants/[id]/enterprise-typing`) li sceglie, questa li cura.
 */

import { useTranslation } from "react-i18next";
import type { ActivityClassification, OccupationClassification } from "@heuresys/shared";
import { ACTIVITY_CLASS_SCHEME_VALUES, OCCUPATION_CLASS_SCHEME_VALUES } from "@heuresys/shared";
import { PageHeader } from "@/components/intestazione-pagina";
import { StatoCaricamento, StatoNegato } from "@/components/stato-pagina";
import { useCurrentUserPermissions } from "@/lib/api/auth";
import { CatalogoClassi, type Catalogo } from "./catalogo-classi";
import { Corrispondenze } from "./corrispondenze";
import { FasceDimensionali, ModelliOperativi } from "./cataloghi-impresa";

export default function TassonomiePage() {
  const { t } = useTranslation("admin");
  const permessi = useCurrentUserPermissions();
  const perms = permessi.data?.permissions ?? [];
  const professioni: Catalogo = {
    chiave: "occupation-classifications", percorso: "/v1/occupation-classifications",
    schemi: OCCUPATION_CLASS_SCHEME_VALUES, dominioEnum: "occupationClassScheme",
    voce: (r) => { const v = r as unknown as OccupationClassification; return { ...v, id: v.occupationClassificationId }; },
    permessi: { leggi: "occupation_classification:read", crea: "occupation_classification:create", correggi: "occupation_classification:update" },
    testId: "catalogo-professioni", titolo: t("tassonomie.professioni"),
  };
  const attivita: Catalogo = {
    chiave: "activity-classifications", percorso: "/v1/activity-classifications",
    // Solo le classificazioni che hanno voci: le altre sigle restano ammesse dal contratto.
    schemi: ACTIVITY_CLASS_SCHEME_VALUES.filter((s) => s === "ATECO_2025" || s === "NACE_REV_2_1"),
    dominioEnum: "activityClassScheme",
    voce: (r) => { const v = r as unknown as ActivityClassification; return { ...v, id: v.activityClassificationId }; },
    permessi: { leggi: "enterprise_typing:read", crea: "enterprise_typing:create", correggi: "enterprise_typing:update" },
    testId: "catalogo-attivita", titolo: t("tassonomie.attivita"),
  };
  return (
    <main data-testid="tassonomie-page" className="mx-auto max-w-6xl space-y-6 px-6 pb-8">
      <PageHeader title={t("tassonomie.titolo")} description={t("tassonomie.descrizionePagina")} />
      {permessi.isLoading && <StatoCaricamento />}
      {permessi.isSuccess && ![professioni.permessi.leggi, attivita.permessi.leggi, "operating_model:read"].some((p) => perms.includes(p)) && (
        <StatoNegato motivo={t("tassonomie.negato")} />
      )}
      {perms.includes(professioni.permessi.leggi) && <CatalogoClassi c={professioni} />}
      {perms.includes(attivita.permessi.leggi) && <CatalogoClassi c={attivita} dettaglio={(v) => <Corrispondenze voce={v} />} />}
      {perms.includes("enterprise_typing:read") && <FasceDimensionali />}
      {perms.includes("operating_model:read") && <ModelliOperativi />}
    </main>
  );
}
