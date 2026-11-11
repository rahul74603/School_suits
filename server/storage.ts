import { 
    users, schools, students, feeStructures, feePayments, staff, studentDues,
    type User, type InsertUser, type School, type InsertSchool,
    type Student, type InsertStudent, type FeeStructure, type InsertFeeStructure,
    type FeePayment, type InsertFeePayment, type Staff, type InsertStaff,
    type StudentDues, type InsertStudentDues
 } from "@shared/schema";
import { eq, ilike, and } from "drizzle-orm";
import { db } from "./db";
import * as schema from "@shared/schema";

// 1. Interface Definition
export interface IStorage {
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;

  getSchools(): Promise<School[]>;
  getSchool(id: number): Promise<School | undefined>;
  createSchool(school: InsertSchool): Promise<School>;
  updateSchool(id: number, school: Partial<InsertSchool>): Promise<School>;

  getStudent(id: number): Promise<Student | undefined>;
  getStudents(schoolId: number, filters?: { class?: string, section?: string, search?: string }): Promise<Student[]>;
  createStudent(student: InsertStudent): Promise<Student>;
  updateStudent(id: number, student: Partial<InsertStudent>): Promise<Student>;
  promoteStudents(studentIds: number[], targetClass: string): Promise<void>;

  getFeeStructures(schoolId: number): Promise<FeeStructure[]>;
  createFeeStructure(structure: InsertFeeStructure): Promise<FeeStructure>;

  getFeePayments(schoolId: number, studentId?: number): Promise<FeePayment[]>;
  createFeePayment(payment: InsertFeePayment): Promise<FeePayment>;
  
  getDefaulters(schoolId: number, classStr?: string, month?: string): Promise<{ studentId: number, name: string, amountPending: number }[]> ;
  
  getStaff(schoolId: number): Promise<Staff[]>;
  createStaff(staff: InsertStaff): Promise<Staff>;
  
  getStudentStatus(studentId: number, classStr: string, year: number): Promise<{
    admissionPaid: boolean;
    admissionBalance: number;
    admissionPaidSoFar: number;
    admissionTotal: number;
    monthStatus: Array<{
      name: string;
      tuitionStatus: 'paid' | 'due' | 'future';
      transportStatus: 'paid' | 'due' | 'future';
      extras?: Array<{ name: string; amount: number; status: 'paid' | 'due' | 'future' }>;
    }>;
    pendingDues: Array<{
      id: number;
      fee_name: string;
      due_date: string;
      amount: number;
    }>;
    monthlyFee: number;
  }>;
} // <-- interface yahan band hona chahiye tha

// 2. Database Implementation
export class DatabaseStorage implements IStorage {
  async getUser(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db.insert(users).values(insertUser).returning();
    return user;
  }

  async getSchools(): Promise<School[]> {
    return await db.select().from(schools);
  }

  async getSchool(id: number): Promise<School | undefined> {
    const [school] = await db.select().from(schools).where(eq(schools.id, id));
    return school;
  }

  async createSchool(insertSchool: InsertSchool): Promise<School> {
    const [school] = await db.insert(schools).values(insertSchool).returning();
    return school;
  }

  async updateSchool(id: number, schoolUpdate: Partial<InsertSchool>): Promise<School> {
    const [school] = await db.update(schools).set(schoolUpdate).where(eq(schools.id, id)).returning();
    return school;
  }

  async getStudent(id: number): Promise<Student | undefined> {
    const [student] = await db.select().from(students).where(eq(students.id, id));
    return student;
  }

  async getStudents(schoolId: number, filters?: { class?: string, section?: string, search?: string }): Promise<Student[]> {
    let conditions = [eq(students.schoolId, schoolId), eq(students.isActive, 1)];
    
    if (filters?.class && filters.class !== 'all') conditions.push(eq(students.class, filters.class));
    if (filters?.section && filters.section !== 'all') conditions.push(eq(students.section, filters.section));
    if (filters?.search) conditions.push(ilike(students.name, `%${filters.search}%`));

    return await db.select().from(students).where(and(...conditions));
  }

  async createStudent(insertStudent: InsertStudent): Promise<Student> {
    const [student] = await db.insert(students).values(insertStudent).returning();
    return student;
  }

  async updateStudent(id: number, studentUpdate: Partial<InsertStudent>): Promise<Student> {
    const [student] = await db.update(students).set(studentUpdate).where(eq(students.id, id)).returning();
    return student;
  }

  async promoteStudents(studentIds: number[], targetClass: string): Promise<void> {
    for (const id of studentIds) {
      await db.update(students).set({ class: targetClass, isPromoted: 1 }).where(eq(students.id, id));
    }
  }

