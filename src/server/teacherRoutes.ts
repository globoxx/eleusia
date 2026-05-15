import type { Express, Request, Response } from 'express';
import {
  authenticateTeacher,
  clearSessionCookie,
  createSessionCookie,
  createSessionToken,
  hashPassword,
  hashSessionToken,
  isValidPassword,
  normalizeEmail,
  teacherCookieName,
  teacherSessionDurationMs,
  verifyPassword,
} from './auth';
import type { ImageCatalog, RoomTemplatePayload, TeacherPublic } from '../shared/types';
import { MAX_RULE_LENGTH, isValidRoundDuration, isValidSizeLimit, validateCreateRoomInput } from './gameState';
import type { TeacherStore } from './teacherStore';

interface TeacherRoutesOptions {
  app: Express;
  store: TeacherStore;
  allImages: ImageCatalog;
  nodeEnv?: string;
}

export function setupTeacherRoutes({ app, store, allImages, nodeEnv }: TeacherRoutesOptions) {
  app.post('/api/auth/register', async (req, res) => {
    if (!ensureStoreAvailable(store, res)) return;
    const credentials = readCredentials(req.body);
    if (!credentials) {
      res.status(400).json({ reason: 'invalidCredentials' });
      return;
    }

    const passwordHash = await hashPassword(credentials.password);
    const teacher = await store.createTeacher(credentials.email, passwordHash);
    if (!teacher) {
      res.status(409).json({ reason: 'emailAlreadyExists' });
      return;
    }

    await createSessionResponse(res, store, teacher, nodeEnv);
  });

  app.post('/api/auth/login', async (req, res) => {
    if (!ensureStoreAvailable(store, res)) return;
    const credentials = readCredentials(req.body);
    if (!credentials) {
      res.status(400).json({ reason: 'invalidCredentials' });
      return;
    }

    const teacher = await store.findTeacherByEmail(credentials.email);
    if (!teacher || !(await verifyPassword(credentials.password, teacher.passwordHash))) {
      res.status(401).json({ reason: 'invalidCredentials' });
      return;
    }

    await createSessionResponse(res, store, teacher, nodeEnv);
  });

  app.post('/api/auth/logout', async (req, res) => {
    if (store.available) {
      const teacher = await authenticateTeacher(req.headers, store);
      if (teacher) await store.deleteTeacherSession(teacher.sessionTokenHash);
    }
    res.setHeader('Set-Cookie', clearSessionCookie());
    res.status(204).end();
  });

  app.get('/api/auth/me', async (req, res) => {
    const teacher = await requireTeacher(req, res, store);
    if (!teacher) return;
    res.json({ teacher });
  });

  app.get('/api/teacher/room-templates', async (req, res) => {
    const teacher = await requireTeacher(req, res, store);
    if (!teacher) return;
    res.json({ templates: await store.listRoomTemplates(teacher.id) });
  });

  app.post('/api/teacher/room-templates', async (req, res) => {
    const teacher = await requireTeacher(req, res, store);
    if (!teacher) return;
    const payload = readTemplatePayload(req.body, allImages);
    if (!payload.ok) {
      res.status(400).json({ reason: payload.reason });
      return;
    }
    const template = await store.createRoomTemplate(teacher.id, payload.value);
    res.status(201).json({ template });
  });

  app.patch('/api/teacher/room-templates/:id', async (req, res) => {
    const teacher = await requireTeacher(req, res, store);
    if (!teacher) return;
    const payload = readTemplatePayload(req.body, allImages);
    if (!payload.ok) {
      res.status(400).json({ reason: payload.reason });
      return;
    }
    const template = await store.updateRoomTemplate(teacher.id, req.params.id, payload.value);
    if (!template) {
      res.status(404).json({ reason: 'templateNotFound' });
      return;
    }
    res.json({ template });
  });

  app.delete('/api/teacher/room-templates/:id', async (req, res) => {
    const teacher = await requireTeacher(req, res, store);
    if (!teacher) return;
    const archived = await store.archiveRoomTemplate(teacher.id, req.params.id);
    if (!archived) {
      res.status(404).json({ reason: 'templateNotFound' });
      return;
    }
    res.status(204).end();
  });

  app.get('/api/teacher/room-sessions', async (req, res) => {
    const teacher = await requireTeacher(req, res, store);
    if (!teacher) return;
    res.json({ sessions: await store.listRoomSessions(teacher.id) });
  });

  app.get('/api/teacher/room-sessions/:id', async (req, res) => {
    const teacher = await requireTeacher(req, res, store);
    if (!teacher) return;
    const session = await store.getRoomSession(teacher.id, req.params.id);
    if (!session) {
      res.status(404).json({ reason: 'sessionNotFound' });
      return;
    }
    res.json({ session });
  });
}

