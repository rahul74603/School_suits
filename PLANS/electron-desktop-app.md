# 🎓 School Guardian Suite - Desktop Application Architecture

## Hindi Explanation

**Best Tech Stack for Pure Windows PC App:** **Electron + React + SQLite**

Ye ek perfect combination hai:
- **Electron** - Windows .exe file banata hai (pure desktop app)
- **React** - Aapka existing web app code reuse kar sakte hain
- **SQLite** - Offline local database (no internet needed)

---

## 1. Recommended Tech Stack

### Desktop Framework: **Electron** 🎯

```
┌─────────────────────────────────────────────────────────────┐
│                  ELECTRON DESKTOP APP                        │
│  ┌─────────────────────────────────────────────────────┐    │
│  │              Windows .exe Application               │    │
│  │                                                     │    │
│  │  ┌─────────────────────────────────────────────┐    │    │
│  │  │         Main Process (Node.js)              │    │    │
│  │  │  - Window management                        │    │    │
│  │  │  - Native APIs                              │    │    │
│  │  │  - SQLite database                          │    │    │
│  │  └─────────────────────────────────────────────┘    │    │
│  │                        │                              │    │
│  │                        ▼                              │    │
│  │  ┌─────────────────────────────────────────────┐    │    │
│  │  │       Renderer Process (React)              │    │    │
│  │  │  - UI Components                            │    │    │
│  │  │  - State Management                         │    │    │
│  │  │  - Screens                                  │    │    │
│  │  └─────────────────────────────────────────────┘    │    │
│  │                                                     │    │
│  └─────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
```

### Database: **SQLite** (better than PostgreSQL for desktop)

```
┌─────────────────────────────────────┐
│          SQLite Database            │
│   ┌───────────────────────────┐     │
│   │  school_guardian.db       │     │
│   │  - Single file            │     │
│   │  - No server needed       │     │
│   │  - Works offline          │     │
│   │  - Portable (copy-paste)  │     │
│   └───────────────────────────┘     │
└─────────────────────────────────────┘
```

### UI Framework: **React** (reuse your existing code!)

Aapke paas `client/` folder mein React code hai - use Electron mein use karenge.

---

## 2. Complete Project Structure

```
school-guardian-desktop/
├── main/                          # Electron main process
│   ├── main.js                   # App entry point
│   ├── preload.js               # Bridge between Node & UI
│   ├── ipcMain.js               # Inter-process communication
│   ├── database.js              # SQLite setup
│   └── windowManager.js         # Window management
├── preload/
│   └── rendererBridge.js        # Secure API exposure
├── client/                       # YOUR EXISTING REACT APP
│   ├── src/
│   │   ├── App.tsx
│   │   ├── pages/
│   │   │   ├── Dashboard.tsx
│   │   │   ├── Students.tsx
│   │   │   ├── Fees.tsx
│   │   │   ├── Staff.tsx
│   │   │   └── Admissions.tsx
│   │   ├── components/
│   │   ├── hooks/
│   │   └── lib/
│   ├── package.json
│   └── vite.config.ts
├── db/                           # Database
│   └── schema.sql               # Database schema
├── assets/                       # Icons, images
│   ├── icon.ico                 # App icon
│   └── installer-icon.ico
├── build/                        # Build scripts
│   ├── build.js
│   └── icons/
├── public/                       # Static files
├── dist/                         # Built files (auto-generated)
├── electron-builder.json5       # Electron builder config
├── package.json                 # Main package.json
├── vite.config.js               # Vite config for Electron
└── README.md
```

---

## 3. Database Schema (SQLite)