  async getFeeStructures(schoolId: number): Promise<FeeStructure[]> {
    return await db.select().from(feeStructures).where(eq(feeStructures.schoolId, schoolId));
  }

  async createFeeStructure(insertStructure: InsertFeeStructure): Promise<FeeStructure> {
    const [structure] = await db.insert(feeStructures).values(insertStructure).returning();
    return structure;
  }

  async getFeePayments(schoolId: number, studentId?: number): Promise<FeePayment[]> {
    if (studentId) {
      return await db.select().from(feePayments).where(eq(feePayments.studentId, studentId));
    }
    return await db.select().from(feePayments).where(eq(feePayments.schoolId, schoolId));
  }

  async createFeePayment(insertPayment: InsertFeePayment): Promise<FeePayment> {
    const [payment] = await db.insert(feePayments).values(insertPayment).returning();
    return payment;
  }

  async getDefaulters(schoolId: number, classStr?: string, month?: string): Promise<{ studentId: number, name: string, amountPending: number }[]> {
    return [];
  }

  async getStaff(schoolId: number): Promise<Staff[]> {
    return await db.select().from(staff).where(and(eq(staff.schoolId, schoolId), eq(staff.isActive, 1)));
  }

  async createStaff(insertStaff: InsertStaff): Promise<Staff> {
    const [newStaff] = await db.insert(staff).values(insertStaff).returning();
    return newStaff;
  }

  async getStudentStatus(studentId: number, classStr: string, year: number): Promise<{
    admissionPaid: boolean;
    admissionBalance: number;
    admissionPaidSoFar: number;
    admissionTotal: number;
    monthStatus: Array<{
      name: string;
      tuitionStatus: 'paid' | 'due' | 'future';
      transportStatus: 'paid' | 'due' | 'future';
      extras?: Array<{ name: string; amount: number; status: 'paid' | 'due' | 'future' }>;
    }>;
    pendingDues: Array<{
      id: number;
      fee_name: string;
      due_date: string;
      amount: number;
    }>;
    monthlyFee: number;
  }> {
    const [student] = await db.select().from(students).where(eq(students.id, studentId));
    if (!student) throw new Error("Student not found");

    const [feeStructure] = await db.select().from(feeStructures)
      .where(and(eq(feeStructures.schoolId, student.schoolId ?? 0), eq(feeStructures.class, classStr)));
    
    if (!feeStructure) {
        return {
            admissionPaid: false,
            admissionBalance: 0,
            admissionPaidSoFar: 0,
            admissionTotal: 0,
            monthStatus: [],
            pendingDues: [],
            monthlyFee: 0
        };
    }

    const payments = await db.select().from(feePayments)
      .where(and(eq(feePayments.studentId, studentId), eq(feePayments.year, year)));

    const admissionPayments = payments.filter(p => p.remarks === "ADMISSION_FEE");
    const admissionTotal = feeStructure.admissionFee ?? 0;
    
    const admissionPaidSoFar = admissionPayments.reduce((sum, p) => sum + (p.amount ?? 0), 0);
    const admissionBalance = Math.max(0, admissionTotal - admissionPaidSoFar);
    const admissionPaid = admissionBalance === 0;

    type MonthData = {
        name: string;
        tuitionStatus: 'paid' | 'due' | 'future';
        transportStatus: 'paid' | 'due' | 'future';
        extras?: { name: string; amount: number; status: 'paid' | 'due' | 'future' }[];
    };

    const months: MonthData[] = [
      { name: "April", tuitionStatus: 'due', transportStatus: 'due' },
      { name: "May", tuitionStatus: 'due', transportStatus: 'due' },
      { name: "June", tuitionStatus: 'due', transportStatus: 'due' },
      { name: "July", tuitionStatus: 'due', transportStatus: 'due' },
      { name: "August", tuitionStatus: 'due', transportStatus: 'due' },
      { name: "September", tuitionStatus: 'due', transportStatus: 'due' },
      { name: "October", tuitionStatus: 'due', transportStatus: 'due' },
      { name: "November", tuitionStatus: 'due', transportStatus: 'due' },
      { name: "December", tuitionStatus: 'due', transportStatus: 'due' },
      { name: "January", tuitionStatus: 'due', transportStatus: 'due' },
      { name: "February", tuitionStatus: 'due', transportStatus: 'due' },
      { name: "March", tuitionStatus: 'due', transportStatus: 'due' }
    ];

     payments.forEach(payment => {
       const monthName = payment.month;
       const month = months.find(m => m.name === monthName);
       if (month) {
         if (payment.remarks === "TUITION_FEE") {
           month.tuitionStatus = 'paid';
         } else if (payment.remarks === "TRANSPORT_FEE") {
           month.transportStatus = 'paid';
         } else if (payment.remarks === "ADMISSION_FEE") {
           // Already handled above
         } else {
           if (!month.extras) month.extras = [];
           month.extras.push({
             name: payment.remarks || "Other Fee",
             amount: payment.amount ?? 0,
             status: 'paid'
           });
         }
       }
     });

     // Fetch pending dues from student_dues table
     const pendingDuesList = await db.select()
       .from(schema.studentDues)
       .where(and(eq(schema.studentDues.studentId, studentId), eq(schema.studentDues.isPaid, 0)));

     return {
       admissionPaid,
       admissionBalance,
       admissionPaidSoFar,
       admissionTotal,
       monthStatus: months,
      pendingDues: pendingDuesList.map(due => ({
        id: due.id,
        fee_name: due.feeName,
        due_date: due.dueDate.toISOString(),
        amount: due.amount
      })),
       monthlyFee: feeStructure.monthlyFee ?? 0
     };
  }
}

