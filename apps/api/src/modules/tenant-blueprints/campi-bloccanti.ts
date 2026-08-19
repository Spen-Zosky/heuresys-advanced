/**
 * apps/api/src/modules/tenant-blueprints/campi-bloccanti.ts
 *
 * `BLUEPRINT_FIELD_LOCKED` — il debito `D-85` (fino a S1074 numerato `D-81`) si estingue qui (#132 F4f).
 *
 * PERCHE' NON ERA SCRIVIBILE PRIMA, ed e' scritto nel register: la guardia non poteva
 * esistere finche' non esisteva **un attore capace di violarla**. In P1 il fascicolo lo
 * compila il proprietario della piattaforma, che i campi bloccanti li puo' cambiare per
 * definizione; il cliente non tocca niente. L'attore arriva adesso, con la ricerca: `F6`
 * applichera' al fascicolo delle proposte nate da pagine web, e una proposta **non puo'
 * cambiare che azienda e' il cliente**.
 *
 * LA CLASSIFICAZIONE E' QUELLA DELL'EPICA P1 §4.8 (decisione E9), e non si riprogetta:
 *
 * | Classe | Cosa comprende | Chi la cambia |
 * |---|---|---|
 * | **Bloccanti** | cio' che definisce *che azienda e'*: classificazione ATECO, famiglia di settore, modello di settore ancorato | solo il proprietario della piattaforma |
 * | **Rivedibili dal consulente** | il resto dell'identita' e le decisioni sui processi | solo il proprietario della piattaforma |
 * | **Rivedibili dal cliente** | organizzazione e risorse proprie (strati 3 e 4) | il cliente, **aprendo una nuova versione** |
 *
 * ⚠ IL RIFIUTO DICE **QUALE** CAMPO E **PERCHE'** E' BLOCCANTE. Un diniego generico
 * costringerebbe chi lo riceve a indovinare, e chi lo riceve puo' essere un programma.
 */
import type { BlueprintIdentity, PatchIdentityBody } from "@heuresys/shared";

/**
 * Da dove arriva la modifica. Non e' il **permesso** (quello e' RBAC): e' *chi sta agendo*,
 * e i due non coincidono — la ricerca agisce con le credenziali di un umano che ha tutti i
 * permessi, ed e' proprio per questo che serve una distinzione a parte.
 */
export type OrigineModifica = "PLATFORM" | "CLIENTE" | "RICERCA";

export const CAMPI_BLOCCANTI: ReadonlyArray<{
  campo: keyof BlueprintIdentity | "variantVersionId";
  etichetta: string;
  perche: string;
}> = [
  {
    campo: "industryClassId",
    etichetta: "settore di attivita' (ATECO)",
    perche:
      "definisce che azienda e': da qui discendono la famiglia di settore, il modello ancorato e ogni derivazione a valle. Un'azienda non cambia mestiere con una modifica di campo.",
  },
  {
    campo: "variantVersionId",
    etichetta: "modello di settore ancorato",
    perche:
      "e' la fotografia del modello su cui il fascicolo e' stato approvato: cambiarla farebbe discendere le decisioni gia' prese da un modello diverso da quello che le ha prodotte.",
  },
];

export interface ViolazioneCampoBloccante {
  campo: string;
  etichetta: string;
  perche: string;
  da: unknown;
  a: unknown;
}

/**
 * Quali campi bloccanti questa modifica cambierebbe, e non le e' consentito cambiare.
 *
 * `PLATFORM` li puo' cambiare: e' il proprietario della piattaforma, ed e' esattamente
 * quello che l'epica dice. `CLIENTE` e `RICERCA` no, mai — e il caso della ricerca e' quello
 * che rende la guardia necessaria oggi.
 *
 * ⚠ Si confronta il **valore risultante**, non la presenza del campo nella richiesta:
 * riscrivere lo stesso ATECO non e' un cambiamento, e rifiutarlo sarebbe un allarme falso.
 */
export function violazioniCampiBloccanti(
  precedente: Pick<BlueprintIdentity, "industryClassId"> & { variantVersionId?: string | null },
  richiesta: Partial<PatchIdentityBody> & { variantVersionId?: string | null },
  origine: OrigineModifica,
): ViolazioneCampoBloccante[] {
  if (origine === "PLATFORM") return [];

  const violazioni: ViolazioneCampoBloccante[] = [];
  for (const b of CAMPI_BLOCCANTI) {
    const chiave = b.campo as string;
    if (!(chiave in richiesta)) continue;
    const nuovo = (richiesta as Record<string, unknown>)[chiave];
    if (nuovo === undefined) continue;
    const vecchio = (precedente as Record<string, unknown>)[chiave] ?? null;
    if ((nuovo ?? null) === vecchio) continue;
    violazioni.push({ campo: chiave, etichetta: b.etichetta, perche: b.perche, da: vecchio, a: nuovo });
  }
  return violazioni;
}

/** Il messaggio, che nomina i campi e spiega. Separato per poterlo provare da solo. */
export function messaggioCampiBloccati(v: readonly ViolazioneCampoBloccante[], origine: OrigineModifica): string {
  const chi = origine === "RICERCA" ? "Una proposta della ricerca" : "Il cliente";
  return (
    `${chi} non puo' cambiare ` +
    v.map((x) => `«${x.etichetta}» (${x.campo}): ${x.perche}`).join(" · ")
  );
}
