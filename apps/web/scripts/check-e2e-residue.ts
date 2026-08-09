/**
 * Z-112 — lo stesso assert che chiude la suite E2E, lanciabile da solo:
 *
 *     cd apps/web && pnpm e2e:residue-check
 *
 * Esce 0 se il DB condiviso e' pulito, 1 se resta residuo — o se non riesce a
 * contarlo, perche' un controllo che passa quando non ha potuto guardare non e'
 * un controllo. Serve a due cose: verificare lo stato senza far girare 97 spec,
 * e poter dimostrare che il rosso esiste (semina una riga, rilancia, guarda 1).
 */
import { assertNoResidue } from "../tests/e2e/e2e-residue";

try {
  assertNoResidue();
  process.exit(0);
} catch (err) {
  console.error((err as Error).message);
  process.exit(1);
}
