import { randomUUID } from 'crypto';
import { Pool } from 'pg';
import type { PublicUsers, RoomSessionRecord, RoomStatus, RoomTemplatePayload, RoomTemplateRecord, TeacherPublic } from '../shared/types';

export interface StoredTeacher extends TeacherPublic {
  passwordHash: string;
}

export interface StoredTeacherSession {
  teacher: StoredTeacher;
  tokenHash: string;
  expiresAt: Date;
}

export interface CreateRoomSessionInput {
  teacherId: string;
  templateId: string | null;
  liveRoomId: string;
  status: RoomStatus;
  initialConfig: RoomTemplatePayload;
}

export interface RoomSessionPatch {
  status?: RoomStatus;
  startedAt?: Date | null;
  finishedAt?: Date | null;
  roundHistory?: unknown;
  finalUsers?: unknown;
}

export interface TeacherStore {
  available: boolean;
  createTeacher(email: string, passwordHash: string): Promise<StoredTeacher | null>;
  findTeacherByEmail(email: string): Promise<StoredTeacher | null>;
  findTeacherById(id: string): Promise<StoredTeacher | null>;
  createTeacherSession(teacherId: string, tokenHash: string, expiresAt: Date): Promise<void>;
  findTeacherSession(tokenHash: string): Promise<StoredTeacherSession | null>;
  deleteTeacherSession(tokenHash: string): Promise<void>;
  createRoomTemplate(teacherId: string, payload: RoomTemplatePayload): Promise<RoomTemplateRecord>;
  updateRoomTemplate(teacherId: string, templateId: string, payload: RoomTemplatePayload): Promise<RoomTemplateRecord | null>;
  archiveRoomTemplate(teacherId: string, templateId: string): Promise<boolean>;
  listRoomTemplates(teacherId: string): Promise<RoomTemplateRecord[]>;
  getRoomTemplate(teacherId: string, templateId: string): Promise<RoomTemplateRecord | null>;
  createRoomSession(input: CreateRoomSessionInput): Promise<RoomSessionRecord>;
  updateRoomSession(sessionId: string, patch: RoomSessionPatch): Promise<void>;
  listRoomSessions(teacherId: string): Promise<RoomSessionRecord[]>;
  getRoomSession(teacherId: string, sessionId: string): Promise<RoomSessionRecord | null>;
  expireOpenRoomSessions(): Promise<void>;
  close(): Promise<void>;
}

export class DisabledTeacherStore implements TeacherStore {
  available = false;
  async createTeacher(): Promise<StoredTeacher | null> { return null; }
  async findTeacherByEmail(): Promise<StoredTeacher | null> { return null; }
  async findTeacherById(): Promise<StoredTeacher | null> { return null; }
  async createTeacherSession(): Promise<void> { return undefined; }
  async findTeacherSession(): Promise<StoredTeacherSession | null> { return null; }
  async deleteTeacherSession(): Promise<void> { return undefined; }
  async createRoomTemplate(): Promise<RoomTemplateRecord> { throw new Error('Teacher storage is disabled.'); }
  async updateRoomTemplate(): Promise<RoomTemplateRecord | null> { return null; }
  async archiveRoomTemplate(): Promise<boolean> { return false; }
  async listRoomTemplates(): Promise<RoomTemplateRecord[]> { return []; }
  async getRoomTemplate(): Promise<RoomTemplateRecord | null> { return null; }
  async createRoomSession(): Promise<RoomSessionRecord> { throw new Error('Teacher storage is disabled.'); }
  async updateRoomSession(): Promise<void> { return undefined; }
  async listRoomSessions(): Promise<RoomSessionRecord[]> { return []; }
  async getRoomSession(): Promise<RoomSessionRecord | null> { return null; }
  async expireOpenRoomSessions(): Promise<void> { return undefined; }
  async close(): Promise<void> { return undefined; }
}

export class MemoryTeacherStore implements TeacherStore {
  available = true;
  private teachers = new Map<string, StoredTeacher>();
  private sessions = new Map<string, { teacherId: string; tokenHash: string; expiresAt: Date }>();
  private templates = new Map<string, RoomTemplateRecord>();
  private roomSessions = new Map<string, RoomSessionRecord>();

