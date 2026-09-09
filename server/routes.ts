import type { Express } from "express";
import type { Server } from "http";
import { z } from "zod";
import { storage, type IStorage } from "./storage";
import { api } from "@shared/routes";
import {
  currentUser,
  requireAuth,
  requireRole,
  toAuthenticatedUser,
  toPublicUser,
  verifyPassword,
} from "./auth";

const idSchema = z.coerce.number().int().positive();
const credentialsSchema = z.object({
  username: z.string().trim().min(1).max(100),
  password: z.string().min(1).max(200),
});

function safeStudent(student: Awaited<ReturnType<typeof storage.getStudent>>) {
  if (!student) return student;
  const { aadhaar: _aadhaar, ...safe } = student;
  return safe;
}

function routeId(value: string | string[]): number {
  return idSchema.parse(Array.isArray(value) ? value[0] : value);
}

export async function registerRoutes(
  httpServer: Server,
  app: Express,
  dataStore: IStorage = storage,
): Promise<Server> {
  app.post("/api/auth/login", async (req, res) => {
    const { username, password } = credentialsSchema.parse(req.body);
    const user = await dataStore.getUserByUsername(username);

    // Keep invalid username and invalid password responses identical.
    if (!user || !user.schoolId || !(await verifyPassword(password, user.passwordHash))) {
      return res.status(401).json({ message: "Invalid username or password" });
    }

    const authenticatedUser = toAuthenticatedUser(user);
    await new Promise<void>((resolve, reject) => {
      req.session.regenerate((error) => {
        if (error) reject(error);
        else resolve();
      });
    });
    req.session.user = authenticatedUser;
    await new Promise<void>((resolve, reject) => {
      req.session.save((error) => {
        if (error) reject(error);
        else resolve();
      });
    });

    return res.json({ user: toPublicUser(authenticatedUser) });
  });

  app.post("/api/auth/logout", requireAuth, async (req, res) => {
    await new Promise<void>((resolve, reject) => {
      req.session.destroy((error) => {
        if (error) reject(error);
        else resolve();
      });
    });
    res.clearCookie("school_suite.sid");
    return res.status(204).send();
  });

  app.get("/api/auth/me", requireAuth, (req, res) => {
    return res.json({ user: toPublicUser(currentUser(req)) });
  });

  // === Academic sessions ===
  app.get(api.sessions.active.path, requireAuth, async (req, res) => {
    res.json(await dataStore.getActiveSession(currentUser(req).schoolId) ?? null);
  });

  // === Schools ===
  app.get(api.schools.get.path, requireAuth, async (req, res) => {
    const id = routeId(req.params.id);
    const user = currentUser(req);
    if (id !== user.schoolId) return res.status(404).json({ message: "School not found" });
    const school = await dataStore.getSchool(user.schoolId);
    if (!school) return res.status(404).json({ message: "School not found" });
    res.json(school);
  });

  app.put(api.schools.update.path, requireRole("admin", "principal"), async (req, res) => {
    const id = routeId(req.params.id);
    const user = currentUser(req);
    if (id !== user.schoolId) return res.status(404).json({ message: "School not found" });
    const input = api.schools.update.input.parse(req.body);
    const updated = await dataStore.updateSchool(user.schoolId, input);
    res.json(updated);
  });

  // === Subjects and teacher assignments ===
  const academicManager = requireRole("admin", "principal");
  app.get(api.subjects.list.path, requireRole("admin", "principal", "teacher"), async (req, res) => {
    const user = currentUser(req);
    const session = await dataStore.getActiveSession(user.schoolId);
    if (!session) return res.json([]);
    const subjects = await dataStore.getSubjects(user.schoolId, session.id);
    if (user.role === "teacher") {
      const assignments = await dataStore.getTeacherSubjectAssignments(user.schoolId, session.id, user.id);
      const allowed = new Set(assignments.map((assignment) => assignment.subjectId));
      return res.json(subjects.filter((subject) => allowed.has(subject.id)));
    }
    return res.json(subjects);
  });

  app.post(api.subjects.create.path, academicManager, async (req, res) => {
    const input = api.subjects.create.input.parse(req.body);
    const user = currentUser(req);
    const session = await dataStore.getActiveSession(user.schoolId);
    if (!session) return res.status(409).json({ message: "No active academic session" });
    const subject = await dataStore.createSubject({ ...input, schoolId: user.schoolId, sessionId: session.id });
    return res.status(201).json(subject);
  });
  app.patch(api.subjects.update.path, academicManager, async (req, res) => {
    const user = currentUser(req);
    const session = await dataStore.getActiveSession(user.schoolId);
    if (!session) return res.status(409).json({ message: "No active academic session" });
    const subject = await dataStore.updateSubject(routeId(req.params.id), user.schoolId, session.id, api.subjects.update.input.parse(req.body));
    return subject ? res.json(subject) : res.status(404).json({ message: "Subject not found" });
  });
  app.delete(api.subjects.delete.path, academicManager, async (req, res) => {
    const user = currentUser(req);
    const session = await dataStore.getActiveSession(user.schoolId);
    if (!session) return res.status(409).json({ message: "No active academic session" });
    const deleted = await dataStore.deleteSubject(routeId(req.params.id), user.schoolId, session.id);
    return deleted ? res.status(204).send() : res.status(409).json({ message: "Subject not found or still assigned" });
  });

  app.get(api.assignments.list.path, requireRole("admin", "principal", "teacher"), async (req, res) => {
    const user = currentUser(req);
    const session = await dataStore.getActiveSession(user.schoolId);
    if (!session) return res.json({ subjects: [], classes: [] });
    const teacherUserId = user.role === "teacher" ? user.id : undefined;
    return res.json({
      subjects: await dataStore.getTeacherSubjectAssignments(user.schoolId, session.id, teacherUserId),
      classes: await dataStore.getTeacherClassAssignments(user.schoolId, session.id, teacherUserId),
    });
  });
  app.post(api.assignments.assignSubject.path, academicManager, async (req, res) => {
    const input = api.assignments.assignSubject.input.parse(req.body);
    const user = currentUser(req);
    const session = await dataStore.getActiveSession(user.schoolId);
    if (!session) return res.status(409).json({ message: "No active academic session" });
    const assignment = await dataStore.createTeacherSubjectAssignment({ ...input, schoolId: user.schoolId, sessionId: session.id });
    return assignment ? res.status(201).json(assignment) : res.status(400).json({ message: "Teacher, subject, or session is invalid" });
  });
  app.delete(api.assignments.removeSubject.path, academicManager, async (req, res) => {
    const user = currentUser(req); const session = await dataStore.getActiveSession(user.schoolId);
    if (!session) return res.status(409).json({ message: "No active academic session" });
    return (await dataStore.deleteTeacherSubjectAssignment(routeId(req.params.id), user.schoolId, session.id)) ? res.status(204).send() : res.status(404).json({ message: "Assignment not found" });
  });
  app.post(api.assignments.assignClass.path, academicManager, async (req, res) => {
    const input = api.assignments.assignClass.input.parse(req.body);
    const user = currentUser(req); const session = await dataStore.getActiveSession(user.schoolId);
    if (!session) return res.status(409).json({ message: "No active academic session" });
    try { return res.status(201).json(await dataStore.createTeacherClassAssignment({ ...input, schoolId: user.schoolId, sessionId: session.id })); }
    catch { return res.status(400).json({ message: "Teacher or assignment is invalid" }); }
  });
  app.delete(api.assignments.removeClass.path, academicManager, async (req, res) => {
    const user = currentUser(req); const session = await dataStore.getActiveSession(user.schoolId);
    if (!session) return res.status(409).json({ message: "No active academic session" });
    return (await dataStore.deleteTeacherClassAssignment(routeId(req.params.id), user.schoolId, session.id)) ? res.status(204).send() : res.status(404).json({ message: "Assignment not found" });
  });
  app.post(api.studentLinks.create.path, academicManager, async (req, res) => {
    const input = api.studentLinks.create.input.parse(req.body);
    const user = currentUser(req); const session = await dataStore.getActiveSession(user.schoolId);
    if (!session) return res.status(409).json({ message: "No active academic session" });
    const link = await dataStore.createStudentUserLink({ ...input, schoolId: user.schoolId, sessionId: session.id });
    return link ? res.status(201).json(link) : res.status(400).json({ message: "Student or student user is invalid" });
  });

  // === Exams ===
  const examManagers = requireRole("admin", "principal");
  const examReaders = requireRole("admin", "principal", "teacher", "student");
  async function currentExamContext(user: ReturnType<typeof currentUser>) {
    return dataStore.getActiveSession(user.schoolId);
  }
  async function authorizedExam(examId: number, user: ReturnType<typeof currentUser>) {
    const session = await currentExamContext(user);
    if (!session) return undefined;
    const exam = await dataStore.getExam(examId, user.schoolId, session.id);
    if (!exam) return undefined;
    if (user.role === "admin" || user.role === "principal") return { session, exam, scopes: await dataStore.getExamScopes(exam.id, user.schoolId, session.id), schedules: await dataStore.getExamSchedules(exam.id, user.schoolId, session.id) };
    const scopes = await dataStore.getExamScopes(exam.id, user.schoolId, session.id);
    const schedules = await dataStore.getExamSchedules(exam.id, user.schoolId, session.id);
    if (user.role === "teacher") {
      const classes = await dataStore.getTeacherClassAssignments(user.schoolId, session.id, user.id);
      const subjects = await dataStore.getTeacherSubjectAssignments(user.schoolId, session.id, user.id);
      const classKeys = new Set(classes.map((item) => `${item.className}\\0${item.section}`));
      const subjectIds = new Set(subjects.map((item) => item.subjectId));
      const allowedScopes = scopes.filter((scope) => classKeys.has(`${scope.className}\\0${scope.section}`));
      const allowedKeys = new Set(allowedScopes.map((scope) => `${scope.className}\\0${scope.section}`));
      const allowedSchedules = schedules.filter((schedule) => allowedKeys.has(`${schedule.className}\\0${schedule.section}`) && subjectIds.has(schedule.subjectId));
      return allowedSchedules.length || allowedScopes.length ? { session, exam, scopes: allowedScopes, schedules: allowedSchedules } : undefined;
    }
    const student = await dataStore.getStudentForUser(user.id, user.schoolId, session.id);
    if (!student || exam.status !== "published") return undefined;
    const ownScopes = scopes.filter((scope) => scope.className === student.class && scope.section === student.section);
    return ownScopes.length ? { session, exam, scopes: ownScopes, schedules: schedules.filter((schedule) => schedule.className === student.class && schedule.section === student.section) } : undefined;
  }

  app.get(api.exams.list.path, examReaders, async (req, res) => {
    const user = currentUser(req);
    const session = await currentExamContext(user);
    if (!session) return res.json([]);
    const requestedStatus = typeof req.query.status === "string" ? req.query.status : undefined;
    const requestedClass = typeof req.query.class === "string" ? req.query.class : undefined;
    const requestedSection = typeof req.query.section === "string" ? req.query.section : undefined;
    const exams = await dataStore.getExams(user.schoolId, session.id);
    const visible = [];
    for (const exam of exams) {
      if (requestedStatus && exam.status !== requestedStatus) continue;
      const detail = await authorizedExam(exam.id, user);
      if (!detail) continue;
      if (requestedClass && !detail.scopes.some((scope) => scope.className === requestedClass && (!requestedSection || scope.section === requestedSection))) continue;
      visible.push(exam);
    }
    return res.json(visible);
  });
  app.get(api.exams.get.path, examReaders, async (req, res) => {
    const detail = await authorizedExam(routeId(req.params.id), currentUser(req));
    return detail ? res.json({ exam: detail.exam, scopes: detail.scopes, schedules: detail.schedules }) : res.status(404).json({ message: "Exam not found" });
  });
  app.post(api.exams.create.path, examManagers, async (req, res) => {
    const input = api.exams.create.input.parse(req.body);
    const user = currentUser(req); const session = await currentExamContext(user);
    if (!session) return res.status(409).json({ message: "No active academic session" });
    const seen = new Set<string>();
    for (const scope of input.scopes) { const key = `${scope.className}\\0${scope.section}`; if (seen.has(key)) return res.status(400).json({ message: "Duplicate class/section scope" }); seen.add(key); }
    try {
      const result = await dataStore.createExam({ name: input.name, examType: input.examType, startDate: input.startDate, endDate: input.endDate, status: input.status ?? "draft", isActive: input.isActive ?? true, schoolId: user.schoolId, sessionId: session.id }, input.scopes);
      return res.status(201).json(result);
    } catch (error) { return res.status(400).json({ message: error instanceof Error ? error.message : "Unable to create exam" }); }
  });
  app.patch(api.exams.update.path, examManagers, async (req, res) => {
    const user = currentUser(req); const session = await currentExamContext(user); if (!session) return res.status(409).json({ message: "No active academic session" });
    try { const updated = await dataStore.updateExam(routeId(req.params.id), user.schoolId, session.id, api.exams.update.input.parse(req.body)); return updated ? res.json(updated) : res.status(404).json({ message: "Exam not found" }); }
    catch (error) { return res.status(400).json({ message: error instanceof Error ? error.message : "Unable to update exam" }); }
  });
  app.post(api.exams.status.path, examManagers, async (req, res) => {
    const user = currentUser(req); const session = await currentExamContext(user); if (!session) return res.status(409).json({ message: "No active academic session" });
    try { const updated = await dataStore.setExamStatus(routeId(req.params.id), user.schoolId, session.id, api.exams.status.input.parse(req.body).status); return updated ? res.json(updated) : res.status(404).json({ message: "Exam not found" }); }
    catch (error) { return res.status(400).json({ message: error instanceof Error ? error.message : "Invalid exam status transition" }); }
  });
  app.post(api.exams.addSchedule.path, examManagers, async (req, res) => {
    const input = api.exams.addSchedule.input.parse(req.body); const user = currentUser(req); const session = await currentExamContext(user); if (!session) return res.status(409).json({ message: "No active academic session" });
    try { return res.status(201).json(await dataStore.createExamSchedule({ ...input, examId: routeId(req.params.id), schoolId: user.schoolId, sessionId: session.id })); }
    catch (error) { return res.status(400).json({ message: error instanceof Error ? error.message : "Unable to add exam schedule" }); }
  });
  app.patch(api.exams.updateSchedule.path, examManagers, async (req, res) => {
    const user = currentUser(req); const session = await currentExamContext(user); if (!session) return res.status(409).json({ message: "No active academic session" });
    try { const updated = await dataStore.updateExamSchedule(routeId(req.params.id), user.schoolId, session.id, api.exams.updateSchedule.input.parse(req.body)); return updated ? res.json(updated) : res.status(404).json({ message: "Schedule not found" }); }
    catch (error) { return res.status(400).json({ message: error instanceof Error ? error.message : "Unable to update schedule" }); }
  });
  app.delete(api.exams.removeSchedule.path, examManagers, async (req, res) => {
    const user = currentUser(req); const session = await currentExamContext(user); if (!session) return res.status(409).json({ message: "No active academic session" });
    try { return (await dataStore.deleteExamSchedule(routeId(req.params.id), user.schoolId, session.id)) ? res.status(204).send() : res.status(404).json({ message: "Schedule not found" }); }
    catch (error) { return res.status(400).json({ message: error instanceof Error ? error.message : "Unable to remove schedule" }); }
  });

  // === Attendance ===
  const attendanceReaders = requireRole("admin", "principal", "teacher", "student");
  const attendanceManagers = requireRole("admin", "principal", "teacher");
  const attendanceQuery = (req: any) => ({
    from: typeof req.query.from === "string" ? req.query.from : undefined,
    to: typeof req.query.to === "string" ? req.query.to : undefined,
    date: typeof req.query.date === "string" ? req.query.date : undefined,
    className: typeof req.query.class === "string" ? req.query.class : undefined,
    section: typeof req.query.section === "string" ? req.query.section : undefined,
    subjectId: typeof req.query.subjectId === "string" ? idSchema.parse(req.query.subjectId) : undefined,
    studentId: typeof req.query.studentId === "string" ? idSchema.parse(req.query.studentId) : undefined,
  });
  const hasTeacherScope = async (user: ReturnType<typeof currentUser>, className: string, section: string, subjectId?: number) => {
    if (user.role !== "teacher") return true;
    const session = await dataStore.getActiveSession(user.schoolId);
    if (!session) return false;
    const classes = await dataStore.getTeacherClassAssignments(user.schoolId, session.id, user.id);
    if (!classes.some((assignment) => assignment.className === className && assignment.section === section)) return false;
    if (subjectId !== undefined) {
      const subjects = await dataStore.getTeacherSubjectAssignments(user.schoolId, session.id, user.id);
      if (!subjects.some((assignment) => assignment.subjectId === subjectId)) return false;
    }
    return true;
  };
  const scopedAttendance = async (req: any, user: ReturnType<typeof currentUser>) => {
    const session = await dataStore.getActiveSession(user.schoolId);
    if (!session) return { session: undefined, records: [] as Awaited<ReturnType<IStorage["getAttendance"]>> };
    if (user.role === "student") {
      const own = await dataStore.getStudentForUser(user.id, user.schoolId, session.id);
      return { session, records: own ? await dataStore.getAttendance(user.schoolId, session.id, { ...attendanceQuery(req), studentId: own.id }) : [] };
    }
    let records = await dataStore.getAttendance(user.schoolId, session.id, attendanceQuery(req));
    if (user.role === "teacher") {
      const classes = await dataStore.getTeacherClassAssignments(user.schoolId, session.id, user.id);
      const subjects = await dataStore.getTeacherSubjectAssignments(user.schoolId, session.id, user.id);
      const classKeys = new Set(classes.map((item) => `${item.className}\\0${item.section}`));
      const subjectIds = new Set(subjects.map((item) => item.subjectId));
      records = records.filter((record) => classKeys.has(`${record.className}\\0${record.section}`) && (record.subjectId === null || subjectIds.has(record.subjectId)));
    }
    return { session, records };
  };

  app.get(api.attendance.list.path, attendanceReaders, async (req, res) => {
    const { records } = await scopedAttendance(req, currentUser(req));
    return res.json(records);
  });

  app.post(api.attendance.mark.path, attendanceManagers, async (req, res) => {
    const input = api.attendance.mark.input.parse(req.body);
    const user = currentUser(req);
    const session = await dataStore.getActiveSession(user.schoolId);
    if (!session) return res.status(409).json({ message: "No active academic session" });
    if (!(await hasTeacherScope(user, input.className, input.section, input.subjectId ?? undefined))) {
      return res.status(403).json({ message: "Teacher is not assigned to this class or subject" });
    }
    try {
      const created = await dataStore.createAttendanceBulk(input.records.map((record) => ({
        ...record, className: input.className, section: input.section, attendanceDate: input.attendanceDate,
        subjectId: input.subjectId ?? null, schoolId: user.schoolId, sessionId: session.id, markedByUserId: user.id,
      })));
      return res.status(201).json(created);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to save attendance";
      return res.status(message.includes("Duplicate") ? 409 : 400).json({ message });
    }
  });

  app.patch(api.attendance.update.path, attendanceManagers, async (req, res) => {
    const input = api.attendance.update.input.parse(req.body);
    const user = currentUser(req);
    const session = await dataStore.getActiveSession(user.schoolId);
    if (!session) return res.status(409).json({ message: "No active academic session" });
    const records = await dataStore.getAttendance(user.schoolId, session.id);
    const target = records.find((record) => record.id === routeId(req.params.id));
    if (!target) return res.status(404).json({ message: "Attendance record not found" });
    if (!(await hasTeacherScope(user, target.className, target.section, target.subjectId ?? undefined))) return res.status(403).json({ message: "Attendance is outside your assignment" });
    const updated = await dataStore.updateAttendance(target.id, user.schoolId, session.id, input.status);
    return updated ? res.json(updated) : res.status(404).json({ message: "Attendance record not found" });
  });

  app.get(api.attendance.summary.path, attendanceReaders, async (req, res) => {
    const { records } = await scopedAttendance(req, currentUser(req));
    const counts = { present: 0, absent: 0, late: 0, leave: 0 };
    for (const record of records) counts[record.status as keyof typeof counts]++;
    const total = records.length;
    return res.json({ ...counts, total, percentage: total === 0 ? 0 : Math.round(((counts.present + counts.late) / total) * 10000) / 100 });
  });

  // === Students ===
  app.get(api.students.list.path, requireAuth, async (req, res) => {
    const user = currentUser(req);
    const filters = {
      class: typeof req.query.class === "string" ? req.query.class : undefined,
      section: typeof req.query.section === "string" ? req.query.section : undefined,
      search: typeof req.query.search === "string" ? req.query.search : undefined,
    };
    const activeSession = await dataStore.getActiveSession(user.schoolId);
    if (user.role === "student") {
      const student = activeSession ? await dataStore.getStudentForUser(user.id, user.schoolId, activeSession.id) : undefined;
      return res.json(student ? [safeStudent(student)] : []);
    }
    let students = activeSession
      ? await dataStore.getStudents(user.schoolId, filters, activeSession.id)
      : [];
    if (user.role === "teacher" && activeSession) {
      const assignments = await dataStore.getTeacherClassAssignments(user.schoolId, activeSession.id, user.id);
      const allowed = new Set(assignments.map((assignment) => `${assignment.className}\\0${assignment.section}`));
      students = students.filter((student) => allowed.has(`${student.class}\\0${student.section}`));
    }
    res.json(students.map(safeStudent));
  });

  app.post(api.students.create.path, requireRole("admin", "principal", "staff", "teacher"), async (req, res) => {
    const input = api.students.create.input.parse(req.body);
    const user = currentUser(req);
    const activeSession = await dataStore.getActiveSession(user.schoolId);
    if (!activeSession) return res.status(409).json({ message: "No active academic session" });
    const admissionNo = input.admissionNo?.trim() || `ADM-${new Date().getFullYear()}-${Date.now()}`;
    const student = await dataStore.createStudent({ ...input, admissionNo, schoolId: user.schoolId, sessionId: activeSession.id });
    res.status(201).json(safeStudent(student));
  });

  app.get(api.students.get.path, requireAuth, async (req, res) => {
    const user = currentUser(req);
    const requestedId = routeId(req.params.id);
    const activeSession = await dataStore.getActiveSession(user.schoolId);
    if (user.role === "student") {
      const own = activeSession ? await dataStore.getStudentForUser(user.id, user.schoolId, activeSession.id) : undefined;
      if (!own || own.id !== requestedId) return res.status(404).json({ message: "Student not found" });
      return res.json(safeStudent(own));
    }
    const student = await dataStore.getStudent(requestedId, user.schoolId);
    if (!student) return res.status(404).json({ message: "Student not found" });
    if (user.role === "teacher" && activeSession) {
      const assignments = await dataStore.getTeacherClassAssignments(user.schoolId, activeSession.id, user.id);
      if (!assignments.some((assignment) => assignment.className === student.class && assignment.section === student.section)) {
        return res.status(404).json({ message: "Student not found" });
      }
    }
    res.json(safeStudent(student));
  });

  app.put(api.students.update.path, requireRole("admin", "principal", "staff", "teacher"), async (req, res) => {
    const input = api.students.update.input.parse(req.body);
    const user = currentUser(req);
    const updated = await dataStore.updateStudent(routeId(req.params.id), user.schoolId, input);
    if (!updated) return res.status(404).json({ message: "Student not found" });
    res.json(safeStudent(updated));
  });

  app.post(api.students.deactivate.path, requireRole("admin", "principal", "staff"), async (req, res) => {
    const updated = await dataStore.deactivateStudent(routeId(req.params.id), currentUser(req).schoolId);
    if (!updated) return res.status(404).json({ message: "Student not found" });
    res.json(safeStudent(updated));
  });

  app.post(api.students.promote.path, requireRole("admin", "principal"), async (req, res) => {
    const input = api.students.promote.input.parse(req.body);
    const user = currentUser(req);
    await dataStore.promoteStudents(input.studentIds, user.schoolId, input.targetClass);
    res.json({ message: "Students promoted successfully" });
  });

  // === Fees ===
  app.get(api.fees.structures.list.path, requireAuth, async (req, res) => {
    const user = currentUser(req);
    const activeSession = await dataStore.getActiveSession(user.schoolId);
    const structures = activeSession
      ? await dataStore.getFeeStructures(user.schoolId, activeSession.id)
      : [];
    res.json(structures);
  });

  app.post(api.fees.structures.create.path, requireRole("admin", "accountant"), async (req, res) => {
    const input = api.fees.structures.create.input.parse(req.body);
    const user = currentUser(req);
    const activeSession = await dataStore.getActiveSession(user.schoolId);
    if (!activeSession) return res.status(409).json({ message: "No active academic session" });
    const structure = await dataStore.createFeeStructure({
      ...input,
      schoolId: user.schoolId,
      sessionId: activeSession.id,
    });
    res.status(201).json(structure);
  });

  app.put(api.fees.structures.update.path, requireRole("admin", "accountant"), async (req, res) => {
    const input = api.fees.structures.update.input.parse(req.body);
    const updated = await dataStore.updateFeeStructure(routeId(req.params.id), currentUser(req).schoolId, input);
    if (!updated) return res.status(404).json({ message: "Fee structure not found" });
    res.json(updated);
  });

  app.delete(api.fees.structures.delete.path, requireRole("admin", "accountant"), async (req, res) => {
    const deleted = await dataStore.deleteFeeStructure(routeId(req.params.id), currentUser(req).schoolId);
    if (!deleted) return res.status(409).json({ message: "Fee structure not found or already used by fee records" });
    res.status(204).send();
  });

  app.get(api.fees.payments.list.path, requireRole("admin", "principal", "accountant", "staff"), async (req, res) => {
    const user = currentUser(req);
    const studentId = req.query.studentId === undefined
      ? undefined
      : idSchema.parse(req.query.studentId);
    const activeSession = await dataStore.getActiveSession(user.schoolId);
    const requestedSession = req.query.sessionId === undefined ? activeSession?.id : idSchema.parse(req.query.sessionId);
    const payments = requestedSession === undefined ? [] : await dataStore.getFeePayments(user.schoolId, studentId, requestedSession);
    res.json(payments);
  });

  app.post(api.fees.payments.create.path, requireRole("admin", "accountant"), async (req, res) => {
    const input = api.fees.payments.create.input.parse(req.body);
    const user = currentUser(req);
    const activeSession = await dataStore.getActiveSession(user.schoolId);
    if (!activeSession) return res.status(409).json({ message: "No active academic session" });
    const payment = await dataStore.createFeePaymentForSchool({
      ...input,
      schoolId: user.schoolId,
      sessionId: activeSession.id,
    }, user.schoolId);
    if (!payment) return res.status(404).json({ message: "Student not found" });
    res.status(201).json(payment);
  });

  app.get(api.fees.payments.defaulters.path, requireRole("admin", "principal", "accountant", "staff"), async (req, res) => {
    const classStr = typeof req.query.class === "string" ? req.query.class : undefined;
    const month = z.string().min(1).parse(req.query.month);
    const year = req.query.year === undefined ? undefined : z.coerce.number().int().min(1900).max(2200).parse(req.query.year);
    const defaulters = await dataStore.getDefaulters(currentUser(req).schoolId, classStr, month, year);
    res.json(defaulters);
  });

  // === Staff ===
  app.get(api.staff.list.path, requireRole("admin", "principal"), async (req, res) => {
    const staffMembers = await dataStore.getStaff(currentUser(req).schoolId);
    res.json(staffMembers);
  });

  app.post(api.staff.create.path, requireRole("admin", "principal"), async (req, res) => {
    const input = api.staff.create.input.parse(req.body);
    const staffMember = await dataStore.createStaff({
      ...input,
      schoolId: currentUser(req).schoolId,
    });
    res.status(201).json(staffMember);
  });

  app.put(api.staff.update.path, requireRole("admin", "principal"), async (req, res) => {
    const input = api.staff.update.input.parse(req.body);
    const updated = await dataStore.updateStaff(routeId(req.params.id), currentUser(req).schoolId, input);
    if (!updated) return res.status(404).json({ message: "Staff member not found" });
    res.json(updated);
  });

  return httpServer;
}
