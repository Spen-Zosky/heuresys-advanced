/**
 * apps/api/src/modules/projects/service.ts
 * `#143` F4 — i progetti come entita' del lavoro, con l'asse funzionale a decidere chi vede.
 *
 * ⭐ IL CONFINE I18, che e' la ragione per cui questo modulo esiste in questa forma.
 * «Functional (team/process) membership NEVER unlocks sensitive data» — l'autorita' di un
 * capo progetto e' SUL LAVORO, NON SULLE PERSONE. Qui dentro significa, alla lettera:
 *   · un capo progetto vede il progetto, i suoi membri e i loro RUOLI;
 *   · di quelle persone vede l'anagrafica minima (nome, email) e nient'altro;
 *   · retribuzione, valutazioni, dati personali e competenze NON passano da qui — restano
 *     alla catena organizzativa (I18, I19), che questo modulo non tocca e non estende.
 * Non e' una funzionalita' rimandata: e' il confine. Aggiungere qui una lettura sensibile
 * sarebbe aggirare ADR-0036 dal lato funzionale.
 *
 * Scope di lettura (I5 = FK + filtro nel middleware, MAI RLS):
 *   · PLATFORM_ADMIN            → tutti i progetti, cross-tenant;
 *   · mandato HR (tenant/all)   → tutti i progetti del proprio tenant;
 *   · chiunque altro            → i soli progetti a cui partecipa ADESSO.
 * La vista piena si chiede a `resolveActivityScope`, non a una lista di ruoli locale: e'
 * la lezione di `#99` F3 e di S1091 su `teams` — due assi decisi in due posti che non si
 * parlano finiscono per divergere.
 */
import { pool, withTransaction } from "../../db/client.js";
import { isPlatform, type ActorContext } from "../../lib/actor.js";
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from "../../errors/index.js";
import type {
  Project,
  ProjectCreateBody,
  ProjectDetail,
  ProjectListQuery,
  ProjectMemberUpsertBody,
  ProjectProgressBody,
  ProjectUpdateBody,
} from "@heuresys/shared";
import type {
  ProjectDependencyCreateBody,
  ProjectPhaseCreateBody,
  ProjectPhaseUpdateBody,
  ProjectScheda,
} from "@heuresys/shared";
import { resolveActivityScope } from "../../lib/scope/resolver.js";
import * as repo from "./repository.js";
import * as piano from "./piano.js";
import * as processi from "../processes/repository.js";

/** Vista piena sui progetti del tenant, dall'asse FUNZIONALE.
 *  `all` = piattaforma, `tenant` = mandato HR. Un ruolo manageriale che non guida nulla
 *  vede i propri progetti e basta: guidare e' il titolo, il grado no. */
async function haVistaPiena(a: ActorContext): Promise<boolean> {
  const scope = await resolveActivityScope(pool, a);
  return scope.kind === "all" || scope.kind === "tenant";
}

function requireOwnTenant(a: ActorContext): string {
  if (!a.tenantId) throw new ForbiddenError("Tenant context required");
  return a.tenantId;
}

/** Il progetto, se questa persona ha titolo per vederlo. Fuori scope torna **404 e non 403**:
 *  un 403 direbbe «esiste ma non e' tuo», che di per se' e' un'informazione oltre il confine. */
async function progettoVisibile(a: ActorContext, id: string): Promise<Project> {
  const p = await repo.findProjectById(pool, id);
  if (!p) throw new NotFoundError("Project");
  if (isPlatform(a)) return p;
  if (!a.tenantId || p.tenantId !== a.tenantId) throw new NotFoundError("Project");
  if (await haVistaPiena(a)) return p;
  if (!(await repo.userInProject(pool, id, a.userId))) throw new NotFoundError("Project");
  return p;
}

/** Chi puo' TOCCARE il progetto: il mandato, oppure chi lo guida adesso.
 *  Il permesso `project:manage` dice *se* si puo' gestire un progetto; questo dice *quale*.
 *  Nega con `PERMISSION_DENIED`, non `FORBIDDEN`: il permesso c'e', e' lo scope che manca
 *  (pattern dei moduli, la tabella dei due livelli di diniego). */
async function puoGestire(a: ActorContext, id: string): Promise<void> {
  if (isPlatform(a) || (await haVistaPiena(a))) return;
  if (await repo.userLeadsProject(pool, id, a.userId)) return;
  throw new ForbiddenError("Non guidi questo progetto", "PERMISSION_DENIED");
}

