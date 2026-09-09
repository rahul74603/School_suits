const { app, BrowserWindow, ipcMain, shell } = require("electron");
const path = require("path");
const fs = require("fs");
const initSqlJs = require("sql.js");

let mainWindow;
let db;

// -----------------------------
// DB INIT
// -----------------------------
async function initDatabase() {
  const SQL = await initSqlJs();

  // 🟢 DB Version 54 (Added salary_payments and expenses tables)
  const dbPath = path.join(app.getPath("userData"), "school_final_v54.db");
  const isNewDb = !fs.existsSync(dbPath);

  if (!isNewDb) {
    db = new SQL.Database(fs.readFileSync(dbPath));
  } else {
    db = new SQL.Database();
  }

  // ----------------------------- TABLES -----------------------------
  db.run(`
    CREATE TABLE IF NOT EXISTS school_info (
      id INTEGER PRIMARY KEY,
      name TEXT,
      address TEXT,
      phone TEXT,
      email TEXT,
      session TEXT,
      adm_prefix TEXT DEFAULT 'SCHOOL',
      adm_year TEXT DEFAULT '2026',
      adm_start INTEGER DEFAULT 1
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS students (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      admission_no TEXT UNIQUE,
      name TEXT,
      father_name TEXT,
      mother_name TEXT,
      class TEXT,
      section TEXT,
      roll_no TEXT,
      aadhaar TEXT,
      birth_certificate_no TEXT,
      previous_school_name TEXT,
      previous_class TEXT,
      tc_number TEXT,
      tc_issue_date TEXT,
      tc_submitted INTEGER DEFAULT 0,
      report_card_submitted INTEGER DEFAULT 0,
      category TEXT,
      dob TEXT,
      contact TEXT,
      address TEXT,
      transport_id INTEGER,
      is_active INTEGER DEFAULT 1
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS fee_master (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      class_name TEXT UNIQUE,
      monthly_fee INTEGER DEFAULT 0,
      admission_fee INTEGER DEFAULT 0,
      exam_fee INTEGER DEFAULT 0,
      annual_fee INTEGER DEFAULT 0
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS transport_master (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      route_name TEXT,
      amount INTEGER
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS fee_payments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      student_id INTEGER,
      amount INTEGER,
      month TEXT,
      year INTEGER,
      receipt_no TEXT,
      payment_date DATETIME,
      remarks TEXT,
      breakdown TEXT
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS student_dues (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      student_id INTEGER,
      fee_name TEXT,
      amount INTEGER,
      due_date DATETIME,
      is_paid INTEGER DEFAULT 0
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS student_documents (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      student_id INTEGER,
      doc_type TEXT,
      file_name TEXT,
      file_path TEXT,
      uploaded_at DATETIME
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS additional_fee_master (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      class_name TEXT,
      fee_name TEXT,
      amount INTEGER,
      due_month TEXT
    )
  `);

  // 🟢 STAFF TABLE
  db.run(`
    CREATE TABLE IF NOT EXISTS staff (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      employee_id TEXT UNIQUE,
      name TEXT NOT NULL,
      father_name TEXT,
      designation TEXT,
      department TEXT,
      qualification TEXT,
      experience TEXT,
      contact TEXT,
      email TEXT,
      address TEXT,
      salary INTEGER DEFAULT 0,
      join_date TEXT,
      status TEXT DEFAULT 'Active',
      documents TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // 🟢 EXAMS TABLE
  db.run(`
    CREATE TABLE IF NOT EXISTS exams (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      exam_name TEXT NOT NULL,
      exam_type TEXT,
      class_name TEXT,
      section TEXT,
      subject TEXT,
      max_marks INTEGER DEFAULT 100,
      passing_marks INTEGER DEFAULT 33,
      exam_date TEXT,
      session TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // 🟢 MARKS TABLE
  db.run(`
    CREATE TABLE IF NOT EXISTS marks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      exam_id INTEGER,
      student_id INTEGER,
      marks_obtained REAL,
      remarks TEXT,
      subject_marks TEXT,
      total_marks REAL DEFAULT 0,
      percentage REAL DEFAULT 0,
      grade TEXT,
      result_status TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(exam_id, student_id)
    )
  `);

  // 🟢 SALARY PAYMENTS TABLE (NEW)
  db.run(`
    CREATE TABLE IF NOT EXISTS salary_payments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      staff_id INTEGER,
      month TEXT,
      year INTEGER,
      base_salary INTEGER,
      bonus INTEGER DEFAULT 0,
      deduction INTEGER DEFAULT 0,
      net_amount INTEGER,
      payment_date DATETIME,
      payment_mode TEXT,
      remarks TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // 🟢 EXPENSES TABLE (NEW)
  db.run(`
    CREATE TABLE IF NOT EXISTS expenses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      expense_name TEXT,
      category TEXT,
      amount INTEGER,
      expense_date TEXT,
      description TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // ----------------------------- MIGRATIONS -----------------------------
  try { db.run(`ALTER TABLE students ADD COLUMN aadhaar TEXT`); } catch (e) {}
  try { db.run(`ALTER TABLE students ADD COLUMN transport_id INTEGER`); } catch (e) {}
  try { db.run(`ALTER TABLE students ADD COLUMN birth_certificate_no TEXT`); } catch (e) {}
  try { db.run(`ALTER TABLE students ADD COLUMN previous_school_name TEXT`); } catch (e) {}
  try { db.run(`ALTER TABLE students ADD COLUMN previous_class TEXT`); } catch (e) {}
  try { db.run(`ALTER TABLE students ADD COLUMN tc_number TEXT`); } catch (e) {}
  try { db.run(`ALTER TABLE students ADD COLUMN tc_issue_date TEXT`); } catch (e) {}
  try { db.run(`ALTER TABLE students ADD COLUMN tc_submitted INTEGER DEFAULT 0`); } catch (e) {}
  try { db.run(`ALTER TABLE students ADD COLUMN report_card_submitted INTEGER DEFAULT 0`); } catch (e) {}
  try { db.run(`ALTER TABLE marks ADD COLUMN subject_marks TEXT`); } catch (e) {}
  try { db.run(`ALTER TABLE marks ADD COLUMN total_marks REAL DEFAULT 0`); } catch (e) {}
  try { db.run(`ALTER TABLE marks ADD COLUMN percentage REAL DEFAULT 0`); } catch (e) {}
  try { db.run(`ALTER TABLE marks ADD COLUMN grade TEXT`); } catch (e) {}
  try { db.run(`ALTER TABLE marks ADD COLUMN result_status TEXT`); } catch (e) {}

  // ----------------------------- SEED -----------------------------
  if (isNewDb) {
    db.run(
      `INSERT INTO school_info (name, address, session, adm_prefix, adm_year, adm_start)
       VALUES (?, ?, ?, ?, ?, ?)`,
      ["St. Xavier's Public School", "New Delhi", "2026-27", "KPS", "2026", 1]
    );

    [
      "Nursery", "LKG", "UKG",
      "1", "2", "3", "4", "5", "6",
      "7", "8", "9", "10", "11", "12",
    ].forEach((c) => {
      db.run(
        `INSERT INTO fee_master (class_name, monthly_fee, admission_fee)
         VALUES (?, 1200, 5000)`,
        [c]
      );
    });

    db.run(`INSERT INTO transport_master (route_name, amount) VALUES ('City Route', 600)`);
    saveDatabase();
  }

  return db;
}

// -----------------------------
// DB HELPERS
// -----------------------------
function saveDatabase() {
  const data = db.export();
  fs.writeFileSync(
    path.join(app.getPath("userData"), "school_final_v54.db"),
    Buffer.from(data)
  );
}

function queryAll(sql, params = []) {
  const stmt = db.prepare(sql);
  stmt.bind(params);
  const results = [];
  while (stmt.step()) results.push(stmt.getAsObject());
  stmt.free();
  return results;
}

function runQuery(sql, params = []) {
  try {
    db.run(sql, params);
    saveDatabase();
    try {
      const res = db.exec("SELECT last_insert_rowid()");
      if (res[0]) return { lastInsertRowid: res[0].values[0][0] };
    } catch (e) {}
    return { success: true };
  } catch (err) {
    console.error("DB ERROR:", err);
    throw err;
  }
}

// -----------------------------
// WINDOW
// -----------------------------
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, "preload.js"),
    },
    show: false,
  });

  mainWindow
    .loadURL(
      !app.isPackaged
        ? "http://localhost:3000"
        : `file://${path.join(__dirname, "../dist/public/index.html")}`
    )
    .then(() => mainWindow.show());
}

function toNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function calculateGrade(percentage) {
  if (percentage >= 90) return "A+";
  if (percentage >= 80) return "A";
  if (percentage >= 70) return "B";
  if (percentage >= 60) return "C";
  if (percentage >= 50) return "D";
  return "F";
}

function monthNameToNumber(monthName) {
  const months = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
  ];
  const index = months.findIndex(
    (month) => month.toLowerCase() === String(monthName || "").toLowerCase()
  );
  return index >= 0 ? String(index + 1).padStart(2, "0") : "";
}

// -----------------------------
// IPC HANDLERS
// -----------------------------
function setupIpcHandlers() {
  // ----------------------------- SCHOOL INFO -----------------------------
  ipcMain.handle("get-school-info", () =>
    queryAll("SELECT * FROM school_info LIMIT 1")[0]
  );

  ipcMain.handle("save-school-info", (e, info) => {
    runQuery(
      "UPDATE school_info SET name=?, address=?, phone=?, session=?, adm_prefix=?, adm_year=?, adm_start=? WHERE id=1",
      [
        info.name,
        info.address,
        info.phone,
        info.session,
        info.adm_prefix,
        info.adm_year,
        info.adm_start,
      ]
    );
  });

  // ----------------------------- MASTER TABLES -----------------------------
  ipcMain.handle("get-fee-master", () =>
    queryAll("SELECT * FROM fee_master ORDER BY id")
  );

  ipcMain.handle("get-transport", () =>
    queryAll("SELECT * FROM transport_master")
  );

  // ----------------------------- STUDENTS LIST -----------------------------
  ipcMain.handle("get-students", (e, { search, classStr, section }) => {
    let sql = `SELECT s.*, t.route_name, t.amount as bus_fee
               FROM students s
               LEFT JOIN transport_master t ON s.transport_id = t.id
               WHERE 1=1`;

    const params = [];

    if (classStr && classStr !== "ALL" && classStr !== "All") {
      sql += ` AND s.class = ?`;
      params.push(classStr);
    }

    if (section && section !== "ALL" && section !== "All") {
      sql += ` AND s.section = ?`;
      params.push(section);
    }

    if (search && search.trim() !== "") {
      const term = `%${search.trim()}%`;
      sql += ` AND (s.name LIKE ? OR s.admission_no LIKE ? OR s.contact LIKE ?)`;
      params.push(term, term, term);
    }

    sql += ` ORDER BY s.id DESC`;
    
    const stmt = db.prepare(sql);
    stmt.bind(params);
    const results = [];
    while (stmt.step()) results.push(stmt.getAsObject());
    stmt.free();
    return results;
  });

  // ----------------------------- SEARCH STUDENTS -----------------------------
  ipcMain.handle("search-students", (e, searchText) => {
    const q = (searchText || "").trim();
    if (!q) return [];
    const like = `%${q}%`;

    return queryAll(
      `SELECT id, admission_no, name, class, section, contact
       FROM students
       WHERE UPPER(admission_no) LIKE UPPER(?)
          OR UPPER(name) LIKE UPPER(?)
          OR UPPER(class) LIKE UPPER(?)
          OR UPPER(section) LIKE UPPER(?)
          OR contact LIKE ?
       ORDER BY id DESC
       LIMIT 20`,
      [like, like, like, like, like]
    );
  });

  // ----------------------------- STUDENT BY ADMISSION NO -----------------------------
  ipcMain.handle("get-student-by-admno", (e, admNo) => {
    const data = queryAll(
      `SELECT s.*, t.route_name, t.amount as bus_fee
       FROM students s
       LEFT JOIN transport_master t ON s.transport_id = t.id
       WHERE s.admission_no = ? LIMIT 1`,
      [admNo]
    );
    return data[0] || null;
  });

  // ----------------------------- STUDENT DOCUMENTS -----------------------------
  ipcMain.handle("get-student-documents", (e, studentId) => {
    return queryAll(
      `SELECT * FROM student_documents WHERE student_id = ? ORDER BY id DESC`,
      [studentId]
    );
  });

  ipcMain.handle("upload-student-document", async (e, payload) => {
    const { studentId, admissionNo, docType, fileName, base64Data } = payload;
    if (!studentId || !admissionNo || !docType || !fileName || !base64Data) {
      throw new Error("INVALID_PAYLOAD");
    }

    const docsDir = path.join(app.getPath("userData"), "student_docs", admissionNo);
    if (!fs.existsSync(docsDir)) fs.mkdirSync(docsDir, { recursive: true });

    const safeName = `${docType}_${Date.now()}_${fileName}`;
    const fullPath = path.join(docsDir, safeName);

    const buffer = Buffer.from(base64Data, "base64");
    fs.writeFileSync(fullPath, buffer);

    runQuery(
      `INSERT INTO student_documents (student_id, doc_type, file_name, file_path, uploaded_at)
       VALUES (?, ?, ?, ?, ?)`,
      [studentId, docType, safeName, fullPath, new Date().toISOString()]
    );

    return { success: true };
  });

  ipcMain.handle("open-student-document", async (e, filePath) => {
    try {
      if (!filePath) throw new Error("NO_FILE_PATH");
      const baseDir = app.getPath("userData");
      if (!filePath.startsWith(baseDir)) throw new Error("BLOCKED_PATH");
      if (!fs.existsSync(filePath)) throw new Error("FILE_NOT_FOUND");

      await shell.openPath(filePath);
      return { success: true };
    } catch (err) {
      console.error("open-student-document error:", err);
      return { success: false, error: err.message };
    }
  });

  // ----------------------------- DUES -----------------------------
  ipcMain.handle("add-student-due", (e, { studentId, feeName, amount }) => {
    runQuery(
      `INSERT INTO student_dues (student_id, fee_name, amount, due_date, is_paid)
       VALUES (?, ?, ?, ?, 0)`,
      [studentId, feeName, amount, new Date().toISOString()]
    );
  });

  ipcMain.handle("delete-student-due", (e, { id }) => {
    runQuery(`DELETE FROM student_dues WHERE id=?`, [id]);
  });

  // ----------------------------- STUDENT STATUS -----------------------------
  ipcMain.handle("get-student-status", (e, { studentId, classStr, year }) => {
    const rules =
      queryAll("SELECT * FROM fee_master WHERE class_name=?", [classStr])[0] || {
        monthly_fee: 0,
        admission_fee: 0,
      };

    const allPayments = queryAll("SELECT * FROM fee_payments WHERE student_id=?", [
      studentId,
    ]);

    let totalAdmPaid = 0;
    allPayments.forEach((p) => {
      if (p.remarks === "ADMISSION_FEE") totalAdmPaid += p.amount;
      else {
        try {
          const bd = JSON.parse(p.breakdown || "{}");
          if (bd.extras) {
            bd.extras.forEach((i) => {
              if (i.type === "Admission Fee") totalAdmPaid += i.amount;
            });
          }
        } catch (e) {}
      }
    });

    const admBalance = Math.max(0, rules.admission_fee - totalAdmPaid);

    const yearPayments = allPayments.filter((p) => p.year == year);
    const months = [
      "April", "May", "June", "July", "August", "September",
      "October", "November", "December", "January", "February", "March",
    ];

    const monthStatus = months.map((m) => {
      let isTuitionPaid = yearPayments.some(
        (p) =>
          p.month.includes(m) &&
          (p.breakdown.includes("Tuition") || p.month === m)
      );
      let isTransportPaid = yearPayments.some(
        (p) => p.month.includes(m) && p.breakdown.includes("Transport")
      );

      return {
        name: m,
        tuitionStatus: isTuitionPaid ? "paid" : "due",
        transportStatus: isTransportPaid ? "paid" : "due",
      };
    });

    const pendingDues = queryAll(
      "SELECT * FROM student_dues WHERE student_id=? AND is_paid=0",
      [studentId]
    );

    return {
      admissionTotal: rules.admission_fee,
      admissionPaid: totalAdmPaid,
      admissionBalance: admBalance,
      monthlyFee: rules.monthly_fee,
      monthStatus: monthStatus,
      pendingDues: pendingDues,
    };
  });

  // ----------------------------- RECEIPT NO -----------------------------
  ipcMain.handle("get-next-receipt-no", () =>
    "REC-" + Date.now().toString().slice(-6)
  );

  // ----------------------------- PAYMENTS -----------------------------
  ipcMain.handle("create-fee-payment", (e, p) => {
    const finalRemark = p.isAdmission ? "ADMISSION_FEE" : p.remarks;

    runQuery(
      `INSERT INTO fee_payments (student_id, amount, month, year, receipt_no, breakdown, payment_date, remarks)
       VALUES (?,?,?,?,?,?,?,?)`,
      [
        p.studentId,
        p.amount,
        p.month,
        p.year,
        p.receiptNo,
        JSON.stringify(p.breakdown),
        new Date().toISOString(),
        finalRemark,
      ]
    );

    if (p.breakdown && p.breakdown.extras) {
      p.breakdown.extras.forEach((item) => {
        if (item.dueId) {
          runQuery(`UPDATE student_dues SET is_paid=1 WHERE id=?`, [item.dueId]);
        }
      });
    }
  });

  ipcMain.handle("delete-fee-payment", (e, { id }) =>
    runQuery(`DELETE FROM fee_payments WHERE id=?`, [id])
  );

  ipcMain.handle("get-fee-payments", (e, { studentId }) =>
    queryAll("SELECT * FROM fee_payments WHERE student_id=? ORDER BY id DESC", [
      studentId,
    ])
  );

  ipcMain.handle("get-all-payments-for-stats", () =>
    queryAll(
      `SELECT fp.*, s.name as student_name, s.class as class_name, s.section
       FROM fee_payments fp
       LEFT JOIN students s ON fp.student_id = s.id
       ORDER BY fp.payment_date DESC, fp.id DESC`
    )
  );

  // ----------------------------- ADDITIONAL FEES -----------------------------
  ipcMain.handle("get-additional-fees", () =>
    queryAll("SELECT * FROM additional_fee_master ORDER BY class_name")
  );

  ipcMain.handle("add-additional-fee", (e, f) =>
    runQuery(
      "INSERT INTO additional_fee_master (class_name, fee_name, amount, due_month) VALUES (?,?,?,?)",
      [f.className, f.feeName, f.amount, f.dueMonth]
    )
  );

  ipcMain.handle("delete-additional-fee", (e, { id }) =>
    runQuery("DELETE FROM additional_fee_master WHERE id=?", [id])
  );

  // ----------------------------- TRANSPORT -----------------------------
  ipcMain.handle("add-transport", (e, t) =>
    runQuery("INSERT INTO transport_master (route_name, amount) VALUES (?,?)", [
      t.name,
      t.amount,
    ])
  );

  ipcMain.handle("delete-transport", (e, id) =>
    runQuery("DELETE FROM transport_master WHERE id=?", [id])
  );

  ipcMain.handle("update-student-transport", (e, { studentId, transportId }) =>
    runQuery(`UPDATE students SET transport_id = ? WHERE id = ?`, [
      transportId,
      studentId,
    ])
  );

  // ----------------------------- FEE MASTER -----------------------------
  ipcMain.handle("update-fee-master", (e, fee) =>
    runQuery(
      "UPDATE fee_master SET monthly_fee=?, admission_fee=? WHERE class_name=?",
      [fee.monthly, fee.admission, fee.className]
    )
  );

  // ----------------------------- DUPLICATE CHECK -----------------------------
  ipcMain.handle("check-admission-duplicate", (e, admNo) =>
    queryAll("SELECT id FROM students WHERE admission_no = ?", [admNo]).length > 0
  );

  // ----------------------------- AUTO ADMISSION NUMBER -----------------------------
  ipcMain.handle("get-next-admission-no", () => {
    const settings = queryAll(
      "SELECT adm_prefix, adm_year, adm_start FROM school_info LIMIT 1"
    )[0];

    const prefix = settings?.adm_prefix || "SCHOOL";
    const year = settings?.adm_year || new Date().getFullYear().toString();
    const startFrom = settings?.adm_start || 1;

    const pattern = `${prefix}-${year}-%`;
    const students = queryAll(
      "SELECT admission_no FROM students WHERE admission_no LIKE ?",
      [pattern]
    );

    let maxNum = 0;
    if (students.length > 0) {
      students.forEach((s) => {
        const parts = s.admission_no.split("-");
        const numPart = parseInt(parts[parts.length - 1]);
        if (!isNaN(numPart) && numPart > maxNum) maxNum = numPart;
      });
    }

    let nextSeq = maxNum === 0 ? startFrom : maxNum + 1;
    return `${prefix}-${year}-${String(nextSeq).padStart(3, "0")}`;
  });

  // ----------------------------- CREATE STUDENT -----------------------------
  ipcMain.handle("create-student", (e, s) => {
    try {
      const check = queryAll("SELECT id FROM students WHERE admission_no = ?", [
        s.admissionNumber,
      ]);

      if (check.length > 0) throw new Error("DUPLICATE_ADM_NO");

      const res = runQuery(
        `INSERT INTO students (
          name, admission_no, father_name, mother_name,
          class, section, roll_no,
          aadhaar,
          birth_certificate_no,
          previous_school_name, previous_class,
          tc_number, tc_issue_date,
          tc_submitted, report_card_submitted,
          category, dob, contact, address,
          transport_id
        ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        [
          s.studentName || "",
          s.admissionNumber || "",
          s.fatherName || "",
          s.motherName || "",
          s.class || "",
          s.section || "A",
          s.rollNo || "",
          s.aadhaarNo || "",
          s.birthCertificateNo || "",
          s.previousSchoolName || "",
          s.previousClass || "",
          s.tcNumber || "",
          s.tcIssueDate || "",
          s.tcSubmitted ? 1 : 0,
          s.reportCardSubmitted ? 1 : 0,
          s.category || "General",
          s.dob || "",
          s.contactNumber || "",
          s.address || "",
          s.transportEnabled
            ? s.transportId && !isNaN(parseInt(s.transportId))
              ? parseInt(s.transportId)
              : null
            : null,
        ]
      );

      return res;
    } catch (err) {
      console.error("create-student error:", err);
      throw err;
    }
  });

  // ==================== STAFF MANAGEMENT ====================

  ipcMain.handle("get-staff", (e, { search, status }) => {
    try {
      let sql = `SELECT * FROM staff WHERE 1=1`;
      const params = [];

      if (search && search.trim() !== "") {
        const term = `%${search.trim()}%`;
        sql += ` AND (name LIKE ? OR employee_id LIKE ? OR contact LIKE ? OR designation LIKE ?)`;
        params.push(term, term, term, term);
      }

      if (status && status !== "ALL") {
        sql += ` AND status = ?`;
        params.push(status);
      }

      sql += ` ORDER BY id DESC`;

      return queryAll(sql, params);
    } catch (err) {
      console.error("get-staff error:", err);
      throw err;
    }
  });

  ipcMain.handle("get-staff-by-id", (e, id) => {
    try {
      const data = queryAll("SELECT * FROM staff WHERE id = ? LIMIT 1", [id]);
      return data[0] || null;
    } catch (err) {
      console.error("get-staff-by-id error:", err);
      throw err;
    }
  });

  ipcMain.handle("create-staff", (e, staff) => {
    try {
      const year = new Date().getFullYear();
      const countResult = queryAll("SELECT COUNT(*) as total FROM staff");
      const count = countResult[0]?.total || 0;
      const employeeId = `EMP-${year}-${String(count + 1).padStart(3, "0")}`;

      const res = runQuery(
        `INSERT INTO staff (
          employee_id, name, father_name, designation, department,
          qualification, experience, contact, email, address,
          salary, join_date, status, documents
        ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        [
          employeeId,
          staff.name || "",
          staff.fatherName || "",
          staff.designation || "",
          staff.department || "",
          staff.qualification || "",
          staff.experience || "",
          staff.contact || "",
          staff.email || "",
          staff.address || "",
          parseInt(staff.salary) || 0,
          staff.joinDate || new Date().toISOString().split('T')[0],
          staff.status || "Active",
          JSON.stringify([])
        ]
      );

      return { ...res, employeeId };
    } catch (err) {
      console.error("create-staff error:", err);
      throw err;
    }
  });

  ipcMain.handle("update-staff", (e, staff) => {
    try {
      runQuery(
        `UPDATE staff SET 
          name=?, father_name=?, designation=?, department=?,
          qualification=?, experience=?, contact=?, email=?,
          address=?, salary=?, status=?, documents=?
        WHERE id=?`,
        [
          staff.name || "",
          staff.fatherName || "",
          staff.designation || "",
          staff.department || "",
          staff.qualification || "",
          staff.experience || "",
          staff.contact || "",
          staff.email || "",
          staff.address || "",
          parseInt(staff.salary) || 0,
          staff.status || "Active",
          JSON.stringify(staff.documents || []),
          staff.id
        ]
      );
      return { success: true };
    } catch (err) {
      console.error("update-staff error:", err);
      throw err;
    }
  });

  ipcMain.handle("delete-staff", (e, id) => {
    try {
      runQuery("DELETE FROM staff WHERE id=?", [id]);
      return { success: true };
    } catch (err) {
      console.error("delete-staff error:", err);
      throw err;
    }
  });

  ipcMain.handle("upload-staff-document", async (e, payload) => {
    try {
      const { staffId, employeeId, docType, fileName, base64Data } = payload;
      if (!staffId || !employeeId || !docType || !fileName || !base64Data) {
        throw new Error("INVALID_PAYLOAD");
      }

      const docsDir = path.join(app.getPath("userData"), "staff_docs", employeeId);
      if (!fs.existsSync(docsDir)) fs.mkdirSync(docsDir, { recursive: true });

      const safeName = `${docType}_${Date.now()}_${fileName}`;
      const fullPath = path.join(docsDir, safeName);

      const buffer = Buffer.from(base64Data, "base64");
      fs.writeFileSync(fullPath, buffer);

      const staff = queryAll("SELECT documents FROM staff WHERE id = ?", [staffId])[0];
      const docs = staff?.documents ? JSON.parse(staff.documents) : [];
      docs.push({
        type: docType,
        fileName: safeName,
        filePath: fullPath,
        uploadedAt: new Date().toISOString()
      });

      runQuery("UPDATE staff SET documents = ? WHERE id = ?", [JSON.stringify(docs), staffId]);

      return { success: true, filePath: fullPath };
    } catch (err) {
      console.error("upload-staff-document error:", err);
      throw err;
    }
  });

  // ==================== SALARY MANAGEMENT (NEW) ====================

  // Get salary payment history for a staff
  ipcMain.handle("get-staff-salary-history", (e, staffId) => {
    try {
      return queryAll(
        `SELECT sp.*, s.name as staff_name, s.employee_id 
         FROM salary_payments sp
         JOIN staff s ON sp.staff_id = s.id
         WHERE sp.staff_id = ?
         ORDER BY sp.year DESC, sp.month DESC`,
        [staffId]
      );
    } catch (err) {
      console.error("get-staff-salary-history error:", err);
      throw err;
    }
  });

  // Get all salary payments for a month
  ipcMain.handle("get-monthly-salary-payments", (e, { month, year }) => {
    try {
      return queryAll(
        `SELECT sp.*, s.name as staff_name, s.employee_id, s.designation
         FROM salary_payments sp
         JOIN staff s ON sp.staff_id = s.id
         WHERE sp.month = ? AND sp.year = ?
         ORDER BY s.name`,
        [month, year]
      );
    } catch (err) {
      console.error("get-monthly-salary-payments error:", err);
      throw err;
    }
  });

  // Pay salary
  ipcMain.handle("pay-salary", (e, payment) => {
    try {
      // Check if already paid for this month
      const existing = queryAll(
        "SELECT id FROM salary_payments WHERE staff_id = ? AND month = ? AND year = ?",
        [payment.staffId, payment.month, payment.year]
      );

      if (existing.length > 0) {
        throw new Error("SALARY_ALREADY_PAID");
      }

      const res = runQuery(
        `INSERT INTO salary_payments (staff_id, month, year, base_salary, bonus, deduction, net_amount, payment_date, payment_mode, remarks)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          payment.staffId,
          payment.month,
          payment.year,
          payment.baseSalary,
          payment.bonus || 0,
          payment.deduction || 0,
          payment.netAmount,
          new Date().toISOString(),
          payment.paymentMode || "Cash",
          payment.remarks || ""
        ]
      );

      return { success: true, id: res.lastInsertRowid };
    } catch (err) {
      console.error("pay-salary error:", err);
      throw err;
    }
  });

  // Delete salary payment
  ipcMain.handle("delete-salary-payment", (e, id) => {
    try {
      runQuery("DELETE FROM salary_payments WHERE id = ?", [id]);
      return { success: true };
    } catch (err) {
      console.error("delete-salary-payment error:", err);
      throw err;
    }
  });

  // Get pending salaries (staff jinka salary nahi mila)
  ipcMain.handle("get-pending-salaries", (e, { month, year }) => {
    try {
      // Get all active staff
      const allStaff = queryAll("SELECT * FROM staff WHERE status = 'Active'");
      
      // Get paid staff for this month
      const paidStaff = queryAll(
        "SELECT staff_id FROM salary_payments WHERE month = ? AND year = ?",
        [month, year]
      );
      
      const paidIds = paidStaff.map(p => p.staff_id);
      
      // Filter pending staff
      return allStaff.filter(s => !paidIds.includes(s.id));
    } catch (err) {
      console.error("get-pending-salaries error:", err);
      throw err;
    }
  });

  // ==================== EXPENSES MANAGEMENT (NEW) ====================

  ipcMain.handle("get-expenses", (e, { category, month, year }) => {
    try {
      let sql = `SELECT * FROM expenses WHERE 1=1`;
      const params = [];

      if (category && category !== "ALL") {
        sql += ` AND category = ?`;
        params.push(category);
      }

      if (month && year) {
        sql += ` AND strftime('%m', expense_date) = ? AND strftime('%Y', expense_date) = ?`;
        params.push(month, year);
      }

      sql += ` ORDER BY expense_date DESC`;
      return queryAll(sql, params);
    } catch (err) {
      console.error("get-expenses error:", err);
      throw err;
    }
  });

  ipcMain.handle("add-expense", (e, expense) => {
    try {
      const res = runQuery(
        `INSERT INTO expenses (expense_name, category, amount, expense_date, description)
         VALUES (?, ?, ?, ?, ?)`,
        [
          expense.expenseName,
          expense.category,
          expense.amount,
          expense.expenseDate,
          expense.description || ""
        ]
      );
      return { success: true, id: res.lastInsertRowid };
    } catch (err) {
      console.error("add-expense error:", err);
      throw err;
    }
  });

  ipcMain.handle("delete-expense", (e, id) => {
    try {
      runQuery("DELETE FROM expenses WHERE id = ?", [id]);
      return { success: true };
    } catch (err) {
      console.error("delete-expense error:", err);
      throw err;
    }
  });

  // ==================== FINANCIAL DASHBOARD (NEW) ====================

  ipcMain.handle("get-financial-summary", (e, { month, year }) => {
    try {
      const monthNo = monthNameToNumber(month);
      const safeYear = String(year);

      // Total Fee Collection for month
      const feeCollection = queryAll(
        `SELECT COALESCE(SUM(amount), 0) as total FROM fee_payments 
         WHERE month LIKE ? AND year = ?`,
        [`%${month}%`, year]
      )[0].total;

      // Total Salary Paid for month
      const salaryPaid = queryAll(
        `SELECT COALESCE(SUM(net_amount), 0) as total FROM salary_payments 
         WHERE month = ? AND year = ?`,
        [month, year]
      )[0].total;

      // Other Expenses for month
      const otherExpenses = queryAll(
        `SELECT COALESCE(SUM(amount), 0) as total FROM expenses 
         WHERE strftime('%m', expense_date) = ? AND strftime('%Y', expense_date) = ?`,
        [monthNo, safeYear]
      )[0].total;

      // Total Expense
      const totalExpense = toNumber(salaryPaid) + toNumber(otherExpenses);
      
      // Net Profit/Loss
      const netProfit = toNumber(feeCollection) - totalExpense;

      return {
        income: toNumber(feeCollection),
        salaryExpense: toNumber(salaryPaid),
        otherExpense: toNumber(otherExpenses),
        totalExpense: totalExpense,
        netProfit: netProfit,
        profitMargin: toNumber(feeCollection) > 0
          ? ((netProfit / toNumber(feeCollection)) * 100).toFixed(2)
          : 0
      };
    } catch (err) {
      console.error("get-financial-summary error:", err);
      throw err;
    }
  });

  // Get last 6 months financial data for charts
  ipcMain.handle("get-financial-trend", () => {
    try {
      const months = [
        "January", "February", "March", "April", "May", "June",
        "July", "August", "September", "October", "November", "December"
      ];
      
      const currentMonth = new Date().getMonth();
      const currentYear = new Date().getFullYear();
      
      const result = [];
      
      for (let i = 5; i >= 0; i--) {
        const monthIndex = (currentMonth - i + 12) % 12;
        const year = currentMonth - i < 0 ? currentYear - 1 : currentYear;
        const monthName = months[monthIndex];
        
        // Get income
        const income = queryAll(
          `SELECT COALESCE(SUM(amount), 0) as total FROM fee_payments 
           WHERE month LIKE ? AND year = ?`,
          [`%${monthName}%`, year]
        )[0].total;
        
        // Get expense
        const expense = queryAll(
          `SELECT COALESCE(SUM(net_amount), 0) as total FROM salary_payments 
           WHERE month = ? AND year = ?`,
          [monthName, year]
        )[0].total;

        const monthNo = String(monthIndex + 1).padStart(2, "0");
        const otherExpense = queryAll(
          `SELECT COALESCE(SUM(amount), 0) as total FROM expenses
           WHERE strftime('%m', expense_date) = ? AND strftime('%Y', expense_date) = ?`,
          [monthNo, String(year)]
        )[0].total;
        const totalExpense = toNumber(expense) + toNumber(otherExpense);
        
        result.push({
          month: monthName.substring(0, 3),
          year: year,
          income: toNumber(income),
          expense: totalExpense,
          profit: toNumber(income) - totalExpense
        });
      }
      
      return result;
    } catch (err) {
      console.error("get-financial-trend error:", err);
      throw err;
    }
  });

  // ==================== EXAMINATION MANAGEMENT ====================

  ipcMain.handle("get-exams", (e, { className, section, session }) => {
    try {
      let sql = `SELECT * FROM exams WHERE 1=1`;
      const params = [];

      if (className && className !== "ALL") {
        sql += ` AND class_name = ?`;
        params.push(className);
      }

      if (section && section !== "ALL") {
        sql += ` AND section = ?`;
        params.push(section);
      }

      if (session) {
        sql += ` AND session = ?`;
        params.push(session);
      }

      sql += ` ORDER BY exam_date DESC, id DESC`;

      return queryAll(sql, params);
    } catch (err) {
      console.error("get-exams error:", err);
      throw err;
    }
  });

  ipcMain.handle("create-exam", (e, examData) => {
    try {
      const res = runQuery(
        `INSERT INTO exams (exam_name, exam_type, class_name, section, subject, max_marks, passing_marks, exam_date, session)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          examData.examName,
          examData.examType,
          examData.className,
          examData.section,
          examData.subject || "",
          parseInt(examData.maxMarks) || 100,
          parseInt(examData.passingMarks) || 33,
          examData.examDate,
          examData.session || "2026-27"
        ]
      );
      return { success: true, id: res.lastInsertRowid };
    } catch (err) {
      console.error("create-exam error:", err);
      throw err;
    }
  });

  ipcMain.handle("delete-exam", (e, id) => {
    try {
      runQuery("DELETE FROM marks WHERE exam_id = ?", [id]);
      runQuery("DELETE FROM exams WHERE id = ?", [id]);
      return { success: true };
    } catch (err) {
      console.error("delete-exam error:", err);
      throw err;
    }
  });

  ipcMain.handle("get-marks", (e, { examId }) => {
    try {
      return queryAll(
        `SELECT m.*, s.name as student_name, s.roll_no
         FROM marks m
         JOIN students s ON m.student_id = s.id
         WHERE m.exam_id = ?`,
        [examId]
      );
    } catch (err) {
      console.error("get-marks error:", err);
      throw err;
    }
  });

  ipcMain.handle("get-exam-marks", (e, examId) => {
    try {
      return queryAll(
        `SELECT m.*, s.name as student_name, s.roll_no
         FROM marks m
         JOIN students s ON m.student_id = s.id
         WHERE m.exam_id = ?`,
        [examId]
      );
    } catch (err) {
      console.error("get-exam-marks error:", err);
      throw err;
    }
  });

  ipcMain.handle("save-marks", (e, { examId, marks }) => {
    try {
      const examMeta = queryAll(
        "SELECT max_marks, passing_marks, subject FROM exams WHERE id = ? LIMIT 1",
        [examId]
      )[0] || {};
      const maxMarks = toNumber(examMeta.max_marks, 100);
      const passingMarks = toNumber(examMeta.passing_marks, 33);
      const subjectLabel = String(examMeta.subject || "").trim() || "Marks";

      marks.forEach((mark) => {
        const obtained = toNumber(mark.marksObtained);
        const percentage = maxMarks > 0 ? (obtained * 100) / maxMarks : 0;
        const grade = calculateGrade(percentage);
        const resultStatus = obtained >= passingMarks ? "Pass" : "Fail";
        const subjectMarks = JSON.stringify({ [subjectLabel]: obtained });

        const existing = queryAll(
          "SELECT id FROM marks WHERE exam_id = ? AND student_id = ?",
          [examId, mark.studentId]
        );

        if (existing.length > 0) {
          runQuery(
            `UPDATE marks SET marks_obtained = ?, remarks = ?, subject_marks = ?, total_marks = ?, percentage = ?, grade = ?, result_status = ?, updated_at = ?
             WHERE exam_id = ? AND student_id = ?`,
            [
              obtained,
              mark.remarks || "",
              subjectMarks,
              obtained,
              percentage,
              grade,
              resultStatus,
              new Date().toISOString(),
              examId,
              mark.studentId
            ]
          );
        } else {
          runQuery(
            `INSERT INTO marks (
              exam_id, student_id, marks_obtained, remarks,
              subject_marks, total_marks, percentage, grade, result_status
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              examId,
              mark.studentId,
              obtained,
              mark.remarks || "",
              subjectMarks,
              obtained,
              percentage,
              grade,
              resultStatus,
            ]
          );
        }
      });
      return { success: true };
    } catch (err) {
      console.error("save-marks error:", err);
      throw err;
    }
  });

  ipcMain.handle("save-exam-marks", (e, { examId, studentId, marksData }) => {
    try {
      const marksObj = marksData?.marks || {};
      const maxMarksObj = marksData?.maxMarks || {};
      const passingObj = marksData?.passingMarks || {};
      const subjectEntries = Object.entries(marksObj).map(([subject, value]) => [
        subject,
        toNumber(value),
      ]);

      const normalizedSubjectMarks = {};
      let totalMarks = 0;
      let totalMax = 0;
      let failedSubjects = 0;

      subjectEntries.forEach(([subject, obtained]) => {
        normalizedSubjectMarks[subject] = obtained;
        totalMarks += obtained;
        const max = toNumber(maxMarksObj[subject], 100);
        const passing = toNumber(passingObj[subject], 33);
        totalMax += max;
        if (obtained < passing) failedSubjects += 1;
      });

      const percentage = totalMax > 0 ? (totalMarks * 100) / totalMax : 0;
      const grade = calculateGrade(percentage);
      const resultStatus = failedSubjects === 0 ? "Pass" : "Fail";
      const remarks = String(marksData?.remarks || "");

      const existing = queryAll(
        "SELECT id FROM marks WHERE exam_id = ? AND student_id = ?",
        [examId, studentId]
      );

      if (existing.length > 0) {
        runQuery(
          `UPDATE marks
           SET marks_obtained = ?, remarks = ?, subject_marks = ?, total_marks = ?, percentage = ?, grade = ?, result_status = ?, updated_at = ?
           WHERE exam_id = ? AND student_id = ?`,
          [
            totalMarks,
            remarks,
            JSON.stringify(normalizedSubjectMarks),
            totalMarks,
            percentage,
            grade,
            resultStatus,
            new Date().toISOString(),
            examId,
            studentId,
          ]
        );
      } else {
        runQuery(
          `INSERT INTO marks (
            exam_id, student_id, marks_obtained, remarks,
            subject_marks, total_marks, percentage, grade, result_status
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            examId,
            studentId,
            totalMarks,
            remarks,
            JSON.stringify(normalizedSubjectMarks),
            totalMarks,
            percentage,
            grade,
            resultStatus,
          ]
        );
      }

      return {
        success: true,
        resultStatus,
        grade,
        percentage: percentage.toFixed(2),
      };
    } catch (err) {
      console.error("save-exam-marks error:", err);
      throw err;
    }
  });

  ipcMain.handle("get-student-all-results", (e, studentId) => {
    try {
      const rows = queryAll(
        `SELECT
            e.exam_name,
            e.exam_type,
            e.class_name,
            e.session,
            e.subject,
            e.max_marks,
            e.passing_marks,
            m.subject_marks,
            m.total_marks,
            m.marks_obtained,
            m.percentage,
            m.grade,
            m.result_status
         FROM marks m
         JOIN exams e ON m.exam_id = e.id
         WHERE m.student_id = ?
         ORDER BY e.exam_date DESC, e.id DESC`,
        [studentId]
      );

      return rows.map((row) => {
        const maxMarks = toNumber(row.max_marks, 100);
        const totalMarks = toNumber(row.total_marks, toNumber(row.marks_obtained));
        const percentage = row.percentage !== null && row.percentage !== undefined
          ? toNumber(row.percentage)
          : (maxMarks > 0 ? (totalMarks * 100) / maxMarks : 0);
        const resultStatus = row.result_status || (totalMarks >= toNumber(row.passing_marks, 33) ? "Pass" : "Fail");
        const grade = row.grade || calculateGrade(percentage);
        const subjectName = String(row.subject || "").trim() || "Marks";
        const subjectMarks = row.subject_marks && String(row.subject_marks).trim() !== ""
          ? row.subject_marks
          : JSON.stringify({ [subjectName]: totalMarks });

        return {
          exam_name: row.exam_name,
          exam_type: row.exam_type,
          class_name: row.class_name,
          session: row.session,
          subject_marks: subjectMarks,
          total_marks: totalMarks,
          percentage: Number(percentage.toFixed(2)),
          grade,
          result_status: resultStatus,
        };
      });
    } catch (err) {
      console.error("get-student-all-results error:", err);
      throw err;
    }
  });
}

// -----------------------------
// START APP
// -----------------------------
app.whenReady().then(async () => {
  await initDatabase();
  setupIpcHandlers();
  createWindow();
});
