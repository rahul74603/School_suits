import 'package:flutter/foundation.dart';
import '../database/database_helper.dart';
import '../models/student.dart';

class StaffProvider with ChangeNotifier {
  List<Staff> _staffList = [];
  bool _isLoading = false;

  List<Staff> get staffList => _staffList;
  bool get isLoading => _isLoading;

  static const List<String> designations = [
    'Principal',
    'Vice Principal',
    'Teacher',
    'Clerk',
    'Peon',
    'Guard',
    'Driver',
    'Other'
  ];

  Future<void> loadStaff(int schoolId) async {
    _isLoading = true;
    notifyListeners();

    final staffData = await DatabaseHelper.instance.getStaff(schoolId: schoolId);
    _staffList = staffData.map((data) => Staff.fromMap(data)).toList();
    
    _isLoading = false;
    notifyListeners();
  }

  Future<bool> addStaff(Staff staff) async {
    try {
      await DatabaseHelper.instance.insertStaff(staff.toMap());
      return true;
    } catch (e) {
      return false;
    }
  }
}
