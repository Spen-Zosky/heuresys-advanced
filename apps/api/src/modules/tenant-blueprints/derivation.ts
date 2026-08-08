/**
 * apps/api/src/modules/tenant-blueprints/derivation.ts
 * #131 Tenant Builder P1, T5 — dalla carta d'identita' alla PROPOSTA del
 * modello di settore. Propone: non scrive, non ancora niente (R3).
 *
 * La catena e' questa, e ogni anello puo' rompersi dicendolo:
 *
 *   ATECO --(risalita dell'albero)--> famiglia --(+ fascia)--> variante
 *                                              --(versione PUBLISHED piu' alta)--> modello
 *
 * Quando un anello si rompe la risposta e' `available: false` con la ragione e
 * l'elenco di cio' che invece esiste (R4). **Mai un ripiego sul piu' vicino**:
 * proporre a una compagnia assicurativa il modello di una banca perche' «e'
 * quello che ci somiglia di piu'» e' peggio del non proporre niente, perche' chi
 * legge non ha modo di accorgersene.
 */
import type { Db } from "./repository.js";
import type { BlueprintIdentity, ModelProposalResponse } from "@heuresys/shared";

interface CombinazioneRow {
  famiglia: string;
  fascia: string | null;
  variante: string;
}

/** Le combinazioni che esistono DAVVERO, cioe' con una versione pubblicata. */
async function combinazioniDisponibili(
  db: Db,
): Promise<Array<{ industryFamilyCode: string; sizeBandCode: string; variantCode: string }>> {
  const r = await db.query<CombinazioneRow>(
    `SELECT f.blueprint_family_code AS famiglia,
            b.enterprise_size_band_code AS fascia,
            v.blueprint_variant_code AS variante
       FROM sys.sys_blueprint_variant_versions vv
       JOIN sys.sys_blueprint_variants v
         ON v.blueprint_variant_id = vv.blueprint_variant_version_variant_id
       JOIN sys.sys_blueprint_families f
         ON f.blueprint_family_id = v.blueprint_variant_family_id
       LEFT JOIN sys.sys_enterprise_size_bands b
         ON b.enterprise_size_band_id = v.blueprint_variant_size_band_id
      WHERE vv.blueprint_variant_version_status = 'PUBLISHED'
      GROUP BY 1, 2, 3
      ORDER BY 1, 2, 3`,
  );
  return r.rows.map((x) => ({
    industryFamilyCode: x.famiglia,
    sizeBandCode: x.fascia ?? "—",
    variantCode: x.variante,
  }));
}

export async function proposeModel(
  db: Db,
  identity: BlueprintIdentity,
): Promise<ModelProposalResponse> {
  const mancanti: string[] = [];
  if (!identity.industryClassId) mancanti.push("settore di attivita' (ATECO)");
  if (!identity.sizeBandId) mancanti.push("fascia dimensionale");
  if (mancanti.length > 0) {
    return {
      available: false,
      reason: `La carta d'identita' non basta per proporre un modello: manca ${mancanti.join(" e ")}.`,
      availableCombinations: await combinazioniDisponibili(db),
    };
  }

  const r = await db.query<{
    variant_version_id: string;
    variant_code: string;
    variant_name: string;
    version_number: number;
    process_count: string;
    family_code: string;
    size_band_code: string;
  }>(
    `WITH famiglia AS (
       SELECT sys.sys_blueprint_family_for_activity_class($1::uuid) AS id
     )
     SELECT vv.blueprint_variant_version_id   AS variant_version_id,
            v.blueprint_variant_code          AS variant_code,
            v.blueprint_variant_name          AS variant_name,
            vv.blueprint_variant_version_number AS version_number,
            (SELECT count(*)::text FROM sys.sys_blueprint_process_registry p
              WHERE p.blueprint_process_variant_version_id = vv.blueprint_variant_version_id)
                                              AS process_count,
            f.blueprint_family_code           AS family_code,
            b.enterprise_size_band_code       AS size_band_code
       FROM famiglia
       JOIN sys.sys_blueprint_families f ON f.blueprint_family_id = famiglia.id
       JOIN sys.sys_blueprint_variants v
         ON v.blueprint_variant_family_id = f.blueprint_family_id
        AND v.blueprint_variant_size_band_id = $2::uuid
       JOIN sys.sys_enterprise_size_bands b
         ON b.enterprise_size_band_id = v.blueprint_variant_size_band_id
       JOIN sys.sys_blueprint_variant_versions vv
         ON vv.blueprint_variant_version_variant_id = v.blueprint_variant_id
        AND vv.blueprint_variant_version_status = 'PUBLISHED'
      ORDER BY vv.blueprint_variant_version_number DESC
      LIMIT 1`,
    [identity.industryClassId, identity.sizeBandId],
  );

  const trovato = r.rows[0];
  if (!trovato) {
    // Si distingue fra «il settore non e' coperto da nessuna famiglia» e «la
    // famiglia c'e' ma non ha un modello per quella dimensione»: sono due
    // situazioni diverse e chi legge deve poterle distinguere per rimediare.
    const fam = await db.query<{ code: string | null }>(
      `SELECT f.blueprint_family_code AS code
         FROM sys.sys_blueprint_families f
        WHERE f.blueprint_family_id = sys.sys_blueprint_family_for_activity_class($1::uuid)`,
      [identity.industryClassId],
    );
    const famiglia = fam.rows[0]?.code ?? null;
    return {
      available: false,
      reason: famiglia
        ? `Per il settore indicato esiste la famiglia di modelli «${famiglia}», ma nessun modello pubblicato per questa fascia dimensionale.`
        : "Nessuna famiglia di modelli copre il settore di attivita' indicato.",
      availableCombinations: await combinazioniDisponibili(db),
    };
  }

  return {
    available: true,
    variantVersionId: trovato.variant_version_id,
    variantCode: trovato.variant_code,
    variantName: trovato.variant_name,
    versionNumber: trovato.version_number,
    processCount: Number(trovato.process_count),
    matchedOn: {
      industryFamilyCode: trovato.family_code,
      sizeBandCode: trovato.size_band_code,
    },
  };
}

/** La versione di modello indicata esiste ed e' pubblicata? */
export async function isPublishedVariantVersion(db: Db, id: string): Promise<boolean> {
  const r = await db.query<{ ok: boolean }>(
    `SELECT true AS ok FROM sys.sys_blueprint_variant_versions
      WHERE blueprint_variant_version_id = $1
        AND blueprint_variant_version_status = 'PUBLISHED'`,
    [id],
  );
  return r.rows.length === 1;
}
