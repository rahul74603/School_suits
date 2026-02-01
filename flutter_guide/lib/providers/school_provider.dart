import 'package:flutter/foundation.dart';
import '../database/database_helper.dart';
import '../models/student.dart';

class SchoolProvider with ChangeNotifier {
  School? _currentSchool;
  Map<String, dynamic>? _currentUser;
  bool _isLoggedIn = false;

  School? get currentSchool => _currentSchool;
  Map<String, dynamic>? get currentUser => _currentUser;
  bool get isLoggedIn => _isLoggedIn;
  int get schoolId => _currentSchool?.id ?? 1;

  Future<bool> login(String username, String password) async {
    final user = await DatabaseHelper.instance.login(username, password);
    if (user != null) {
      _currentUser = user;
      _isLoggedIn = true;
      
      // Load school data
      final schoolData = await DatabaseHelper.instance.getSchool(user['school_id'] as int);
      if (schoolData != null) {
        _currentSchool = School.fromMap(schoolData);
      }
      
      notifyListeners();
      return true;
    }
    return false;
  }

  void logout() {
    _currentUser = null;
    _currentSchool = null;
    _isLoggedIn = false;
    notifyListeners();
  }

  Future<void> loadSchool(int id) async {
    final schoolData = await DatabaseHelper.instance.getSchool(id);
    if (schoolData != null) {
      _currentSchool = School.fromMap(schoolData);
      notifyListeners();
    }
  }

  Future<void> updateSchool(Map<String, dynamic> data) async {
    if (_currentSchool?.id != null) {
      await DatabaseHelper.instance.updateSchool(_currentSchool!.id!, data);
      await loadSchool(_currentSchool!.id!);
    }
  }

  Future<Map<String, dynamic>> getDashboardStats() async {
    return await DatabaseHelper.instance.getDashboardStats(schoolId);
  }
}
