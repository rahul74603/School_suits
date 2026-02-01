class Student {
  final int? id;
  final String admissionNo;
  final String name;
  final String fatherName;
  final String? motherName;
  final String className;
  final String section;
  final String? rollNo;
  final String? aadhaar;
  final String? category;
  final String? dob;
  final String contact;
  final String? address;
  final String? photo;
  final bool isActive;
  final int schoolId;

  Student({
    this.id,
    required this.admissionNo,
    required this.name,
    required this.fatherName,
    this.motherName,
    required this.className,
    required this.section,
    this.rollNo,
    this.aadhaar,
    this.category,
    this.dob,
    required this.contact,
    this.address,
    this.photo,
    this.isActive = true,
    required this.schoolId,
  });

  factory Student.fromMap(Map<String, dynamic> map) {
    return Student(
      id: map['id'] as int?,
      admissionNo: map['admission_no'] as String,
      name: map['name'] as String,
      fatherName: map['father_name'] as String,
      motherName: map['mother_name'] as String?,
      className: map['class'] as String,
      section: map['section'] as String,
      rollNo: map['roll_no'] as String?,
      aadhaar: map['aadhaar'] as String?,
      category: map['category'] as String?,
      dob: map['dob'] as String?,
      contact: map['contact'] as String,
      address: map['address'] as String?,
      photo: map['photo'] as String?,
      isActive: (map['is_active'] as int?) == 1,
      schoolId: map['school_id'] as int,
    );
  }

  Map<String, dynamic> toMap() {
    return {
      if (id != null) 'id': id,
      'admission_no': admissionNo,
      'name': name,
      'father_name': fatherName,
      'mother_name': motherName,
      'class': className,
      'section': section,
      'roll_no': rollNo,
      'aadhaar': aadhaar,
      'category': category,
      'dob': dob,
      'contact': contact,
      'address': address,
      'photo': photo,
      'is_active': isActive ? 1 : 0,
      'school_id': schoolId,
    };
  }
}

// Fee Payment Model
class FeePayment {
  final int? id;
  final int studentId;
  final int amount;
  final String? month;
  final int year;
  final String? paymentDate;
  final String receiptNo;
  final String? remarks;
  final int schoolId;

  FeePayment({
    this.id,
    required this.studentId,
    required this.amount,
    this.month,
    required this.year,
    this.paymentDate,
    required this.receiptNo,
    this.remarks,
    required this.schoolId,
  });

  factory FeePayment.fromMap(Map<String, dynamic> map) {
    return FeePayment(
      id: map['id'] as int?,
      studentId: map['student_id'] as int,
      amount: map['amount'] as int,
      month: map['month'] as String?,
      year: map['year'] as int,
      paymentDate: map['payment_date'] as String?,
      receiptNo: map['receipt_no'] as String,
      remarks: map['remarks'] as String?,
      schoolId: map['school_id'] as int,
    );
  }

  Map<String, dynamic> toMap() {
    return {
      if (id != null) 'id': id,
      'student_id': studentId,
      'amount': amount,
      'month': month,
      'year': year,
      'receipt_no': receiptNo,
      'remarks': remarks,
      'school_id': schoolId,
    };
  }
}

// Staff Model
class Staff {
  final int? id;
  final String name;
  final String designation;
  final int basicSalary;
  final String contact;
  final String? joinDate;
  final int schoolId;

  Staff({
    this.id,
    required this.name,
    required this.designation,
    required this.basicSalary,
    required this.contact,
    this.joinDate,
    required this.schoolId,
  });

  factory Staff.fromMap(Map<String, dynamic> map) {
    return Staff(
      id: map['id'] as int?,
      name: map['name'] as String,
      designation: map['designation'] as String,
      basicSalary: map['basic_salary'] as int,
      contact: map['contact'] as String,
      joinDate: map['join_date'] as String?,
      schoolId: map['school_id'] as int,
    );
  }

  Map<String, dynamic> toMap() {
    return {
      if (id != null) 'id': id,
      'name': name,
      'designation': designation,
      'basic_salary': basicSalary,
      'contact': contact,
      'join_date': joinDate,
      'school_id': schoolId,
    };
  }
}

// School Model
class School {
  final int? id;
  final String name;
  final String address;
  final String contact;
  final String? logo;

  School({
    this.id,
    required this.name,
    required this.address,
    required this.contact,
    this.logo,
  });

  factory School.fromMap(Map<String, dynamic> map) {
    return School(
      id: map['id'] as int?,
      name: map['name'] as String,
      address: map['address'] as String,
      contact: map['contact'] as String,
      logo: map['logo'] as String?,
    );
  }

  Map<String, dynamic> toMap() {
    return {
      if (id != null) 'id': id,
      'name': name,
      'address': address,
      'contact': contact,
      'logo': logo,
    };
  }
}
