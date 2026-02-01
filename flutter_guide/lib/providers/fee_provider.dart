import 'package:flutter/foundation.dart';
import '../database/database_helper.dart';
import '../models/student.dart';

class FeeProvider with ChangeNotifier {
  List<FeePayment> _payments = [];
  List<Map<String, dynamic>> _feeStructures = [];
  List<Map<String, dynamic>> _defaulters = [];
  bool _isLoading = false;

  List<FeePayment> get payments => _payments;
  List<Map<String, dynamic>> get feeStructures => _feeStructures;
  List<Map<String, dynamic>> get defaulters => _defaulters;
  bool get isLoading => _isLoading;

  static const List<String> months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  Future<void> loadFeeStructures(int schoolId) async {
    _feeStructures = await DatabaseHelper.instance.getFeeStructures(schoolId: schoolId);
    notifyListeners();
  }

  Future<void> loadPayments({int? studentId}) async {
    _isLoading = true;
    notifyListeners();

    final paymentsData = await DatabaseHelper.instance.getFeePayments(studentId: studentId);
    _payments = paymentsData.map((data) => FeePayment.fromMap(data)).toList();
    
    _isLoading = false;
    notifyListeners();
  }

  Future<void> loadDefaulters(String month, int year, {String? classFilter}) async {
    _isLoading = true;
    notifyListeners();

    _defaulters = await DatabaseHelper.instance.getDefaulters(month, year, classFilter: classFilter);
    
    _isLoading = false;
    notifyListeners();
  }

  Future<Map<String, dynamic>?> getFeeStructureForClass(String className, int schoolId) async {
    return await DatabaseHelper.instance.getFeeStructureByClass(className, schoolId);
  }

  Future<String> generateReceiptNo() async {
    return await DatabaseHelper.instance.generateReceiptNo();
  }

  Future<bool> collectFee(FeePayment payment) async {
    try {
      await DatabaseHelper.instance.insertFeePayment(payment.toMap());
      return true;
    } catch (e) {
      return false;
    }
  }

  Future<bool> addFeeStructure(Map<String, dynamic> structure) async {
    try {
      await DatabaseHelper.instance.insertFeeStructure(structure);
      return true;
    } catch (e) {
      return false;
    }
  }

  List<FeePayment> getStudentPayments(int studentId) {
    return _payments.where((p) => p.studentId == studentId).toList();
  }

  int calculatePendingFees(int studentId, String className, int schoolId) {
    // This would need the fee structure and payments to calculate
    // Simplified for now
    return 0;
  }
}
