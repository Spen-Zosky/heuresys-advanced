"use client";

import { useSyncExternalStore, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import { AvvisoBozzaConsolidamento } from "@/components/avviso-bozza-consolidamento";
import {
  Button,
  CommandPalette,
  DashboardShell,
  DashboardHeader,
  DashboardSidebar,
  DashboardFooter,
  HeuresysWordmark,
  HeuresysLogoBadge,
  type NavGroup,
  type UserIdentity,
} from "@heuresys/ui";
import {
  Activity,
  Award,
  BadgeCheck,
  Blocks,
  BookMarked,
  BookOpen,
  Briefcase,
  BriefcaseBusiness,
  Building,
  Building2,
  CalendarDays,
  ChartColumn,
  ChartNoAxesCombined,
  ChartPie,
  CheckCheck,
  Circle,
  ClipboardCheck,
  ClipboardList,
  Clock,
  Coins,
  Compass,
  Contact,
  Crosshair,
  Database,
  DatabaseZap,
  FileStack,
  FileText,
  Fingerprint,
  Flag,
  FolderKanban,
  Gauge,
  GitBranch,
  GitMerge,
  GraduationCap,
  Grid3x3,
  Handshake,
  HeartPulse,
  House,
  Inbox,
  KeyRound,
  Landmark,
  Layers,
  LayoutDashboard,
  Library,
  Lightbulb,
  Megaphone,
  MessageSquareHeart,
  Network,
  Newspaper,
  PieChart,
  Puzzle,
  Radar,
  Route,
  ScrollText,
  ServerCog,
  Shapes,
  Shield,
  ShieldCheck,
  Sprout,
  Star,
  Store,
  Target,
  Telescope,
  TrendingUp,
  TriangleAlert,
  User,
  UserCog,
  UserPlus,
  Users,
  UsersRound,
  Workflow,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { useCurrentUser, useLogout, useMyInterfaces, useUpdateMyPreferences } from "../../lib/api/auth";
import { isApiError, SessionExpiredError } from "../../lib/api/errors";
import { setLocale } from "../../lib/i18n";
import { primaryRoleOf } from "../../lib/role-precedence";
import { cognomeNome } from "../../lib/person-label";
import { PreferencesApplier } from "../../components/preferences-applier";
import { StepUpDialog } from "../../components/step-up-dialog";
import { SectionTabs, SECTION_TAB_GROUPS } from "../../components/section-tabs";
import { pageVerdict } from "../../lib/page-guard";
import { PannelloAgente } from "../../components/pannello-agente";
import { ContestoAgenteProvider } from "../../lib/agente/contesto";
import { SchedeProvider } from "@/components/scheda-rapida";
import { CorpoGruppo, useScorrimentoMenu } from "../../components/menu-laterale";
import { ReteDiPagina } from "../../lib/leggibile";
import { alberoDelGruppo, ramoDi, type VoceMenu } from "../../lib/menu-albero";

const ICON = "h-4 w-4 shrink-0";

/**
 * Registry icon name (sys_ui_interfaces.icon) → lucide node. Every icon the registry uses
 * must be here (mig. 000484 dichiara le icone di tutte le voci); a name that is missing
 * falls back to FALLBACK_ICON, so no sidebar entry is ever drawn without an icon.
 */
const ICON_MAP: Record<string, ReactNode> = {
  Activity: <Activity className={ICON} />,
  Award: <Award className={ICON} />,
  BadgeCheck: <BadgeCheck className={ICON} />,
  Blocks: <Blocks className={ICON} />,
  BookMarked: <BookMarked className={ICON} />,
  BookOpen: <BookOpen className={ICON} />,
  Briefcase: <Briefcase className={ICON} />,
  BriefcaseBusiness: <BriefcaseBusiness className={ICON} />,
  Building: <Building className={ICON} />,
  Building2: <Building2 className={ICON} />,
  CalendarDays: <CalendarDays className={ICON} />,
  ChartColumn: <ChartColumn className={ICON} />,
  ChartNoAxesCombined: <ChartNoAxesCombined className={ICON} />,
  ChartPie: <ChartPie className={ICON} />,
  CheckCheck: <CheckCheck className={ICON} />,
  ClipboardCheck: <ClipboardCheck className={ICON} />,
  ClipboardList: <ClipboardList className={ICON} />,
  Clock: <Clock className={ICON} />,
  Coins: <Coins className={ICON} />,
  Compass: <Compass className={ICON} />,
  Contact: <Contact className={ICON} />,
  Crosshair: <Crosshair className={ICON} />,
  Database: <Database className={ICON} />,
  DatabaseZap: <DatabaseZap className={ICON} />,
  FileStack: <FileStack className={ICON} />,
  FileText: <FileText className={ICON} />,
  Fingerprint: <Fingerprint className={ICON} />,
  Flag: <Flag className={ICON} />,
  FolderKanban: <FolderKanban className={ICON} />,
  Gauge: <Gauge className={ICON} />,
  GitBranch: <GitBranch className={ICON} />,
  GitMerge: <GitMerge className={ICON} />,
  GraduationCap: <GraduationCap className={ICON} />,
  Grid3x3: <Grid3x3 className={ICON} />,
  Handshake: <Handshake className={ICON} />,
  HeartPulse: <HeartPulse className={ICON} />,
  House: <House className={ICON} />,
  Inbox: <Inbox className={ICON} />,
  KeyRound: <KeyRound className={ICON} />,
  Landmark: <Landmark className={ICON} />,
  Layers: <Layers className={ICON} />,
  LayoutDashboard: <LayoutDashboard className={ICON} />,
  Library: <Library className={ICON} />,
  Lightbulb: <Lightbulb className={ICON} />,
  Megaphone: <Megaphone className={ICON} />,
  MessageSquareHeart: <MessageSquareHeart className={ICON} />,
  Network: <Network className={ICON} />,
  Newspaper: <Newspaper className={ICON} />,
  PieChart: <PieChart className={ICON} />,
  Puzzle: <Puzzle className={ICON} />,
  Radar: <Radar className={ICON} />,
  Route: <Route className={ICON} />,
  ScrollText: <ScrollText className={ICON} />,
  ServerCog: <ServerCog className={ICON} />,
  Shapes: <Shapes className={ICON} />,
  Shield: <Shield className={ICON} />,
  ShieldCheck: <ShieldCheck className={ICON} />,
  Sprout: <Sprout className={ICON} />,
  Star: <Star className={ICON} />,
  Store: <Store className={ICON} />,
  Target: <Target className={ICON} />,
  Telescope: <Telescope className={ICON} />,
  TrendingUp: <TrendingUp className={ICON} />,
  TriangleAlert: <TriangleAlert className={ICON} />,
  User: <User className={ICON} />,
  UserCog: <UserCog className={ICON} />,
  UserPlus: <UserPlus className={ICON} />,
  Users: <Users className={ICON} />,
  UsersRound: <UsersRound className={ICON} />,
  Workflow: <Workflow className={ICON} />,
};

/** Shown when an entry declares no icon, or one this map does not know yet. */
const FALLBACK_ICON = <Circle className={ICON} />;

/** The 4 nav items the E2E suite targets by stable test-id. */
const NAV_TESTID: Record<string, string> = {
  dashboard: "nav-dashboard",
  "me-home": "nav-me",
  positions: "nav-positions",
  users: "nav-users",
};


const nienteDaAscoltare = () => () => {};

export default function AuthenticatedLayout({ children }: { children: ReactNode }) {
  const router = useRouter();
  const { t, i18n } = useTranslation();
  const pathname = usePathname() ?? "";
  const me = useCurrentUser();
  const ifaces = useMyInterfaces();
  const logout = useLogout();
  const updatePrefs = useUpdateMyPreferences();
  // C14, React #418 su quasi ogni pagina (giro 11/11): identità, menu e permessi partono dalla
  // copia della scheda (sessionStorage, V-12), che il server non vede. Il server disegnava
  // «Caricamento», il primo disegno del client la pagina intera: HTML diverso, idratazione
  // rifiutata. Finché l'idratazione non è finita si disegna ciò che ha disegnato il server.
  const idratato = useSyncExternalStore(nienteDaAscoltare, () => true, () => false);
  useScorrimentoMenu(pathname, idratato && !!me.data && !!ifaces.data);

  if (!idratato || me.isLoading || ifaces.isLoading) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <span data-testid="app-loading" className="text-sm text-muted-foreground">{t("loading")}</span>
      </main>
    );
  }
  if (me.isError) {
    if (me.error instanceof SessionExpiredError || (isApiError(me.error) && me.error.status === 401)) {
      router.replace("/login");
      return null;
    }
    return (
      <main className="min-h-screen flex items-center justify-center">
        <span data-testid="app-error" className="text-sm text-danger">
          {me.error instanceof Error ? me.error.message : t("shell:session.error")}
        </span>
      </main>
    );
  }
  const user = me.data;
  if (!user) {
    router.replace("/login");
    return null;
  }

  // S-1: senza il registro la guardia non può decidere, e una pagina aperta alla cieca è
  // proprio il difetto che la guardia toglie. Si mostra l'errore, non la pagina.
  if (ifaces.isError) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <span data-testid="app-error" className="text-sm text-danger">{t("shell:session.error")}</span>
      </main>
    );
  }

  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`);

  // Build the sidebar from the DB-driven registry (GET /v1/me/interfaces). Server-side gating
  // means we render exactly what is returned. Mig. 000484 groups the entries BY FUNCTION:
  // `sidebarGroup` is the functional group (Dashboard, Organizzazione, Persone, …, and the four
  // groups of the personal area) and is the only thing that shapes the menu. The section
  // (`perspective`) is semantic — PERSONAL is the ESS floor of I17 — and does not decide the
  // order: groups are sorted by the smallest `order` of their entries, which the registry
  // declares in blocks of 100 per group. Every group is collapsible (DashboardSidebar keeps
  // the open/closed state per group id).
  const sections = ifaces.data?.perspectives ?? [];
  // Una voce sola accesa: la rotta piu' lunga che contiene la pagina. Con la sola regola del
  // prefisso «/dashboard» restava accesa anche su «/dashboard/company», insieme alla sua voce.
  const allRoutes = sections.flatMap((s) => s.interfaces.map((i) => i.route));
  const activeRoute = allRoutes
    .filter((r) => isActive(r))
    .reduce<string | null>((best, r) => (best === null || r.length > best.length ? r : best), null);

  // C6 (piano interfaccia sistematica): voci con Link di Next e rami più profondi, vedi
  // components/menu-laterale.tsx e lib/menu-albero.ts. I gruppi di primo livello restano quelli
  // del registro (000484), nell'ordine del registro; i gruppi personali si fondono in uno.
  const byGroup = new Map<string, Array<VoceMenu & { ramo: string[] }>>();
  for (const section of sections) {
    for (const i of section.interfaces) {
      const { gruppo, ramo } = ramoDi(i.route, i.sidebarGroup);
      // Il registro delle interfacce porta le etichette in italiano: in inglese si traducono per
      // rotta (`shell:nav.voci.<rotta>`); una rotta senza traduzione tiene l'etichetta del registro.
      const etichetta = i18n.language === "en"
        ? t(`shell:nav.voci.${i.route.replace(/^\//, "").replace(/\//g, "_")}`, { defaultValue: i.label })
        : i.label;
      const voce = { id: i.code, label: etichetta, href: i.route, icona: i.icon ?? null, ordine: i.order, ramo, ...(NAV_TESTID[i.code] ? { testId: NAV_TESTID[i.code] } : {}) };
      const arr = byGroup.get(gruppo);
      if (arr) arr.push(voce);
      else byGroup.set(gruppo, [voce]);
    }
  }
  const minOrder = (items: Array<{ ordine: number }>) => Math.min(...items.map((i) => i.ordine));
  const iconaDi = (v: VoceMenu) => ICON_MAP[v.icona ?? ""] ?? FALLBACK_ICON;
  const groups: NavGroup[] = [...byGroup.entries()]
    .sort(([, a], [, b]) => minOrder(a) - minOrder(b))
    .map(([sub, items]) => ({
      id: `nav-${sub}`,
      label: t(`shell:nav.groups.${sub === "me" ? "me_area" : sub}`, { defaultValue: sub }),
      customContent: <CorpoGruppo id={`nav-${sub}`} albero={alberoDelGruppo(items)} attiva={activeRoute} icone={iconaDi} />,
    }));

  // D1 (giro qa-web 18/11): la ricerca in alto (Ctrl+K) si apriva su «Nessun comando configurato». Ora offre le
  // pagine a cui la persona ha accesso, le stesse del menu laterale (il registro già filtra per mandato), con
  // l'etichetta del menu nella lingua scelta e raggruppate come nel menu.
  const contenutoPalette = [...byGroup.entries()]
    .sort(([, a], [, b]) => minOrder(a) - minOrder(b))
    .map(([sub, items]) => (
      <CommandPalette.Group key={`pal-${sub}`} heading={t(`shell:nav.groups.${sub === "me" ? "me_area" : sub}`, { defaultValue: sub })}>
        {[...items].sort((a, b) => a.ordine - b.ordine).map((v) => (
          <CommandPalette.Item
            key={v.id}
            value={`${typeof v.label === "string" ? v.label : v.id} ${v.id}`}
            onSelect={() => router.push(v.href)}
          >
            {v.label}
          </CommandPalette.Item>
        ))}
      </CommandPalette.Group>
    ));

  const verdict = pageVerdict(pathname, ifaces.data?.routes ?? [], SECTION_TAB_GROUPS);
  // La pagina negata si nomina a parole (la voce di menu), mai col percorso tecnico.
  const nomePaginaNegata =
    verdict.kind === "denied"
      ? t(`shell:nav.voci.${verdict.route.replace(/^\//, "").replace(/\//g, "_")}`, { defaultValue: "" })
      : "";

  const roles = user.roles ?? [];
  // S-22 (INC-16): il tono dell'etichetta non viene più da una lista di sette ruoli scritta
  // qui (che non conosceva i ruoli nati col mandato K), ma dal dato: chi ha nel menu almeno
  // una voce fuori dall'area personale ha un lavoro che va oltre il proprio record.
  const hasAdminRole = sections.some((s) => s.code !== "PERSONAL" && s.interfaces.length > 0);
  // S-01 (forense 15/11): la persona si scrive «Cognome, Nome» (R1); l'email solo se il nome manca.
  const nomeCompleto = cognomeNome({
    displayName: user.displayName?.trim() || null,
    firstName: user.firstName ?? null,
    lastName: user.lastName ?? null,
  }).trim();
  const displayName = nomeCompleto || user.email;
  const initials = (
    user.firstName?.trim() && user.lastName?.trim()
      ? `${user.firstName.trim().charAt(0)}${user.lastName.trim().charAt(0)}`
      : nomeCompleto
        ? nomeCompleto.split(/[\s,]+/).filter(Boolean).map((w) => w.charAt(0)).join("").slice(0, 2)
        : user.email.slice(0, 2)
  ).toUpperCase();
  // Non `roles[0]`: l'ordine con cui l'API restituisce i ruoli e' arbitrario, e
  // con l'invariante I17 (chiunque e' almeno USER) un'amministratrice di tenant
  // finiva presentata come «Dipendente» — vedi lib/role-precedence.ts.
  const primaryRole = primaryRoleOf(roles);
  const identity: UserIdentity = {
    initials,
    username: displayName,
    // label umana, mai il codice RBAC raw (census F4 S1025: 'PLATFORM_ADMIN'
    // renderizzato su ogni pagina admin)
    role: t(`shell:roles.${primaryRole}`, { defaultValue: primaryRole }),
    roleTone: hasAdminRole ? "info" : "warning",
  };

  async function handleLogout() {
    await logout.mutateAsync();
    router.replace("/login");
  }

  // Language lives in the HEADER (S1009): one toggle IT↔EN, persisted to sys_user_preferences
  // (server source of truth) so the choice follows the user across pages and devices. The cookie
  // covers same-device reloads; PreferencesApplier re-applies the server locale on a fresh device.
  function handleToggleLanguage() {
    const next = i18n.language === "it" ? "en" : "it";
    setLocale(next);
    updatePrefs.mutate({ locale: next });
  }

  return (
    <DashboardShell
      contentLabel={t("shell:ui.content")}
      header={
        <DashboardHeader
          user={identity}
          language={i18n.language === "en" ? "EN" : "IT"}
          onToggleLanguage={handleToggleLanguage}
          labels={{
            menu: t("shell:ui.menuOpen"),
            breadcrumb: t("shell:ui.breadcrumb"),
            theme: t("shell:ui.theme"),
            language: (lang) => t("shell:ui.languageSwitch", { lang }),
            userMenu: (username) => t("shell:ui.userMenu", { username }),
            commandPalettePlaceholder: t("shell:ui.paletteSearch"),
            commandPaletteEmpty: t("shell:ui.paletteEmpty"),
            drawerTitle: t("shell:ui.drawerTitle"),
            drawerClose: t("shell:ui.drawerClose"),
          }}
          commandPaletteContent={contenutoPalette}
          logo={<HeuresysWordmark variant="brand" size={24} />}
          // F-6 (L7): il collegamento del marchio ha già il suo nome accessibile («Heuresys —
          // pagina iniziale autenticata»); il distintivo «advanced» visibile ma fuori da quel
          // nome è la violazione `label-content-name-mismatch` misurata su 97 pagine. È
          // decorativo: si nasconde ai lettori di schermo invece di cambiare il nome.
          logoBadge={<HeuresysLogoBadge aria-hidden="true">{t("shell:brand.badge")}</HeuresysLogoBadge>}
          rightExtras={<AvvisoBozzaConsolidamento abilitato={(ifaces.data?.routes ?? []).some((r) => r.route === "/consolidation" && r.allowed)} />}
        />
      }
      sidebar={
        <DashboardSidebar
          groups={groups}
          title={t("shell:ui.navigation")}
          ariaLabel={t("shell:ui.navigationAria")}
          toggleLabel={t("shell:ui.toggleSidebar")}
          footerSlot={
            <div className="space-y-2 border-t border-border px-3 py-3">
              <p data-testid="app-user-email" title={user.email} className="truncate text-xs text-muted-foreground">
                {user.email}
              </p>
              <Button
                variant="outline"
                size="sm"
                data-testid="app-logout"
                className="w-full"
                onClick={handleLogout}
              >
                {t("shell:logout")}
              </Button>
            </div>
          }
        />
      }
      footer={
        <DashboardFooter
          // Nessun indirizzo reale dei profili social di Heuresys esiste nel repo: finché Enzo non li
          // fornisce non si passa nessuna icona (mai `href="#"`, che apriva una scheda sulla stessa
          // pagina). Per riaccenderle: elenco di { id, href, label } con l'indirizzo vero.
          socials={[]}
          websiteLabel={t("shell:ui.website")}
          rightSlot={
            <span className="inline-flex items-center gap-3 text-xs">
              <span>{t("shell:brand.version")}</span>
              <span aria-hidden className="text-border">·</span>
              <span>{identity.role}</span>
              <span aria-hidden className="text-border">·</span>
              <Link href="/accessibilita" data-testid="app-footer-accessibility" className="underline-offset-2 hover:underline">
                {t("shell:brand.accessibility")}
              </Link>
            </span>
          }
        />
      }
    >
      {/* WS-4 P1: apply the user's server-stored theme + palette + locale (source of truth) once
          the session is known. Renders nothing. */}
      <PreferencesApplier />
      <StepUpDialog />
      {/* S1009: in-page tab bar for the 6 merge groups; renders nothing off those routes. */}
      {verdict.kind === "denied" ? (
        <main data-testid="page-no-access" className="mx-auto max-w-2xl space-y-4 px-6 py-10">
          <header className="space-y-1">
            <h1 className="text-2xl font-bold tracking-tight">{t("shell:noAccess.title")}</h1>
            <p className="text-sm text-muted-foreground">{nomePaginaNegata ? t("shell:noAccess.body", { pagina: nomePaginaNegata }) : t("shell:noAccess.bodyGenerico")}</p>
          </header>
          <Button variant="outline" size="sm" onClick={() => router.push("/me")}>
            {t("shell:noAccess.home")}
          </Button>
        </main>
      ) : (
        <ContestoAgenteProvider>
          <SchedeProvider>
          <SectionTabs />
          {/* L10 A-8: il pannello dell'agente, solo sulle pagine idonee e solo a flag acceso. */}
          <PannelloAgente />
          <ReteDiPagina>{children}</ReteDiPagina>
          </SchedeProvider>
        </ContestoAgenteProvider>
      )}
    </DashboardShell>
  );
}
