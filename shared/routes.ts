
import { z } from 'zod';
import { 
  insertSchoolSchema, insertUserSchema, insertStudentSchema, 
  insertFeeStructureSchema, insertFeePaymentSchema, insertStaffSchema,
  insertSubjectSchema, insertTeacherSubjectAssignmentSchema, insertTeacherClassAssignmentSchema, insertStudentUserLinkSchema,
  students, feePayments, schools, staff, feeStructures, academicSessions, subjects, teacherSubjectAssignments, teacherClassAssignments, studentUserLinks
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