  async createTeacher(email: string, passwordHash: string) {
    if ([...this.teachers.values()].some((teacher) => teacher.email === email)) return null;
    const teacher = { id: randomUUID(), email, passwordHash };
    this.teachers.set(teacher.id, teacher);
    return teacher;
  }

  async findTeacherByEmail(email: string) {
    return [...this.teachers.values()].find((teacher) => teacher.email === email) ?? null;
  }

  async findTeacherById(id: string) {
    return this.teachers.get(id) ?? null;
  }

  async createTeacherSession(teacherId: string, tokenHash: string, expiresAt: Date) {
    this.sessions.set(tokenHash, { teacherId, tokenHash, expiresAt });
  }

  async findTeacherSession(tokenHash: string) {
    const session = this.sessions.get(tokenHash);
    if (!session) return null;
    const teacher = this.teachers.get(session.teacherId);
    if (!teacher) return null;
    return { teacher, tokenHash, expiresAt: session.expiresAt };
  }

  async deleteTeacherSession(tokenHash: string) {
    this.sessions.delete(tokenHash);
  }

  async createRoomTemplate(teacherId: string, payload: RoomTemplatePayload) {
    const now = new Date().toISOString();
    const template: RoomTemplateRecord = {
      ...payload,
      id: randomUUID(),
      teacherId,
      createdAt: now,
      updatedAt: now,
      archivedAt: null,
    };
    this.templates.set(template.id, template);
    return template;
  }

  async updateRoomTemplate(teacherId: string, templateId: string, payload: RoomTemplatePayload) {
    const template = this.templates.get(templateId);
    if (!template || template.teacherId !== teacherId || template.archivedAt) return null;
    const updated = { ...template, ...payload, updatedAt: new Date().toISOString() };
    this.templates.set(templateId, updated);
    return updated;
  }

