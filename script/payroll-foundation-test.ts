import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
const schema = await readFile("shared/schema.ts", "utf8"); const migration = await readFile("migrations/0007_payroll_foundation.sql", "utf8"); const routes = await readFile("server/routes.ts", "utf8");
for (const token of ["salaryStructures", "payrollRecords", "staffUserLinks", "salary_structures_amounts_nonnegative", "payroll_amounts_nonnegative", "payroll_status_valid", "payroll_staff_month_unique"]) assert.match(schema, new RegExp(token));
for (const token of ["staff_user_links_staff_school_fk", "salary_structures_session_school_fk", "payroll_staff_school_fk", "payroll_session_school_fk", "payroll_staff_month_unique"]) assert.match(migration, new RegExp(token));
for (const token of ["createPayroll", "setPayrollStatus", "getStaffForUser", "payrollManagers", "totalNet"]) assert.match(routes, new RegExp(token));
assert.match(schema, /netSalary/); assert.match(schema, /payrollMonth/);
console.log("Payroll foundation tests passed.");
