import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
const schema = await readFile("shared/schema.ts", "utf8"); const migration = await readFile("migrations/0008_financial_management.sql", "utf8"); const routes = await readFile("server/routes.ts", "utf8");
for (const token of ["expenseCategories", "expenses", "expenses_amount_positive", "expenses_category_school_fk", "expenses_session_school_fk"]) assert.match(schema, new RegExp(token));
for (const token of ["expense_categories_school_fk", "expenses_category_school_fk", "expenses_session_school_fk", "expenses_creator_school_fk"]) assert.match(migration, new RegExp(token));
for (const token of ["getFinancialFeeIncome", "getPaidPayroll", "totalFeeIncome", "totalPayrollExpense", "netBalance", "financialManagers"]) assert.match(routes, new RegExp(token));
assert.match(routes, /status === "finalized"/); assert.match(routes, /status === "paid"/);
assert.doesNotMatch(routes, /totalIncome.*random|Math\.random/);
console.log("Financial foundation tests passed.");