export const projectsService = {
  async list(a: ActorContext, q: ProjectListQuery): Promise<{ items: Project[]; total: number }> {
    const tenantId = isPlatform(a) ? undefined : requireOwnTenant(a);
    const memberUserId = (await haVistaPiena(a)) ? undefined : a.userId;
    return repo.listProjects(pool, {
      ...(tenantId !== undefined ? { tenantId } : {}),
      ...(memberUserId !== undefined ? { memberUserId } : {}),
      ...(q.status !== undefined ? { status: q.status } : {}),
      ...(q.current !== undefined ? { current: q.current } : {}),
      limit: q.limit,
      offset: q.offset,
    });
  },

  /** Il progetto con i suoi membri. ⚠ `loadProjectMembers` torna nome, email, ruolo e
   *  finestra: e' deliberatamente tutto cio' che l'asse funzionale concede (I18). */
  async getById(a: ActorContext, id: string): Promise<ProjectDetail> {
    const p = await progettoVisibile(a, id);
    return { ...p, members: await repo.loadProjectMembers(pool, id) };
  },

  async create(a: ActorContext, body: ProjectCreateBody): Promise<ProjectDetail> {
    const tenantId = requireOwnTenant(a);
    if (await repo.findProjectByCode(pool, tenantId, body.code)) {
      throw new ConflictError(`Esiste gia' un progetto con codice ${body.code}`, "PROJECT_CODE_TAKEN");
    }
    if (body.startsOn && body.endsOn && body.endsOn < body.startsOn) {
      throw new ValidationError("La data di fine precede quella di inizio");
    }
    const id = await repo.insertProject(pool, tenantId, body, a.userId);
    return this.getById(a, id);
  },

  async update(a: ActorContext, id: string, body: ProjectUpdateBody): Promise<ProjectDetail> {
    await progettoVisibile(a, id);
    await puoGestire(a, id);
    await repo.updateProject(pool, id, body, a.userId);
    return this.getById(a, id);
  },

  /** L'avanzamento: il gesto piu' frequente, e quello che un capo progetto fa da se'. */
  async setProgress(a: ActorContext, id: string, body: ProjectProgressBody): Promise<ProjectDetail> {
    await progettoVisibile(a, id);
    await puoGestire(a, id);
    await repo.updateProgress(pool, id, body.progressPct, a.userId);
    return this.getById(a, id);
  },

  async upsertMember(
    a: ActorContext, id: string, userId: string, body: ProjectMemberUpsertBody,
  ): Promise<ProjectDetail> {
    const p = await progettoVisibile(a, id);
    await puoGestire(a, id);

    // Un solo LEAD aperto per progetto: lo impone l'indice unico parziale del database
    // (`sys_project_members_one_open_lead_idx`). Meglio dirlo qui con un errore che si
    // legge, che lasciare arrivare al chiamante un vincolo violato dal driver. E non
    // chiudo io il capo precedente d'iniziativa: cambiare chi guida un progetto e' una
    // decisione, non un effetto collaterale di una PUT.
    if (body.role === "LEAD" && !body.endsOn) {
      const attuale = await repo.currentLead(pool, id);
      if (attuale && attuale !== userId) {
        throw new ConflictError(
          "Il progetto ha gia' un capo in carica: chiudi la sua appartenenza prima di nominarne un altro",
          "PROJECT_LEAD_ALREADY_SET");
      }
    }
    await withTransaction(async (client) => {
      await repo.upsertMember(client, id, userId, p.tenantId, body, a.userId);
    });
    return this.getById(a, id);
  },

  /** Chiude l'appartenenza, non la cancella: la finestra serve a sapere chi c'era quando. */
  async removeMember(a: ActorContext, id: string, userId: string): Promise<ProjectDetail> {
    await progettoVisibile(a, id);
    await puoGestire(a, id);
    const chiusa = await repo.closeMember(pool, id, userId, a.userId);
    if (!chiusa) throw new NotFoundError("Project member");
    return this.getById(a, id);
  },

  /** La scheda del progetto (V7): il progetto con i membri, il processo che serve, il piano e se
   *  chi guarda può pianificarlo. Stesso confine di `getById`: fuori scope è 404. */
  async scheda(a: ActorContext, id: string): Promise<ProjectScheda> {
    const p = await progettoVisibile(a, id);
    const [members, phases, dependencies, processId, canManage] = await Promise.all([
      repo.loadProjectMembers(pool, id),
      piano.loadPhases(pool, id),
      piano.loadDependencies(pool, id),
      piano.projectProcessId(pool, id),
      puoGestire(a, id).then(() => true, () => false),
    ]);
    const process = processId ? await processi.findProcess(pool, p.tenantId, processId) : null;
    return { project: { ...p, members }, process, phases, dependencies, canManage };
  },

  async addPhase(a: ActorContext, id: string, body: ProjectPhaseCreateBody): Promise<ProjectScheda> {
    const p = await progettoVisibile(a, id);
    await puoGestire(a, id);
    await this.controllaFase(p.tenantId, id, body, null);
    await piano.insertPhase(pool, id, p.tenantId, body);
    return this.scheda(a, id);
  },

  async updatePhase(a: ActorContext, id: string, phaseId: string, body: ProjectPhaseUpdateBody): Promise<ProjectScheda> {
    const p = await progettoVisibile(a, id);
    await puoGestire(a, id);
    const prima = await piano.findPhase(pool, id, phaseId);
    if (!prima) throw new NotFoundError("Project phase");
    await this.controllaFase(p.tenantId, id, { ...prima, ...body }, phaseId);
    await piano.updatePhase(pool, id, phaseId, body);
    return this.scheda(a, id);
  },

  async removePhase(a: ActorContext, id: string, phaseId: string): Promise<ProjectScheda> {
    await progettoVisibile(a, id);
    await puoGestire(a, id);
    if (!(await piano.deletePhase(pool, id, phaseId))) throw new NotFoundError("Project phase");
    return this.scheda(a, id);
  },

  async addDependency(a: ActorContext, id: string, body: ProjectDependencyCreateBody): Promise<ProjectScheda> {
    const p = await progettoVisibile(a, id);
    await puoGestire(a, id);
    if (body.predecessorId === body.successorId) throw new ValidationError("Una fase non dipende da sé stessa");
    const [pre, suc] = await Promise.all([piano.findPhase(pool, id, body.predecessorId), piano.findPhase(pool, id, body.successorId)]);
    if (!pre || !suc) throw new NotFoundError("Project phase");
    if (await piano.dipendenzaCircolare(pool, body.predecessorId, body.successorId)) {
      throw new ConflictError("La dipendenza chiuderebbe un giro", "PROJECT_DEPENDENCY_CYCLE");
    }
    try {
      await piano.insertDependency(pool, id, p.tenantId, body);
    } catch (e) {
      if (typeof e === "object" && e !== null && (e as { code?: string }).code === "23505") {
        throw new ConflictError("La dipendenza esiste già", "PROJECT_DEPENDENCY_EXISTS");
      }
      throw e;
    }
    return this.scheda(a, id);
  },

  async removeDependency(a: ActorContext, id: string, dependencyId: string): Promise<ProjectScheda> {
    await progettoVisibile(a, id);
    await puoGestire(a, id);
    if (!(await piano.deleteDependency(pool, id, dependencyId))) throw new NotFoundError("Project dependency");
    return this.scheda(a, id);
  },

  /** Date coerenti, tappa su un giorno solo, riferimenti nello stesso progetto, niente cicli. */
  async controllaFase(
    tenantId: string, id: string,
    f: { kind?: string | undefined; plannedStart?: string | null | undefined; plannedEnd?: string | null | undefined;
         actualStart?: string | null | undefined; actualEnd?: string | null | undefined;
         parentId?: string | null | undefined; ownerMemberId?: string | null | undefined; processStepId?: string | null | undefined },
    phaseId: string | null,
  ): Promise<void> {
    if (f.plannedStart && f.plannedEnd && f.plannedEnd < f.plannedStart) throw new ValidationError("La fine pianificata precede l'inizio");
    if (f.actualStart && f.actualEnd && f.actualEnd < f.actualStart) throw new ValidationError("La fine effettiva precede l'inizio");
    if (f.kind === "MILESTONE" && f.plannedStart && f.plannedEnd && f.plannedStart !== f.plannedEnd) {
      throw new ValidationError("Una tappa ha una data sola");
    }
    const errato = await piano.riferimentiValidi(pool, id, tenantId, {
      parentId: f.parentId ?? null, ownerMemberId: f.ownerMemberId ?? null, processStepId: f.processStepId ?? null,
    });
    if (errato) throw new ValidationError(`Riferimento fuori dal progetto: ${errato}`);
    if (phaseId && f.parentId && (f.parentId === phaseId || (await piano.creaCiclo(pool, phaseId, f.parentId)))) {
      throw new ConflictError("Una fase non può stare dentro sé stessa", "PROJECT_PHASE_CYCLE");
    }
  },
};
