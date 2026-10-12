import "dotenv/config";

if ((process.env.NODE_ENV ?? "development") !== "development") {
  throw new Error("The database seed can only run with NODE_ENV=development");
}

const { storage } = await import("../server/storage");
const { hashPassword } = await import("../server/auth");

async function seedDatabase() {
  const existingSchool = await storage.getSchool(1);
  if (existingSchool) {
    console.log("Development seed skipped: school 1 already exists.");
    return;
  }

  console.log("Seeding development database...");

  const school = await storage.createSchool({
    name: "St. Xavier's Public School",
    address: "123, MG Road, New Delhi",
    contact: "9876543210",
    logo: "https://placehold.co/100x100?text=Logo",
  });

  const session = await storage.createAcademicSession({
    name: "Development Session",
    isActive: true,
    schoolId: school.id,
  });

  const seedAdminPassword = process.env.SEED_ADMIN_PASSWORD;
  if (seedAdminPassword) {
    await storage.createUser({
      username: "admin",
      passwordHash: await hashPassword(seedAdminPassword),
      role: "admin",
      name: "Principal",
      schoolId: school.id,
    });
  } else {
    console.warn(
      "SEED_ADMIN_PASSWORD is not set; no development admin user was created.",
    );
  }

  await storage.createFeeStructure({
    class: "10",
    monthlyFee: 1500,
    admissionFee: 5000,
    schoolId: school.id,
    sessionId: session.id,
  });

  const student = await storage.createStudent({
    admissionNo: "A001",
    name: "Rohan Kumar",
    fatherName: "Suresh Kumar",
    class: "10",
    section: "A",
    rollNo: "1",
    contact: "9988776655",
    address: "Sector 4, Delhi",
    schoolId: school.id,
    sessionId: session.id,
  });

  await storage.createFeePayment({
    studentId: student.id,
    amount: 1500,
    month: "January",
    year: 2024,
    receiptNo: "REC001",
    remarks: "Cash",
    schoolId: school.id,
    sessionId: session.id,
  });

  console.log("Development seed complete.");
}

seedDatabase().catch((error) => {
  console.error("Development seed failed:", error);
  process.exitCode = 1;
});
