/**
 * apps/web/src/lib/page-guard.ts
 *
 * S-1 del piano interfacce (docs/piani/PIANO_interfacce_20261103.md): la guardia di pagina.
 *
 * Fino a qui il proxy controllava solo che esistesse il cookie di sessione, quindi chi
 * digitava l'indirizzo di una pagina non sua la vedeva a metà, con i riquadri vuoti e gli
 * errori 403 delle chiamate negate (V2 INC-05, INC-09; V4 D-15..D-17). Ora il layout chiede a
 * questa funzione se la pagina corrente si può aprire, con la stessa regola del menu
 * (`GET /v1/me/interfaces`, campo `routes`).
 *
 * La regola: vince la rotta del registro più lunga che contiene l'indirizzo, con il confine
 * di segmento (`/analytics/skills` non contiene `/analytics/skills-by-category`). Se più righe
 * hanno la stessa rotta, basta che una sia aperta. Le schede di sezione che non hanno una riga
 * propria seguono la pagina principale del loro gruppo. Un indirizzo che il registro non
 * conosce resta aperto: la guardia nega solo ciò che il registro dichiara negato, e l'API resta
 * l'autorità su ogni dato.
 */

export interface RouteAccess {
  route: string;
  allowed: boolean;
}

export type PageVerdict =
  | { kind: "allowed"; route: string | null }
  | { kind: "denied"; route: string };

/** true se `pathname` è `route` o una sua sotto-pagina, con il confine di segmento. */
export function routeContains(route: string, pathname: string): boolean {
  if (route === "/") return pathname === "/";
  return pathname === route || pathname.startsWith(`${route}/`);
}

function normalize(pathname: string): string {
  // D-25: `/mfa-policy/` e `/mfa-policy` sono la stessa pagina.
  if (pathname.length > 1 && pathname.endsWith("/")) return pathname.replace(/\/+$/, "") || "/";
  return pathname;
}

function bestMatch(pathname: string, routes: ReadonlyArray<RouteAccess>): PageVerdict | null {
  let best: string | null = null;
  for (const r of routes) {
    if (!routeContains(r.route, pathname)) continue;
    if (best === null || r.route.length > best.length) best = r.route;
  }
  if (best === null) return null;
  const allowed = routes.some((r) => r.route === best && r.allowed);
  return allowed ? { kind: "allowed", route: best } : { kind: "denied", route: best };
}

/**
 * Verdetto per la pagina corrente.
 *
 * @param tabGroups gruppi di schede di sezione (prima scheda = pagina principale): una scheda
 *   senza riga propria nel registro segue la pagina principale del suo gruppo.
 */
export function pageVerdict(
  rawPathname: string,
  routes: ReadonlyArray<RouteAccess>,
  tabGroups: ReadonlyArray<ReadonlyArray<string>> = [],
  schede?: PermessiDelleSchede,
): PageVerdict {
  const pathname = normalize(rawPathname);
  const direct = bestMatch(pathname, routes);
  if (direct !== null) return direct;
  for (const tabs of tabGroups) {
    const main = tabs[0];
    if (main === undefined) continue;
    const scheda = schedaPiuLunga(tabs, pathname);
    if (scheda === null) continue;
    const viaMain = bestMatch(main, routes);
    if (viaMain === null) continue;
    if (viaMain.kind === "denied") return { kind: "denied", route: main };
    // K30 (forense 23/11): una scheda con un permesso suo segue la pagina principale solo se la
    // persona ha anche quel permesso; altrimenti la pagina si apriva e le sue letture finivano
    // in 403 (/mentorship per il CEO). Con i permessi non ancora noti decide l'API, come prima.
    const permesso = schede?.permessoDi(scheda) ?? null;
    if (permesso !== null && schede?.permessi && !schede.permessi.includes(permesso)) {
      return { kind: "denied", route: scheda };
    }
    return viaMain;
  }
  return { kind: "allowed", route: null };
}

/** I permessi della persona e il permesso che ogni scheda chiede (null: segue la principale). */
export interface PermessiDelleSchede {
  /** null finché non sono caricati: allora non si nega niente in più. */
  permessi: ReadonlyArray<string> | null;
  permessoDi: (href: string) => string | null;
}

function schedaPiuLunga(hrefs: ReadonlyArray<string>, pathname: string): string | null {
  let best: string | null = null;
  for (const h of hrefs) {
    if (routeContains(h, pathname) && (best === null || h.length > best.length)) best = h;
  }
  return best;
}

const chiaveVoce = (route: string) => `shell:nav.voci.${route.replace(/^\//, "").replace(/\//g, "_")}`;

/**
 * K29 (forense 23/11): le chiavi i18n con cui nominare una pagina negata, in ordine di
 * preferenza. Prima la voce di menu della pagina richiesta, poi l'etichetta della sua scheda;
 * la rotta del verdetto solo se contiene la pagina richiesta. Prima la si usava sempre, e la
 * scheda /admin/gdpr negata insieme alla sua principale si presentava come «Registro di
 * provenienza». Se nessuna chiave ha un testo, la pagina usa la frase generica.
 */
export function chiaviNomePaginaNegata(
  rawPathname: string,
  verdict: PageVerdict,
  schede: ReadonlyArray<{ href: string; key: string }>,
): string[] {
  const pathname = normalize(rawPathname);
  const chiavi = [chiaveVoce(pathname)];
  const scheda = schedaPiuLunga(schede.map((s) => s.href), pathname);
  const chiaveScheda = schede.find((s) => s.href === scheda)?.key;
  if (chiaveScheda !== undefined) chiavi.push(`shell:tabs.${chiaveScheda}`);
  if (verdict.route !== null && routeContains(verdict.route, pathname)) chiavi.push(chiaveVoce(verdict.route));
  return chiavi;
}
