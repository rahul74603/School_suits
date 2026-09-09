import assert from "node:assert/strict";
import { calculateReportTotals, gradeForPercentage } from "../server/report-card";
import { readFile } from "node:fs/promises";

assert.equal(gradeForPercentage(95), "A+");
assert.equal(gradeForPercentage(82), "A");
assert.equal(gradeForPercentage(73), "B+");
assert.equal(gradeForPercentage(61), "B");
assert.equal(gradeForPercentage(52), "C");
assert.equal(gradeForPercentage(40), "D");
assert.equal(gradeForPercentage(39), "F");
const totals = calculateReportTotals([
  { maxMarks: 100, obtainedMarks: 80, absent: false, subjectResult: "Pass" },
  { maxMarks: 50, obtainedMarks: null, absent: true, subjectResult: "Absent" },
  { maxMarks: 100, obtainedMarks: 30, absent: false, subjectResult: "Fail" },
]);
assert.deepEqual(totals, { totalObtained: 110, totalMaximum: 250, percentage: 55, passed: 1, failed: 2, absent: 1, overallResult: "Fail", grade: "C" });
const routes = await readFile("server/routes.ts", "utf8");
assert.match(routes, /published/);
assert.match(routes, /Report card not found/);
assert.match(routes, /getStudentForUser/);
console.log("Report card calculation tests passed.");
