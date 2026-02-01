import 'package:sqflite/sqflite.dart';
import 'package:path/path.dart';

class DatabaseHelper {
  static final DatabaseHelper instance = DatabaseHelper._init();
  static Database? _database;

  DatabaseHelper._init();

  Future<Database> get database async {
    if (_database != null) return _database!;
    _database = await _initDB('school_management.db');
    return _database!;
  }

  Future<Database> _initDB(String filePath) async {
    final dbPath = await getDatabasesPath();
    final path = join(dbPath, filePath);

    return await openDatabase(
      path,
      version: 1,
      onCreate: _createDB,
    );
  }

  Future _createDB(Database db, int version) async {
    // School Profile Table
    await db.execute('''
      CREATE TABLE schools (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        address TEXT NOT NULL,
        contact TEXT NOT NULL,
        logo TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    ''');

    // Users Table (Admin/Staff)
    await db.execute('''
      CREATE TABLE users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        role TEXT DEFAULT 'staff',
        name TEXT NOT NULL,
        school_id INTEGER,
        FOREIGN KEY (school_id) REFERENCES schools (id)
      )
    ''');

    // Students Table
    await db.execute('''
      CREATE TABLE students (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        admission_no TEXT NOT NULL,
        name TEXT NOT NULL,
        father_name TEXT NOT NULL,
        mother_name TEXT,
        class TEXT NOT NULL,
        section TEXT NOT NULL,
        roll_no TEXT,
        aadhaar TEXT,
        category TEXT,
        dob TEXT,
        contact TEXT NOT NULL,
        address TEXT,
        photo TEXT,
        is_active INTEGER DEFAULT 1,
        school_id INTEGER NOT NULL,
        FOREIGN KEY (school_id) REFERENCES schools (id)
      )
    ''');

    // Fee Structure Table
    await db.execute('''
      CREATE TABLE fee_structures (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        class TEXT NOT NULL,
        monthly_fee INTEGER NOT NULL,
        admission_fee INTEGER DEFAULT 0,
        exam_fee INTEGER DEFAULT 0,
        other_fee INTEGER DEFAULT 0,
        school_id INTEGER NOT NULL,
        FOREIGN KEY (school_id) REFERENCES schools (id)
      )
    ''');

    // Fee Payments Table
    await db.execute('''
      CREATE TABLE fee_payments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        student_id INTEGER NOT NULL,
        amount INTEGER NOT NULL,
        month TEXT,
        year INTEGER NOT NULL,
        payment_date TEXT DEFAULT CURRENT_TIMESTAMP,
        receipt_no TEXT NOT NULL,
        remarks TEXT,
        school_id INTEGER NOT NULL,
        FOREIGN KEY (student_id) REFERENCES students (id),
        FOREIGN KEY (school_id) REFERENCES schools (id)
      )
    ''');

    // Staff Table
    await db.execute('''
      CREATE TABLE staff (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        designation TEXT NOT NULL,
        basic_salary INTEGER NOT NULL,
        contact TEXT NOT NULL,
        join_date TEXT,
        school_id INTEGER NOT NULL,
        FOREIGN KEY (school_id) REFERENCES schools (id)
      )
    ''');

    // Salary Payments Table
    await db.execute('''
      CREATE TABLE salary_payments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        staff_id INTEGER NOT NULL,
        amount INTEGER NOT NULL,
        month TEXT NOT NULL,
        year INTEGER NOT NULL,
        payment_date TEXT DEFAULT CURRENT_TIMESTAMP,
        is_advance INTEGER DEFAULT 0,
        remarks TEXT,
        FOREIGN KEY (staff_id) REFERENCES staff (id)
      )
    ''');

    // Insert default admin user
    await db.insert('schools', {
      'name': 'My School',
      'address': 'School Address',
      'contact': '9999999999',
    });

    await db.insert('users', {
      'username': 'admin',
      'password': 'admin123',
      'role': 'admin',
      'name': 'Administrator',
      'school_id': 1,
    });
  }

  // === STUDENTS CRUD ===
  Future<int> insertStudent(Map<String, dynamic> student) async {
    final db = await database;
    return await db.insert('students', student);
  }

  Future<List<Map<String, dynamic>>> getStudents({
    int? schoolId,
    String? classFilter,
    String? section,
    String? search,
  }) async {
    final db = await database;
    String where = 'is_active = 1';
    List<dynamic> args = [];

    if (schoolId != null) {
      where += ' AND school_id = ?';
      args.add(schoolId);
    }
    if (classFilter != null && classFilter != 'All') {
      where += ' AND class = ?';
      args.add(classFilter);
    }
    if (section != null && section != 'All') {
      where += ' AND section = ?';
      args.add(section);
    }
    if (search != null && search.isNotEmpty) {
      where += ' AND name LIKE ?';
      args.add('%$search%');
    }

    return await db.query('students', where: where, whereArgs: args);
  }

  Future<Map<String, dynamic>?> getStudent(int id) async {
    final db = await database;
    final results = await db.query('students', where: 'id = ?', whereArgs: [id]);
    return results.isNotEmpty ? results.first : null;
  }

