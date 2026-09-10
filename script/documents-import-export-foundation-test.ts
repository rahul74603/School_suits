import assert from "node:assert/strict";
import { csvCell, parseCsv, toCsv } from "../server/csv";

const parsed = parseCsv("admissionNo,name,contact\nA-1,Jane Doe,999\n");
assert.equal(parsed.rows[0].admissionNo, "A-1");
assert.throws(() => parseCsv("a,b\n1\n"), /wrong number/);
assert.equal(csvCell("=SUM(A1:A2)"), "'=SUM(A1:A2)");
const exported = toCsv(["name", "contact"], [{ name: "O'Reilly, Jane", contact: "x" }]);
assert.match(exported, /"O'Reilly, Jane"/);
assert.throws(() => parseCsv("name\n" + "x\n".repeat(2001)), /at most/);
console.log("Documents, import/export foundation tests passed.");
