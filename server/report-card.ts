export type ReportMarkRow = {
  maxMarks: number;
  obtainedMarks: number | null;
  absent: boolean;
  subjectResult: string;
};

export function gradeForPercentage(percentage: number): string {
  if (percentage >= 90) return "A+";
  if (percentage >= 80) return "A";
  if (percentage >= 70) return "B+";
  if (percentage >= 60) return "B";
  if (percentage >= 50) return "C";
  if (percentage >= 40) return "D";
  return "F";
}

export function calculateReportTotals(rows: ReportMarkRow[]) {
  const countedRows = rows.filter((row) => !row.absent && row.obtainedMarks !== null);
  const totalObtained = countedRows.reduce((sum, row) => sum + (row.obtainedMarks ?? 0), 0);
  const totalMaximum = rows.reduce((sum, row) => sum + row.maxMarks, 0);
  const countedMaximum = countedRows.reduce((sum, row) => sum + row.maxMarks, 0);
  const percentage = countedMaximum === 0 ? 0 : Math.round((totalObtained / countedMaximum) * 10000) / 100;
  const hasAbsent = rows.some((row) => row.absent);
  const hasFailed = rows.some((row) => row.subjectResult === "Fail");
  const hasMissing = rows.some((row) => row.subjectResult === "Not entered");
  return {
    totalObtained,
    totalMaximum,
    percentage,
    passed: rows.filter((row) => row.subjectResult === "Pass").length,
    failed: rows.filter((row) => row.subjectResult === "Fail" || row.absent).length,
    absent: rows.filter((row) => row.absent).length,
    overallResult: hasMissing ? "Pending" : hasAbsent || hasFailed ? "Fail" : "Pass",
    grade: gradeForPercentage(percentage),
  };
}