```sql
-- database/schema.sql

-- Schools table (for multi-school white-labeling)
CREATE TABLE IF NOT EXISTS schools (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    logo TEXT,
    address TEXT NOT NULL,
    phone TEXT NOT NULL,
    email TEXT,
    primary_color TEXT DEFAULT '#1976D2',
    secondary_color TEXT DEFAULT '#FF9800',
    is_active BOOLEAN DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Users table (Admin/Staff login)
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    school_id INTEGER REFERENCES schools(id),
    username TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'staff', -- 'admin', 'staff'
    name TEXT NOT NULL,
    is_active BOOLEAN DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Students table
CREATE TABLE IF NOT EXISTS students (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    school_id INTEGER REFERENCES schools(id),
    admission_no TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    father_name TEXT NOT NULL,
    mother_name TEXT,
    class TEXT NOT NULL, -- LKG, UKG, 1-12
    section TEXT NOT NULL,
    roll_no TEXT,
    aadhaar TEXT,
    category TEXT, -- General, OBC, SC/ST
    dob DATE,
    contact TEXT NOT NULL,
    address TEXT,
    photo TEXT,
    is_active BOOLEAN DEFAULT 1,
    is_promoted BOOLEAN DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Fee structures table
CREATE TABLE IF NOT EXISTS fee_structures (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    school_id INTEGER REFERENCES schools(id),
    class TEXT NOT NULL,
    monthly_fee INTEGER NOT NULL,
    admission_fee INTEGER DEFAULT 0,
    exam_fee INTEGER DEFAULT 0,
    other_fee INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(school_id, class)
);

-- Fee payments table
CREATE TABLE IF NOT EXISTS fee_payments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    student_id INTEGER REFERENCES students(id),
    school_id INTEGER REFERENCES schools(id),
    amount INTEGER NOT NULL,
    month TEXT NOT NULL,
    year INTEGER NOT NULL,
    payment_date DATETIME DEFAULT CURRENT_TIMESTAMP,
    receipt_no TEXT UNIQUE NOT NULL,
    payment_method TEXT,
    remarks TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Staff table
CREATE TABLE IF NOT EXISTS staff (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    school_id INTEGER REFERENCES schools(id),
    name TEXT NOT NULL,
    designation TEXT NOT NULL, -- Teacher, Clerk, Peon
    qualification TEXT,
    contact TEXT NOT NULL,
    email TEXT,
    basic_salary INTEGER NOT NULL,
    advance_given INTEGER DEFAULT 0,
    join_date DATE,
    is_active BOOLEAN DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Sessions table (for academic year management)
CREATE TABLE IF NOT EXISTS sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    school_id INTEGER REFERENCES schools(id),
    name TEXT NOT NULL, -- e.g., "2024-2025"
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    is_active BOOLEAN DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for better performance
CREATE INDEX idx_students_school ON students(school_id);
CREATE INDEX idx_students_class ON students(school_id, class);
CREATE INDEX idx_payments_student ON fee_payments(student_id);
CREATE INDEX idx_payments_month ON fee_payments(school_id, month, year);
CREATE INDEX idx_staff_school ON staff(school_id);
```

---

## 4. Electron Main Process Architecture

```javascript
// main/main.js
const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const Database = require('better-sqlite3');
const { initDatabase } = require('./database');
const { setupIpcHandlers } = require('./ipcMain');

let mainWindow;
let db;

// Initialize database
function initAppDatabase() {
    const dbPath = path.join(app.getPath('userData'), 'school_guardian.db');
    db = new Database(dbPath);
    initDatabase(db);
    return db;
}

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1400,
        height: 900,
        minWidth: 1200,
        minHeight: 700,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload: path.join(__dirname, 'preload.js')
        },
        frame: true,
        titleBarStyle: 'default',
        show: false
    });

    // Load React app
    const startUrl = process.env.ELECTRON_START_URL || 
        `file://${path.join(__dirname, '../dist/index.html')}`;
    mainWindow.loadURL(startUrl);

    mainWindow.once('ready-to-show', () => {
        mainWindow.show();
        mainWindow.focus();
    });

    mainWindow.on('closed', () => {
        mainWindow = null;
    });
}

app.whenReady().then(() => {
    initAppDatabase();
    setupIpcHandlers(db, ipcMain);
    createWindow();
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});
```

---

## 5. IPC Communication (Main ↔ Renderer)

```javascript
// main/ipcMain.js
const { ipcMain } = require('electron');