  Future<int> updateStudent(int id, Map<String, dynamic> student) async {
    final db = await database;
    return await db.update('students', student, where: 'id = ?', whereArgs: [id]);
  }

  Future<int> promoteStudents(List<int> studentIds, String newClass) async {
    final db = await database;
    return await db.update(
      'students',
      {'class': newClass},
      where: 'id IN (${studentIds.join(",")})',
    );
  }

  // === FEE PAYMENTS ===
  Future<int> insertFeePayment(Map<String, dynamic> payment) async {
    final db = await database;
    return await db.insert('fee_payments', payment);
  }

  Future<List<Map<String, dynamic>>> getFeePayments({int? studentId}) async {
    final db = await database;
    if (studentId != null) {
      return await db.query('fee_payments', where: 'student_id = ?', whereArgs: [studentId]);
    }
    return await db.query('fee_payments');
  }

  Future<String> generateReceiptNo() async {
    final db = await database;
    final result = await db.rawQuery('SELECT MAX(id) as max_id FROM fee_payments');
    int nextId = (result.first['max_id'] as int? ?? 0) + 1;
    return 'REC${DateTime.now().year}${nextId.toString().padLeft(5, '0')}';
  }

  // === DEFAULTERS ===
  Future<List<Map<String, dynamic>>> getDefaulters(String month, int year, {String? classFilter}) async {
    final db = await database;
    
    String query = '''
      SELECT s.id, s.name, s.class, s.section, s.contact, s.father_name,
             COALESCE(fs.monthly_fee, 0) as monthly_fee
      FROM students s
      LEFT JOIN fee_structures fs ON s.class = fs.class AND s.school_id = fs.school_id
      WHERE s.is_active = 1
        AND s.id NOT IN (
          SELECT student_id FROM fee_payments 
          WHERE month = ? AND year = ?
        )
    ''';
    
    List<dynamic> args = [month, year];
    
    if (classFilter != null && classFilter != 'All') {
      query += ' AND s.class = ?';
      args.add(classFilter);
    }
    
    return await db.rawQuery(query, args);
  }

  // === STAFF ===
  Future<int> insertStaff(Map<String, dynamic> staffData) async {
    final db = await database;
    return await db.insert('staff', staffData);
  }

  Future<List<Map<String, dynamic>>> getStaff({int? schoolId}) async {
    final db = await database;
    if (schoolId != null) {
      return await db.query('staff', where: 'school_id = ?', whereArgs: [schoolId]);
    }
    return await db.query('staff');
  }

  // === FEE STRUCTURES ===
  Future<int> insertFeeStructure(Map<String, dynamic> structure) async {
    final db = await database;
    return await db.insert('fee_structures', structure);
  }

  Future<List<Map<String, dynamic>>> getFeeStructures({int? schoolId}) async {
    final db = await database;
    if (schoolId != null) {
      return await db.query('fee_structures', where: 'school_id = ?', whereArgs: [schoolId]);
    }
    return await db.query('fee_structures');
  }

  Future<Map<String, dynamic>?> getFeeStructureByClass(String className, int schoolId) async {
    final db = await database;
    final results = await db.query(
      'fee_structures',
      where: 'class = ? AND school_id = ?',
      whereArgs: [className, schoolId],
    );
    return results.isNotEmpty ? results.first : null;
  }

  // === SCHOOL ===
  Future<Map<String, dynamic>?> getSchool(int id) async {
    final db = await database;
    final results = await db.query('schools', where: 'id = ?', whereArgs: [id]);
    return results.isNotEmpty ? results.first : null;
  }

  Future<int> updateSchool(int id, Map<String, dynamic> school) async {
    final db = await database;
    return await db.update('schools', school, where: 'id = ?', whereArgs: [id]);
  }

  // === AUTH ===
  Future<Map<String, dynamic>?> login(String username, String password) async {
    final db = await database;
    final results = await db.query(
      'users',
      where: 'username = ? AND password = ?',
      whereArgs: [username, password],
    );
    return results.isNotEmpty ? results.first : null;
  }

  // === DASHBOARD STATS ===
  Future<Map<String, dynamic>> getDashboardStats(int schoolId) async {
    final db = await database;
    
    final studentCount = Sqflite.firstIntValue(await db.rawQuery(
      'SELECT COUNT(*) FROM students WHERE school_id = ? AND is_active = 1',
      [schoolId],
    )) ?? 0;

    final todayCollection = Sqflite.firstIntValue(await db.rawQuery(
      "SELECT COALESCE(SUM(amount), 0) FROM fee_payments WHERE date(payment_date) = date('now') AND school_id = ?",
      [schoolId],
    )) ?? 0;

    final monthlyCollection = Sqflite.firstIntValue(await db.rawQuery(
      "SELECT COALESCE(SUM(amount), 0) FROM fee_payments WHERE strftime('%m', payment_date) = strftime('%m', 'now') AND school_id = ?",
      [schoolId],
    )) ?? 0;

    return {
      'total_students': studentCount,
      'today_collection': todayCollection,
      'monthly_collection': monthlyCollection,
    };
  }
}
