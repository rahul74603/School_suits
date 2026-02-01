import 'package:flutter/foundation.dart';
import '../database/database_helper.dart';
import '../models/student.dart';

class StudentProvider with ChangeNotifier {
  List<Student> _students = [];
  bool _isLoading = false;
  String _selectedClass = 'All';
  String _selectedSection = 'All';
  String _searchQuery = '';

  List<Student> get students => _students;
  bool get isLoading => _isLoading;
  String get selectedClass => _selectedClass;
  String get selectedSection => _selectedSection;

  static const List<String> classes = [
    'All', 'LKG', 'UKG', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12'
  ];
  
  static const List<String> sections = ['All', 'A', 'B', 'C', 'D'];
  
  static const List<String> categories = ['General', 'OBC', 'SC', 'ST', 'EWS'];

  void setClassFilter(String className) {
    _selectedClass = className;
    notifyListeners();
  }

  void setSectionFilter(String section) {
    _selectedSection = section;
    notifyListeners();
  }

  void setSearchQuery(String query) {
    _searchQuery = query;
    notifyListeners();
  }

  Future<void> loadStudents(int schoolId) async {
    _isLoading = true;
    notifyListeners();

    final studentsData = await DatabaseHelper.instance.getStudents(
      schoolId: schoolId,
      classFilter: _selectedClass,
      section: _selectedSection,
      search: _searchQuery.isNotEmpty ? _searchQuery : null,
    );

    _students = studentsData.map((data) => Student.fromMap(data)).toList();
    _isLoading = false;
    notifyListeners();
  }

  Future<Student?> getStudent(int id) async {
    final data = await DatabaseHelper.instance.getStudent(id);
    return data != null ? Student.fromMap(data) : null;
  }

  Future<bool> addStudent(Student student) async {
    try {
      await DatabaseHelper.instance.insertStudent(student.toMap());
      return true;
    } catch (e) {
      return false;
    }
  }

  Future<bool> updateStudent(int id, Student student) async {
    try {
      await DatabaseHelper.instance.updateStudent(id, student.toMap());
      return true;
    } catch (e) {
      return false;
    }
  }

  Future<bool> promoteStudents(List<int> studentIds, String newClass) async {
    try {
      await DatabaseHelper.instance.promoteStudents(studentIds, newClass);
      return true;
    } catch (e) {
      return false;
    }
  }

  String generateAdmissionNo() {
    final now = DateTime.now();
    return 'ADM${now.year}${now.millisecondsSinceEpoch.toString().substring(8)}';
  }
}