// 3. Mock Storage
export class MockStorage implements IStorage {
  private usersData: User[] = [];
  private schoolsData: School[] = [
    {
      id: 1,
      name: "Offline Demo School",
      logo: null,
      address: "Local Development",
      phone: "",
      email: null,
      primaryColor: "#1976D2",
      secondaryColor: "#FF9800",
      isActive: 1,
      createdAt: new Date(),
    },
  ];
  private studentsData: Student[] = [];
  private feeStructuresData: FeeStructure[] = [];
  private feePaymentsData: FeePayment[] = [];
  private staffData: Staff[] = [];

  private nextUserId = 1;
  private nextSchoolId = 2;
  private nextStudentId = 1;
  private nextFeeStructureId = 1;
  private nextFeePaymentId = 1;
  private nextStaffId = 1;

  async getUser(id: number): Promise<User | undefined> {
    return this.usersData.find((item) => item.id === id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return this.usersData.find((item) => item.username === username);
  }

  async createUser(user: InsertUser): Promise<User> {
    const created: User = {
      id: this.nextUserId++,
      schoolId: user.schoolId ?? null,
      username: user.username,
      password: user.password,
      role: user.role ?? "staff",
      name: user.name,
      isActive: user.isActive ?? 1,
      createdAt: new Date(),
    };
    this.usersData.push(created);
    return created;
  }

  async getSchools(): Promise<School[]> {
    return [...this.schoolsData];
  }

  async getSchool(id: number): Promise<School | undefined> {
    return this.schoolsData.find((item) => item.id === id);
  }

  async createSchool(school: InsertSchool): Promise<School> {
    const created: School = {
      id: this.nextSchoolId++,
      name: school.name,
      logo: school.logo ?? null,
      address: school.address,
      phone: school.phone,
      email: school.email ?? null,
      primaryColor: school.primaryColor ?? "#1976D2",
      secondaryColor: school.secondaryColor ?? "#FF9800",
      isActive: school.isActive ?? 1,
      createdAt: new Date(),
    };
    this.schoolsData.push(created);
    return created;
  }

  async updateSchool(id: number, school: Partial<InsertSchool>): Promise<School> {
    const index = this.schoolsData.findIndex((item) => item.id === id);
    if (index < 0) throw new Error("School not found");
    const updated: School = { ...this.schoolsData[index], ...school };
    this.schoolsData[index] = updated;
    return updated;
  }

  async getStudent(id: number): Promise<Student | undefined> {
    return this.studentsData.find((item) => item.id === id);
  }

  async getStudents(schoolId: number, filters?: { class?: string; section?: string; search?: string }): Promise<Student[]> {
    let rows = this.studentsData.filter((item) => item.schoolId === schoolId && item.isActive === 1);
    if (filters?.class && filters.class !== "all") rows = rows.filter((item) => item.class === filters.class);
    if (filters?.section && filters.section !== "all") rows = rows.filter((item) => item.section === filters.section);
    if (filters?.search) {
      const search = filters.search.toLowerCase();
      rows = rows.filter((item) => item.name.toLowerCase().includes(search) || item.admissionNo.toLowerCase().includes(search));
    }
    return rows;
  }

  async createStudent(student: InsertStudent): Promise<Student> {
    const created: Student = {
      id: this.nextStudentId++, schoolId: student.schoolId ?? 1, admissionNo: student.admissionNo,
      name: student.name, fatherName: student.fatherName, motherName: student.motherName ?? null,
      class: student.class, section: student.section, rollNo: student.rollNo ?? null,
      aadhaar: student.aadhaar ?? null, birthCertificateNo: student.birthCertificateNo ?? null,
      previousSchoolName: student.previousSchoolName ?? null, previousClass: student.previousClass ?? null,
      tcNumber: student.tcNumber ?? null, tcIssueDate: student.tcIssueDate ?? null,
      tcSubmitted: student.tcSubmitted ?? 0, reportCardSubmitted: student.reportCardSubmitted ?? 0,
      category: student.category ?? null, dob: student.dob ?? null, contact: student.contact,
      address: student.address ?? null, photo: student.photo ?? null, isActive: student.isActive ?? 1,
      isPromoted: student.isPromoted ?? 0, createdAt: new Date(),
    };
    this.studentsData.push(created);
    return created;
  }

  async updateStudent(id: number, student: Partial<InsertStudent>): Promise<Student> {
    const index = this.studentsData.findIndex((item) => item.id === id);
    if (index < 0) throw new Error("Student not found");
    const updated: Student = { ...this.studentsData[index], ...student };
    this.studentsData[index] = updated;
    return updated;
  }

  async promoteStudents(studentIds: number[], targetClass: string): Promise<void> {
    this.studentsData = this.studentsData.map((item) => studentIds.includes(item.id) ? { ...item, class: targetClass, isPromoted: 1 } : item);
  }

  async getFeeStructures(schoolId: number): Promise<FeeStructure[]> {
    return this.feeStructuresData.filter((item) => item.schoolId === schoolId);
  }

  async createFeeStructure(structure: InsertFeeStructure): Promise<FeeStructure> {
    const created: FeeStructure = { id: this.nextFeeStructureId++, schoolId: structure.schoolId ?? 1, class: structure.class, monthlyFee: structure.monthlyFee, admissionFee: structure.admissionFee ?? 0, examFee: structure.examFee ?? 0, otherFee: structure.otherFee ?? 0, createdAt: new Date() };
    this.feeStructuresData.push(created);
    return created;
  }

  async getFeePayments(schoolId: number, studentId?: number): Promise<FeePayment[]> {
    return studentId ? this.feePaymentsData.filter(i => i.studentId === studentId) : this.feePaymentsData.filter(i => i.schoolId === schoolId);
  }

  async createFeePayment(payment: InsertFeePayment): Promise<FeePayment> {
    const created: FeePayment = { id: this.nextFeePaymentId++, studentId: payment.studentId ?? null, schoolId: payment.schoolId ?? 1, amount: payment.amount, month: payment.month, year: payment.year, paymentDate: new Date(), receiptNo: payment.receiptNo, paymentMethod: payment.paymentMethod ?? "Cash", remarks: payment.remarks ?? null, createdAt: new Date() };
    this.feePaymentsData.push(created);
    return created;
  }

  async getDefaulters(schoolId: number, classStr?: string): Promise<{ studentId: number; name: string; amountPending: number }[]> { return []; }

  async getStaff(schoolId: number): Promise<Staff[]> {
    return this.staffData.filter((item) => item.schoolId === schoolId && item.isActive === 1);
  }

  async createStaff(staffMember: InsertStaff): Promise<Staff> {
    const created: Staff = { id: this.nextStaffId++, schoolId: staffMember.schoolId ?? 1, name: staffMember.name, designation: staffMember.designation, qualification: staffMember.qualification ?? null, contact: staffMember.contact, email: staffMember.email ?? null, basicSalary: staffMember.basicSalary, advanceGiven: staffMember.advanceGiven ?? 0, joinDate: staffMember.joinDate ?? null, isActive: staffMember.isActive ?? 1, createdAt: new Date() };
    this.staffData.push(created);
    return created;
  }

  async getStudentStatus(studentId: number, classStr: string, year: number) {
     const feeStructure = this.feeStructuresData.find(i => i.class === classStr);
     return { admissionPaid: true, admissionBalance: 0, admissionPaidSoFar: 0, admissionTotal: 0, monthStatus: [], pendingDues: [], monthlyFee: feeStructure?.monthlyFee ?? 0 };
  }
}

// 4. Export Instance
const hasDatabaseUrl = Boolean(process.env.DATABASE_URL?.trim());
// MockStorage is ONLY for explicit local development (USE_MOCK_STORAGE=1).
// It must never be selected silently: its data is in-memory and is lost on
// restart, which would silently discard a school's real records.
const useMockStorage = process.env.USE_MOCK_STORAGE === "1";
if (!useMockStorage && !hasDatabaseUrl) {
  throw new Error(
    "DATABASE_URL is not set. Set it, or set USE_MOCK_STORAGE=1 for throwaway local development."
  );
}
export const storage: IStorage = useMockStorage ? new MockStorage() : new DatabaseStorage();