async function requireTeacher(req: Request, res: Response, store: TeacherStore): Promise<TeacherPublic | null> {
  if (!ensureStoreAvailable(store, res)) return null;
  const teacher = await authenticateTeacher(req.headers, store);
  if (!teacher) {
    res.status(401).json({ reason: 'notAuthenticated' });
    return null;
  }
  return { id: teacher.id, email: teacher.email };
}

function ensureStoreAvailable(store: TeacherStore, res: Response) {
  if (store.available) return true;
  res.status(503).json({ reason: 'teacherStorageUnavailable' });
  return false;
}

function readCredentials(body: unknown) {
  if (!body || typeof body !== 'object') return null;
  const input = body as Record<string, unknown>;
  const email = normalizeEmail(input.email);
  if (!email || !isValidPassword(input.password)) return null;
  return { email, password: input.password };
}

function readTemplatePayload(body: unknown, allImages: ImageCatalog): { ok: true; value: RoomTemplatePayload } | { ok: false; reason: string } {
  if (!body || typeof body !== 'object') return { ok: false, reason: 'invalidTemplate' };
  const input = body as Record<string, unknown>;

  if (typeof input.name !== 'string' || input.name.trim().length === 0 || input.name.length > 80) {
    return { ok: false, reason: 'invalidTemplateName' };
  }
  if (typeof input.rule !== 'string' || input.rule.trim().length === 0 || input.rule.length > MAX_RULE_LENGTH) {
    return { ok: false, reason: 'invalidRule' };
  }
  if (
    !isValidRoundDuration(input.roundDuration) ||
    !isValidSizeLimit(input.sizeLimit) ||
    typeof input.imageSet !== 'string' ||
    typeof input.autoRun !== 'boolean' ||
    typeof input.hasAI !== 'boolean' ||
    !Array.isArray(input.refusedImages) ||
    !Array.isArray(input.acceptedImages)
  ) {
    return { ok: false, reason: 'invalidTemplate' };
  }

  const value: RoomTemplatePayload = {
    name: input.name.trim(),
    rule: input.rule.trim(),
    roundDuration: input.roundDuration,
    imageSet: input.imageSet,
    autoRun: input.autoRun,
    hasAI: input.hasAI,
    sizeLimit: input.sizeLimit,
    refusedImages: input.autoRun ? input.refusedImages.filter((image): image is string => typeof image === 'string') : [],
    acceptedImages: input.autoRun ? input.acceptedImages.filter((image): image is string => typeof image === 'string') : [],
  };

  const validation = validateCreateRoomInput({ ...value, pseudo: 'Teacher', roomId: 'template' }, allImages);
  if (!validation.ok) return validation;
  return { ok: true, value };
}

async function createSessionResponse(res: Response, store: TeacherStore, teacher: TeacherPublic, nodeEnv: string | undefined) {
  const token = createSessionToken();
  const tokenHash = hashSessionToken(token);
  await store.createTeacherSession(teacher.id, tokenHash, new Date(Date.now() + teacherSessionDurationMs));
  res.setHeader('Set-Cookie', createSessionCookie(token, nodeEnv));
  res.json({ teacher: { id: teacher.id, email: teacher.email }, cookieName: teacherCookieName });
}