function setupIpcHandlers(db, ipcMain) {
    
    // Schools
    ipcMain.handle('get-schools', async () => {
        return db.prepare('SELECT * FROM schools WHERE is_active = 1').all();
    });

    ipcMain.handle('create-school', async (event, school) => {
        const stmt = db.prepare(`
            INSERT INTO schools (name, logo, address, phone, email, primary_color, secondary_color)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `);
        const result = stmt.run(
            school.name, school.logo, school.address, 
            school.phone, school.email, school.primaryColor, school.secondaryColor
        );
        return { id: result.lastInsertRowid, ...school };
    });

    // Students
    ipcMain.handle('get-students', async (event, filters) => {
        let query = 'SELECT * FROM students WHERE school_id = ? AND is_active = 1';
        const params = [filters.schoolId];
        
        if (filters.class && filters.class !== 'all') {
            query += ' AND class = ?';
            params.push(filters.class);
        }
        if (filters.section && filters.section !== 'all') {
            query += ' AND section = ?';
            params.push(filters.section);
        }
        if (filters.search) {
            query += ' AND name LIKE ?';
            params.push(`%${filters.search}%`);
        }
        
        return db.prepare(query).all(...params);
    });

    ipcMain.handle('create-student', async (event, student) => {
        const stmt = db.prepare(`
            INSERT INTO students (school_id, admission_no, name, father_name, mother_name,
                class, section, roll_no, aadhaar, category, dob, contact, address, photo)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);
        const result = stmt.run(
            student.schoolId, student.admissionNo, student.name, student.fatherName,
            student.motherName, student.className, student.section, student.rollNo,
            student.aadhaar, student.category, student.dob, student.contact,
            student.address, student.photo
        );
        return { id: result.lastInsertRowid, ...student };
    });

    ipcMain.handle('promote-students', async (event, { studentIds, targetClass }) => {
        const placeholders = studentIds.map(() => '?').join(',');
        const stmt = db.prepare(`
            UPDATE students SET class = ? WHERE id IN (${placeholders})
        `);
        stmt.run(targetClass, ...studentIds);
        return { success: true };
    });

    // Fee Structures
    ipcMain.handle('get-fee-structures', async (event, schoolId) => {
        return db.prepare('SELECT * FROM fee_structures WHERE school_id = ?')
            .all(schoolId);
    });

    ipcMain.handle('create-fee-structure', async (event, structure) => {
        const stmt = db.prepare(`
            INSERT OR REPLACE INTO fee_structures (school_id, class, monthly_fee, admission_fee, exam_fee, other_fee)
            VALUES (?, ?, ?, ?, ?, ?)
        `);
        const result = stmt.run(
            structure.schoolId, structure.class, structure.monthlyFee,
            structure.admissionFee, structure.examFee, structure.otherFee
        );
        return { id: result.lastInsertRowid, ...structure };
    });

    // Fee Payments
    ipcMain.handle('get-fee-payments', async (event, { schoolId, studentId }) => {
        if (studentId) {
            return db.prepare('SELECT * FROM fee_payments WHERE student_id = ?')
                .all(studentId);
        }
        return db.prepare('SELECT * FROM fee_payments WHERE school_id = ?')
            .all(schoolId);
    });

    ipcMain.handle('create-fee-payment', async (event, payment) => {
        const stmt = db.prepare(`
            INSERT INTO fee_payments (student_id, school_id, amount, month, year, receipt_no, payment_method, remarks)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `);
        const result = stmt.run(
            payment.studentId, payment.schoolId, payment.amount,
            payment.month, payment.year, payment.receiptNo,
            payment.paymentMethod, payment.remarks
        );
        return { id: result.lastInsertRowid, ...payment };
    });

    ipcMain.handle('get-defaulters', async (event, { schoolId, classStr, month }) => {
        const currentMonth = month || new Date().toLocaleString('default', { month: 'long' });
        const currentYear = new Date().getFullYear();
        
        const students = db.prepare(`
            SELECT * FROM students 
            WHERE school_id = ? AND is_active = 1 AND class = ?
        `).all(schoolId, classStr);
        
        const defaulters = [];
        for (const student of students) {
            const payment = db.prepare(`
                SELECT * FROM fee_payments 
                WHERE student_id = ? AND month = ? AND year = ?
            `).get(student.id, currentMonth, currentYear);
            
            if (!payment) {
                const feeStructure = db.prepare(`
                    SELECT * FROM fee_structures WHERE school_id = ? AND class = ?
                `).get(schoolId, student.class);
                
                defaulters.push({
                    studentId: student.id,
                    name: student.name,
                    amountPending: feeStructure ? feeStructure.monthly_fee : 500
                });
            }
        }
        return defaulters;
    });

    // Staff
    ipcMain.handle('get-staff', async (event, schoolId) => {
        return db.prepare('SELECT * FROM staff WHERE school_id = ? AND is_active = 1')
            .all(schoolId);
    });

    ipcMain.handle('create-staff', async (event, staff) => {
        const stmt = db.prepare(`
            INSERT INTO staff (school_id, name, designation, qualification, contact, email, basic_salary, advance_given, join_date)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);
        const result = stmt.run(
            staff.schoolId, staff.name, staff.designation,
            staff.qualification, staff.contact, staff.email,
            staff.basicSalary, staff.advanceGiven || 0, staff.joinDate
        );
        return { id: result.lastInsertRowid, ...staff };
    });

    // Backup/Restore
    ipcMain.handle('backup-database', async (event) => {
        const backupPath = path.join(app.getPath('downloads'), 
            `school_guardian_backup_${Date.now()}.db`);
        db.backup(backupPath).then(() => {
            return backupPath;
        });
    });
}