  async archiveRoomTemplate(teacherId: string, templateId: string) {
    const template = this.templates.get(templateId);
    if (!template || template.teacherId !== teacherId || template.archivedAt) return false;
    this.templates.set(templateId, { ...template, archivedAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
    return true;
  }

  async listRoomTemplates(teacherId: string) {
    return [...this.templates.values()].filter((template) => template.teacherId === teacherId && !template.archivedAt);
  }

  async getRoomTemplate(teacherId: string, templateId: string) {
    const template = this.templates.get(templateId);
    if (!template || template.teacherId !== teacherId || template.archivedAt) return null;
    return template;
  }

  async createRoomSession(input: CreateRoomSessionInput) {
    const now = new Date().toISOString();
    const session: RoomSessionRecord = {
      id: randomUUID(),
      teacherId: input.teacherId,
      templateId: input.templateId,
      liveRoomId: input.liveRoomId,
      status: input.status,
      startedAt: null,
      finishedAt: null,
      initialConfig: input.initialConfig,
      roundHistory: [],
      finalUsers: {},
      createdAt: now,
      updatedAt: now,
    };
    this.roomSessions.set(session.id, session);
    return session;
  }

  async updateRoomSession(sessionId: string, patch: RoomSessionPatch) {
    const session = this.roomSessions.get(sessionId);
    if (!session) return;
    this.roomSessions.set(sessionId, {
      ...session,
      status: patch.status ?? session.status,
      startedAt: patch.startedAt === undefined ? session.startedAt : patch.startedAt?.toISOString() ?? null,
      finishedAt: patch.finishedAt === undefined ? session.finishedAt : patch.finishedAt?.toISOString() ?? null,
      roundHistory: (patch.roundHistory as RoomSessionRecord['roundHistory'] | undefined) ?? session.roundHistory,
      finalUsers: (patch.finalUsers as PublicUsers | undefined) ?? session.finalUsers,
      updatedAt: new Date().toISOString(),
    });
  }

  async listRoomSessions(teacherId: string) {
    return [...this.roomSessions.values()].filter((session) => session.teacherId === teacherId);
  }

  async getRoomSession(teacherId: string, sessionId: string) {
    const session = this.roomSessions.get(sessionId);
    return session?.teacherId === teacherId ? session : null;
  }

  async expireOpenRoomSessions() {
    for (const [id, session] of this.roomSessions.entries()) {
      if (['lobby', 'running', 'paused', 'waitingCreator'].includes(session.status)) {
        this.roomSessions.set(id, { ...session, status: 'expired', finishedAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
      }
    }
  }

  async close() {
    return undefined;
  }
}

export class PostgresTeacherStore implements TeacherStore {
  available = true;

  constructor(private readonly pool: Pool) {}

  async createTeacher(email: string, passwordHash: string) {
    const result = await this.pool.query(
      `insert into teachers (email, password_hash)
       values ($1, $2)
       on conflict (email) do nothing
       returning id, email, password_hash`,
      [email, passwordHash],
    );
    const row = result.rows[0];
    return row ? mapTeacher(row) : null;
  }

  async findTeacherByEmail(email: string) {
    const result = await this.pool.query('select id, email, password_hash from teachers where email = $1', [email]);
    return result.rows[0] ? mapTeacher(result.rows[0]) : null;
  }

  async findTeacherById(id: string) {
    const result = await this.pool.query('select id, email, password_hash from teachers where id = $1', [id]);
    return result.rows[0] ? mapTeacher(result.rows[0]) : null;
  }

  async createTeacherSession(teacherId: string, tokenHash: string, expiresAt: Date) {
    await this.pool.query('insert into teacher_sessions (teacher_id, token_hash, expires_at) values ($1, $2, $3)', [teacherId, tokenHash, expiresAt]);
  }

  async findTeacherSession(tokenHash: string) {
    const result = await this.pool.query(
      `select s.token_hash, s.expires_at, t.id, t.email, t.password_hash
       from teacher_sessions s
       join teachers t on t.id = s.teacher_id
       where s.token_hash = $1`,
      [tokenHash],
    );
    const row = result.rows[0];
    if (!row) return null;
    return { teacher: mapTeacher(row), tokenHash: row.token_hash, expiresAt: new Date(row.expires_at) };
  }

  async deleteTeacherSession(tokenHash: string) {
    await this.pool.query('delete from teacher_sessions where token_hash = $1', [tokenHash]);
  }

  async createRoomTemplate(teacherId: string, payload: RoomTemplatePayload) {
    const result = await this.pool.query(
      `insert into room_templates
       (teacher_id, name, rule, round_duration, image_set, auto_run, has_ai, size_limit, accepted_images, refused_images)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, $10::jsonb)
       returning *`,
      templateValues(teacherId, payload),
    );
    return mapTemplate(result.rows[0]);
  }

  async updateRoomTemplate(teacherId: string, templateId: string, payload: RoomTemplatePayload) {
    const result = await this.pool.query(
      `update room_templates
       set name = $3, rule = $4, round_duration = $5, image_set = $6, auto_run = $7,
           has_ai = $8, size_limit = $9, accepted_images = $10::jsonb, refused_images = $11::jsonb,
           updated_at = now()
       where id = $1 and teacher_id = $2 and archived_at is null
       returning *`,
      [
        templateId,
        teacherId,
        payload.name,
        payload.rule,
        payload.roundDuration,
        payload.imageSet,
        payload.autoRun,
        payload.hasAI,
        payload.sizeLimit,
        JSON.stringify(payload.acceptedImages),
        JSON.stringify(payload.refusedImages),
      ],
    );
    return result.rows[0] ? mapTemplate(result.rows[0]) : null;
  }

  async archiveRoomTemplate(teacherId: string, templateId: string) {
    const result = await this.pool.query(
      `update room_templates set archived_at = now(), updated_at = now()
       where id = $1 and teacher_id = $2 and archived_at is null`,
      [templateId, teacherId],
    );
    return (result.rowCount ?? 0) > 0;
  }

  async listRoomTemplates(teacherId: string) {
    const result = await this.pool.query(
      'select * from room_templates where teacher_id = $1 and archived_at is null order by updated_at desc',
      [teacherId],
    );
    return result.rows.map(mapTemplate);
  }

  async getRoomTemplate(teacherId: string, templateId: string) {
    const result = await this.pool.query(
      'select * from room_templates where id = $1 and teacher_id = $2 and archived_at is null',
      [templateId, teacherId],
    );
    return result.rows[0] ? mapTemplate(result.rows[0]) : null;
  }

  async createRoomSession(input: CreateRoomSessionInput) {
    const result = await this.pool.query(
      `insert into room_sessions (teacher_id, template_id, live_room_id, status, initial_config)
       values ($1, $2, $3, $4, $5::jsonb)
       returning *`,
      [input.teacherId, input.templateId, input.liveRoomId, input.status, JSON.stringify(input.initialConfig)],
    );
    return mapRoomSession(result.rows[0]);
  }

  async updateRoomSession(sessionId: string, patch: RoomSessionPatch) {
    await this.pool.query(
      `update room_sessions
       set status = coalesce($2, status),
           started_at = coalesce($3, started_at),
           finished_at = coalesce($4, finished_at),
           round_history = coalesce($5::jsonb, round_history),
           final_users = coalesce($6::jsonb, final_users),
           updated_at = now()
       where id = $1`,
      [
        sessionId,
        patch.status ?? null,
        patch.startedAt ?? null,
        patch.finishedAt ?? null,
        patch.roundHistory === undefined ? null : JSON.stringify(patch.roundHistory),
        patch.finalUsers === undefined ? null : JSON.stringify(patch.finalUsers),
      ],
    );
  }

  async listRoomSessions(teacherId: string) {
    const result = await this.pool.query('select * from room_sessions where teacher_id = $1 order by created_at desc', [teacherId]);
    return result.rows.map(mapRoomSession);
  }

  async getRoomSession(teacherId: string, sessionId: string) {
    const result = await this.pool.query('select * from room_sessions where id = $1 and teacher_id = $2', [sessionId, teacherId]);
    return result.rows[0] ? mapRoomSession(result.rows[0]) : null;
  }

  async expireOpenRoomSessions() {
    await this.pool.query(
      `update room_sessions
       set status = 'expired', finished_at = coalesce(finished_at, now()), updated_at = now()
       where status in ('lobby', 'running', 'paused', 'waitingCreator')`,
    );
  }

  async close() {
    await this.pool.end();
  }
}

export function createTeacherStoreFromEnv(nodeEnv: string | undefined) {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    if (nodeEnv === 'production') {
      throw new Error('DATABASE_URL is required in production.');
    }
    return new DisabledTeacherStore();
  }

  return new PostgresTeacherStore(new Pool({ connectionString: databaseUrl }));
}

function templateValues(teacherId: string, payload: RoomTemplatePayload) {
  return [
    teacherId,
    payload.name,
    payload.rule,
    payload.roundDuration,
    payload.imageSet,
    payload.autoRun,
    payload.hasAI,
    payload.sizeLimit,
    JSON.stringify(payload.acceptedImages),
    JSON.stringify(payload.refusedImages),
  ];
}

function mapTeacher(row: Record<string, unknown>): StoredTeacher {
  return {
    id: String(row.id),
    email: String(row.email),
    passwordHash: String(row.password_hash),
  };
}

function mapTemplate(row: Record<string, unknown>): RoomTemplateRecord {
  return {
    id: String(row.id),
    teacherId: String(row.teacher_id),
    name: String(row.name),
    rule: String(row.rule),
    roundDuration: Number(row.round_duration),
    imageSet: String(row.image_set),
    autoRun: Boolean(row.auto_run),
    hasAI: Boolean(row.has_ai),
    sizeLimit: Number(row.size_limit),
    acceptedImages: readJson<string[]>(row.accepted_images, []),
    refusedImages: readJson<string[]>(row.refused_images, []),
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at),
    archivedAt: row.archived_at ? toIso(row.archived_at) : null,
  };
}

function mapRoomSession(row: Record<string, unknown>): RoomSessionRecord {
  return {
    id: String(row.id),
    teacherId: String(row.teacher_id),
    templateId: row.template_id ? String(row.template_id) : null,
    liveRoomId: String(row.live_room_id),
    status: String(row.status) as RoomStatus,
    startedAt: row.started_at ? toIso(row.started_at) : null,
    finishedAt: row.finished_at ? toIso(row.finished_at) : null,
    initialConfig: readJson<RoomTemplatePayload>(row.initial_config, {} as RoomTemplatePayload),
    roundHistory: readJson<RoomSessionRecord['roundHistory']>(row.round_history, []),
    finalUsers: readJson<PublicUsers>(row.final_users, {}),
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at),
  };
}

function readJson<T>(value: unknown, fallback: T): T {
  if (typeof value === 'string') {
    try {
      return JSON.parse(value) as T;
    } catch {
      return fallback;
    }
  }
  return (value as T | null | undefined) ?? fallback;
}

function toIso(value: unknown) {
  return value instanceof Date ? value.toISOString() : new Date(String(value)).toISOString();
}
