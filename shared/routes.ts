
import { z } from 'zod';
import { 
  insertSchoolSchema, insertUserSchema, insertStudentSchema, 
  insertFeeStructureSchema, insertFeePaymentSchema, insertStaffSchema,
  insertSubjectSchema, insertTeacherSubjectAssignmentSchema, insertTeacherClassAssignmentSchema, insertStudentUserLinkSchema, insertAttendanceSchema,
  insertExamSchema, insertExamClassScopeSchema, insertExamScheduleSchema, insertExamResultSchema,
  students, feePayments, schools, staff, feeStructures, academicSessions, subjects, teacherSubjectAssignments, teacherClassAssignments, studentUserLinks, attendanceRecords, exams, examClassScopes, examSchedules, examResults
} from './schema';

export const errorSchemas = {
  validation: z.object({
    message: z.string(),
    field: z.string().optional(),
  }),
  notFound: z.object({
    message: z.string(),
  }),
  internal: z.object({
    message: z.string(),
  }),
};

export const api = {
  // === Schools ===
  schools: {
    get: {
      method: 'GET' as const,
      path: '/api/schools/:id',
      responses: {
        200: z.custom<typeof schools.$inferSelect>(),
        404: errorSchemas.notFound,
      },
    },
    update: {
      method: 'PUT' as const,
      path: '/api/schools/:id',
      input: insertSchoolSchema.partial(),
      responses: {
        200: z.custom<typeof schools.$inferSelect>(),
      },
    },
  },

  // === Academic sessions ===
  sessions: {
    active: {
      method: 'GET' as const,
      path: '/api/academic-sessions/active',
      responses: { 200: z.custom<import('./schema').AcademicSession | null>() },
    },
  },

  // === Students ===
  students: {
    list: {
      method: 'GET' as const,
      path: '/api/students',
      input: z.object({
        class: z.string().optional(),
        section: z.string().optional(),
        search: z.string().optional(),
        sessionId: z.string().optional(),
      }).optional(),
      responses: {
        200: z.array(z.custom<typeof students.$inferSelect>()),
      },
    },
    create: {
      method: 'POST' as const,
      path: '/api/students',
      input: insertStudentSchema,
      responses: {
        201: z.custom<typeof students.$inferSelect>(),
      },
    },
    get: {
      method: 'GET' as const,
      path: '/api/students/:id',
      responses: {
        200: z.custom<typeof students.$inferSelect>(),
        404: errorSchemas.notFound,
      },
    },
    update: {
      method: 'PUT' as const,
      path: '/api/students/:id',
      input: insertStudentSchema.partial(),
      responses: {
        200: z.custom<typeof students.$inferSelect>(),
      },
    },
    deactivate: {
      method: 'POST' as const,
      path: '/api/students/:id/deactivate',
      responses: { 200: z.custom<typeof students.$inferSelect>() },
    },
    promote: {
      method: 'POST' as const,
      path: '/api/students/promote',
      input: z.object({
        studentIds: z.array(z.number()),
        targetClass: z.string(),
      }),
      responses: {
        200: z.object({ message: z.string() }),
      },
    },
  },

  // === Fees ===
  fees: {
    structures: {
      list: {
        method: 'GET' as const,
        path: '/api/fee-structures',
        responses: {
          200: z.array(z.custom<typeof feeStructures.$inferSelect>()),
        },
      },
      create: {
        method: 'POST' as const,
        path: '/api/fee-structures',
        input: insertFeeStructureSchema,
        responses: {
          201: z.custom<typeof feeStructures.$inferSelect>(),
        },
      },
      update: {
        method: 'PUT' as const,
        path: '/api/fee-structures/:id',
        input: insertFeeStructureSchema.partial(),
        responses: { 200: z.custom<typeof feeStructures.$inferSelect>() },
      },
      delete: {
        method: 'DELETE' as const,
        path: '/api/fee-structures/:id',
        responses: { 204: z.null() },
      },
    },
    payments: {
      create: {
        method: 'POST' as const,
        path: '/api/payments',
        input: insertFeePaymentSchema,
        responses: {
          201: z.custom<typeof feePayments.$inferSelect>(),
        },
      },
      list: {
        method: 'GET' as const,
        path: '/api/payments',
        input: z.object({
          studentId: z.string().optional(),
          sessionId: z.string().optional(),
        }).optional(),
        responses: {
          200: z.array(z.custom<typeof feePayments.$inferSelect>()),
        },
      },
      defaulters: {
        method: 'GET' as const,
        path: '/api/fees/defaulters',
        input: z.object({
          class: z.string().optional(),
          month: z.string(),
          year: z.string().optional(),
        }),
        responses: {
          200: z.array(z.object({
            studentId: z.number(),
            name: z.string(),
            class: z.string(),
            section: z.string(),
            amountPaid: z.number(),
            amountPending: z.number(),
            month: z.string(),
            year: z.number(),
          })),
        },
      },
    },
  },

  // === Role and assignment foundation ===
  subjects: {
    list: {
      method: 'GET' as const,
      path: '/api/subjects',
      responses: { 200: z.array(z.custom<typeof subjects.$inferSelect>()) },
    },
    create: {
      method: 'POST' as const,
      path: '/api/subjects',
      input: insertSubjectSchema,
      responses: { 201: z.custom<typeof subjects.$inferSelect>() },
    },
    update: {
      method: 'PATCH' as const,
      path: '/api/subjects/:id',
      input: insertSubjectSchema.partial(),
      responses: { 200: z.custom<typeof subjects.$inferSelect>() },
    },
    delete: {
      method: 'DELETE' as const,
      path: '/api/subjects/:id',
      responses: { 204: z.null() },
    },
  },
  assignments: {
    list: {
      method: 'GET' as const,
      path: '/api/teacher-assignments',
      responses: { 200: z.object({ subjects: z.array(z.custom<typeof teacherSubjectAssignments.$inferSelect>()), classes: z.array(z.custom<typeof teacherClassAssignments.$inferSelect>()) }) },
    },
    assignSubject: {
      method: 'POST' as const,
      path: '/api/teacher-subject-assignments',
      input: insertTeacherSubjectAssignmentSchema,
      responses: { 201: z.custom<typeof teacherSubjectAssignments.$inferSelect>() },
    },
    removeSubject: {
      method: 'DELETE' as const,
      path: '/api/teacher-subject-assignments/:id',
      responses: { 204: z.null() },
    },
    assignClass: {
      method: 'POST' as const,
      path: '/api/teacher-class-assignments',
      input: insertTeacherClassAssignmentSchema,
      responses: { 201: z.custom<typeof teacherClassAssignments.$inferSelect>() },
    },
    removeClass: {
      method: 'DELETE' as const,
      path: '/api/teacher-class-assignments/:id',
      responses: { 204: z.null() },
    },
  },
  studentLinks: {
    create: {
      method: 'POST' as const,
      path: '/api/student-user-links',
      input: insertStudentUserLinkSchema,
      responses: { 201: z.custom<typeof studentUserLinks.$inferSelect>() },
    },
  },

  // === Exams ===
  exams: {
    list: { method: 'GET' as const, path: '/api/exams', input: z.object({ status: z.string().optional(), class: z.string().optional(), section: z.string().optional() }).optional(), responses: { 200: z.array(z.custom<typeof exams.$inferSelect>()) } },
    get: { method: 'GET' as const, path: '/api/exams/:id', responses: { 200: z.object({ exam: z.custom<typeof exams.$inferSelect>(), scopes: z.array(z.custom<typeof examClassScopes.$inferSelect>()), schedules: z.array(z.custom<typeof examSchedules.$inferSelect>()) }) } },
    create: { method: 'POST' as const, path: '/api/exams', input: z.object({ ...insertExamSchema.shape, scopes: z.array(insertExamClassScopeSchema).min(1).max(100) }), responses: { 201: z.object({ exam: z.custom<typeof exams.$inferSelect>(), scopes: z.array(z.custom<typeof examClassScopes.$inferSelect>()) }) } },
    update: { method: 'PATCH' as const, path: '/api/exams/:id', input: insertExamSchema.partial(), responses: { 200: z.custom<typeof exams.$inferSelect>() } },
    status: { method: 'POST' as const, path: '/api/exams/:id/status', input: z.object({ status: z.enum(["draft", "published", "completed", "archived"]) }), responses: { 200: z.custom<typeof exams.$inferSelect>() } },
    addSchedule: { method: 'POST' as const, path: '/api/exams/:id/schedules', input: insertExamScheduleSchema, responses: { 201: z.custom<typeof examSchedules.$inferSelect>() } },
    updateSchedule: { method: 'PATCH' as const, path: '/api/exam-schedules/:id', input: insertExamScheduleSchema.partial(), responses: { 200: z.custom<typeof examSchedules.$inferSelect>() } },
    removeSchedule: { method: 'DELETE' as const, path: '/api/exam-schedules/:id', responses: { 204: z.null() } },
  },

  // === Exam Results / Marks ===
  examResults: {
    list: { method: 'GET' as const, path: '/api/exam-results', input: z.object({ examId: z.string().optional(), scheduleId: z.string().optional(), studentId: z.string().optional(), class: z.string().optional(), section: z.string().optional(), status: z.string().optional() }).optional(), responses: { 200: z.array(z.custom<typeof examResults.$inferSelect>()) } },
    student: { method: 'GET' as const, path: '/api/exam-results/student/:studentId', responses: { 200: z.array(z.custom<typeof examResults.$inferSelect>()) } },
    bulk: { method: 'POST' as const, path: '/api/exam-results/bulk', input: z.object({ examId: z.number().int().positive(), scheduleId: z.number().int().positive(), className: z.string().trim().min(1), section: z.string().trim().min(1), records: z.array(z.object({ studentId: z.number().int().positive(), obtainedMarks: z.number().int().nonnegative().nullable().optional(), isAbsent: z.boolean().optional(), remarks: z.string().max(500).nullable().optional() }).strict()).min(1).max(500) }).strict(), responses: { 201: z.array(z.custom<typeof examResults.$inferSelect>()) } },
    update: { method: 'PATCH' as const, path: '/api/exam-results/:id', input: z.object({ obtainedMarks: z.number().int().nonnegative().nullable().optional(), isAbsent: z.boolean().optional(), remarks: z.string().max(500).nullable().optional() }).strict(), responses: { 200: z.custom<typeof examResults.$inferSelect>() } },
    status: { method: 'POST' as const, path: '/api/exam-results/status', input: z.object({ examId: z.number().int().positive(), status: z.enum(["draft", "published"]) }), responses: { 200: z.object({ updated: z.number() }) } },
    summary: { method: 'GET' as const, path: '/api/exam-results/summary', input: z.object({ examId: z.string().optional(), studentId: z.string().optional() }).optional(), responses: { 200: z.object({ totalObtained: z.number(), totalMaximum: z.number(), percentage: z.number(), passed: z.number(), failed: z.number(), absent: z.number() }) } },
  },

  // === Attendance ===
  attendance: {
    list: {
      method: 'GET' as const,
      path: '/api/attendance',
      input: z.object({
        from: z.string().optional(), to: z.string().optional(), date: z.string().optional(),
        class: z.string().optional(), section: z.string().optional(), subjectId: z.string().optional(), studentId: z.string().optional(),
      }).optional(),
      responses: { 200: z.array(z.custom<typeof attendanceRecords.$inferSelect>()) },
    },
    mark: {
      method: 'POST' as const,
      path: '/api/attendance/bulk',
      input: z.object({
        className: z.string().trim().min(1), section: z.string().trim().min(1), attendanceDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), subjectId: z.number().int().positive().nullable().optional(),
        records: z.array(z.object({ studentId: z.number().int().positive(), status: z.enum(["present", "absent", "late", "leave"]) }).strict()).min(1).max(500),
      }).strict(),
      responses: { 201: z.array(z.custom<typeof attendanceRecords.$inferSelect>()) },
    },
    update: {
      method: 'PATCH' as const,
      path: '/api/attendance/:id',
      input: z.object({ status: z.enum(["present", "absent", "late", "leave"]) }).strict(),
      responses: { 200: z.custom<typeof attendanceRecords.$inferSelect>() },
    },
    summary: {
      method: 'GET' as const,
      path: '/api/attendance/summary',
      input: z.object({ from: z.string().optional(), to: z.string().optional(), studentId: z.string().optional(), class: z.string().optional(), section: z.string().optional(), subjectId: z.string().optional() }).optional(),
      responses: { 200: z.object({ total: z.number(), present: z.number(), absent: z.number(), late: z.number(), leave: z.number(), percentage: z.number() }) },
    },
  },

  // === Staff ===
  staff: {
    list: {
      method: 'GET' as const,
      path: '/api/staff',
      responses: {
        200: z.array(z.custom<typeof staff.$inferSelect>()),
      },
    },
    create: {
      method: 'POST' as const,
      path: '/api/staff',
      input: insertStaffSchema,
      responses: {
        201: z.custom<typeof staff.$inferSelect>(),
      },
    },
    update: {
      method: 'PUT' as const,
      path: '/api/staff/:id',
      input: insertStaffSchema.partial(),
      responses: { 200: z.custom<typeof staff.$inferSelect>() },
    },
  },
};

export function buildUrl(path: string, params?: Record<string, string | number>): string {
  let url = path;
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (url.includes(`:${key}`)) {
        url = url.replace(`:${key}`, String(value));
      }
    });
  }
  return url;
}