module.exports = { setupIpcHandlers };
```

---

## 6. Preload Bridge (Secure)

```javascript
// preload/rendererBridge.js
const { contextBridge, ipcRenderer } = require('electron');

// Expose only safe APIs to renderer process
contextBridge.exposeInMainWorld('electronAPI', {
    // Schools
    getSchools: () => ipcRenderer.invoke('get-schools'),
    createSchool: (school) => ipcRenderer.invoke('create-school', school),
    
    // Students
    getStudents: (filters) => ipcRenderer.invoke('get-students', filters),
    createStudent: (student) => ipcRenderer.invoke('create-student', student),
    updateStudent: (id, student) => ipcRenderer.invoke('update-student', id, student),
    promoteStudents: (data) => ipcRenderer.invoke('promote-students', data),
    deleteStudent: (id) => ipcRenderer.invoke('delete-student', id),
    
    // Fees
    getFeeStructures: (schoolId) => ipcRenderer.invoke('get-fee-structures', schoolId),
    createFeeStructure: (structure) => ipcRenderer.invoke('create-fee-structure', structure),
    getFeePayments: (data) => ipcRenderer.invoke('get-fee-payments', data),
    createFeePayment: (payment) => ipcRenderer.invoke('create-fee-payment', payment),
    getDefaulters: (data) => ipcRenderer.invoke('get-defaulters', data),
    
    // Staff
    getStaff: (schoolId) => ipcRenderer.invoke('get-staff', schoolId),
    createStaff: (staff) => ipcRenderer.invoke('create-staff', staff),
    updateStaff: (id, staff) => ipcRenderer.invoke('update-staff', id, staff),
    
    // Backup
    backupDatabase: () => ipcRenderer.invoke('backup-database'),
    
    // Window controls
    minimizeWindow: () => ipcRenderer.send('minimize-window'),
    maximizeWindow: () => ipcRenderer.send('maximize-window'),
    closeWindow: () => ipcRenderer.send('close-window')
});
```

---

## 7. Package.json Configuration

```json
{
  "name": "school-guardian-suite",
  "version": "1.0.0",
  "description": "Offline School Management Desktop Application",
  "main": "main/main.js",
  "scripts": {
    "dev": "concurrently \"npm run dev:client\" \"npm run dev:electron\"",
    "dev:client": "cd client && npm run dev",
    "dev:electron": "wait-on http://localhost:5173 && electron .",
    "build": "npm run build:client && electron-builder",
    "build:client": "cd client && npm run build",
    "build:win": "electron-builder --win",
    "build:mac": "electron-builder --mac",
    "build:linux": "electron-builder --linux"
  },
  "build": {
    "appId": "com.schoolguardian.suite",
    "productName": "School Guardian Suite",
    "directories": {
      "output": "dist"
    },
    "win": {
      "target": "nsis",
      "icon": "assets/icon.ico",
      "publish": "github"
    },
    "nsis": {
      "oneClick": false,
      "allowToChangeInstallationDirectory": true,
      "installerIcon": "assets/installer-icon.ico",
      "uninstallerIcon": "assets/installer-icon.ico"
    }
  },
  "devDependencies": {
    "concurrently": "^8.2.2",
    "electron": "^28.0.0",
    "electron-builder": "^24.9.1",
    "wait-on": "^7.2.0"
  },
  "dependencies": {
    "better-sqlite3": "^9.2.2"
  }
}
```

---

## 8. Dependencies to Install

```bash
# In root package.json
npm install better-sqlite3

# In client/ folder (already have most)
npm install @tanstack/react-query zod react-hook-form lucide-react
```

---

## 9. Build Process

```bash
# Development
npm run dev

# Production Build (creates .exe)
npm run build:win

# Output will be in dist/ folder:
# - School Guardian Suite Setup 1.0.0.exe
# - School Guardian Suite 1.0.0.exe
```

---

## 10. Key Features for Desktop App

| Feature | Implementation |
|---------|----------------|
| Offline Database | SQLite with better-sqlite3 |
| Multi-school | schools table with white-labeling |
| ID Card Generation | React-PDF or html2canvas |
| Receipt Generation | React-PDF |
| Data Backup | Export/Import SQLite file |
| Auto-update | electron-updater |

---

## 11. Next Steps

1. **Confirm this architecture** - Electron + React + SQLite
2. I'll create the complete desktop app structure
3. Modify existing React code to use IPC instead of fetch
4. Add SQLite database layer
5. Create desktop-specific features (window controls, tray icon)

**Question:** Kya aap Electron + React + SQLite architecture se agree hain? Ya koi change chahiye?
