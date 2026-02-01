import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:printing/printing.dart';
import 'package:pdf/pdf.dart';
import 'package:pdf/widgets.dart' as pw;
import 'package:share_plus/share_plus.dart';
import '../../models/student.dart';
import '../../providers/student_provider.dart';
import '../../providers/fee_provider.dart';
import '../../providers/school_provider.dart';

class FeeCollectionScreen extends StatefulWidget {
  const FeeCollectionScreen({super.key});

  @override
  State<FeeCollectionScreen> createState() => _FeeCollectionScreenState();
}

class _FeeCollectionScreenState extends State<FeeCollectionScreen> {
  Student? _selectedStudent;
  Map<String, dynamic>? _feeStructure;
  String _selectedMonth = FeeProvider.months[DateTime.now().month - 1];
  final _amountController = TextEditingController();
  final _remarksController = TextEditingController();
  bool _isLoading = false;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      // Check if student was passed as argument
      final student = ModalRoute.of(context)?.settings.arguments as Student?;
      if (student != null) {
        _selectStudent(student);
      }
    });
  }

  @override
  void dispose() {
    _amountController.dispose();
    _remarksController.dispose();
    super.dispose();
  }

  Future<void> _selectStudent(Student student) async {
    setState(() => _selectedStudent = student);
    
    final schoolId = context.read<SchoolProvider>().schoolId;
    final feeStruct = await context.read<FeeProvider>()
        .getFeeStructureForClass(student.className, schoolId);
    
    setState(() {
      _feeStructure = feeStruct;
      _amountController.text = (feeStruct?['monthly_fee'] ?? 0).toString();
    });
  }

  Future<void> _collectFee() async {
    if (_selectedStudent == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Please select a student')),
      );
      return;
    }

    final amount = int.tryParse(_amountController.text);
    if (amount == null || amount <= 0) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Please enter valid amount')),
      );
      return;
    }

    setState(() => _isLoading = true);

    final schoolId = context.read<SchoolProvider>().schoolId;
    final receiptNo = await context.read<FeeProvider>().generateReceiptNo();

    final payment = FeePayment(
      studentId: _selectedStudent!.id!,
      amount: amount,
      month: _selectedMonth,
      year: DateTime.now().year,
      receiptNo: receiptNo,
      remarks: _remarksController.text.trim().isEmpty 
          ? null 
          : _remarksController.text.trim(),
      schoolId: schoolId,
    );

    final success = await context.read<FeeProvider>().collectFee(payment);
    
    setState(() => _isLoading = false);

    if (success && mounted) {
      _showReceiptDialog(payment);
    }
  }

  void _showReceiptDialog(FeePayment payment) {
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        title: const Row(
          children: [
            Icon(Icons.check_circle, color: Colors.green),
            SizedBox(width: 8),
            Text('Payment Successful'),
          ],
        ),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('Receipt No: ${payment.receiptNo}'),
            Text('Amount: ₹${payment.amount}'),
            Text('Month: ${payment.month}'),
            Text('Student: ${_selectedStudent?.name}'),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('Close'),
          ),
          FilledButton.icon(
            onPressed: () {
              Navigator.pop(context);
              _printReceipt(payment);
            },
            icon: const Icon(Icons.print),
            label: const Text('Print'),
          ),
          FilledButton.icon(
            onPressed: () {
              Navigator.pop(context);
              _shareOnWhatsApp(payment);
            },
            icon: const Icon(Icons.share),
            label: const Text('WhatsApp'),
          ),
        ],
      ),
    );
  }

  Future<void> _printReceipt(FeePayment payment) async {
    final school = context.read<SchoolProvider>().currentSchool;
    final pdf = pw.Document();

    pdf.addPage(
      pw.Page(
        pageFormat: PdfPageFormat.a5,
        build: (pw.Context context) {
          return pw.Container(
            padding: const pw.EdgeInsets.all(24),
            child: pw.Column(
              crossAxisAlignment: pw.CrossAxisAlignment.center,
              children: [
                pw.Text(
                  school?.name ?? 'School Name',
                  style: pw.TextStyle(fontSize: 18, fontWeight: pw.FontWeight.bold),
                ),
                pw.Text(school?.address ?? '', style: const pw.TextStyle(fontSize: 10)),
                pw.SizedBox(height: 16),
                pw.Text(
                  'FEE RECEIPT',
                  style: pw.TextStyle(fontSize: 14, fontWeight: pw.FontWeight.bold),
                ),
                pw.Divider(),
                pw.SizedBox(height: 16),
                
                _pdfRow('Receipt No', payment.receiptNo),
                _pdfRow('Date', DateTime.now().toString().split(' ')[0]),
                _pdfRow('Student Name', _selectedStudent?.name ?? '-'),
                _pdfRow('Class', '${_selectedStudent?.className} - ${_selectedStudent?.section}'),
                _pdfRow('Month', payment.month ?? '-'),
                _pdfRow('Amount', '₹${payment.amount}'),
                if (payment.remarks != null) _pdfRow('Remarks', payment.remarks!),
                
                pw.SizedBox(height: 32),
                pw.Row(
                  mainAxisAlignment: pw.MainAxisAlignment.spaceBetween,
                  children: [
                    pw.Text('Receiver Sign'),
                    pw.Text('Cashier'),
                  ],
                ),
              ],
            ),
          );
        },
      ),
    );

    await Printing.layoutPdf(onLayout: (format) async => pdf.save());
  }

  static pw.Widget _pdfRow(String label, String value) {
    return pw.Padding(
      padding: const pw.EdgeInsets.symmetric(vertical: 4),
      child: pw.Row(
        mainAxisAlignment: pw.MainAxisAlignment.spaceBetween,
        children: [
          pw.Text(label, style: pw.TextStyle(fontWeight: pw.FontWeight.bold)),
          pw.Text(value),
        ],
      ),
    );
  }

  void _shareOnWhatsApp(FeePayment payment) {
    final school = context.read<SchoolProvider>().currentSchool;
    final message = '''
*${school?.name ?? 'School'}*
Fee Receipt

Receipt No: ${payment.receiptNo}
Date: ${DateTime.now().toString().split(' ')[0]}
Student: ${_selectedStudent?.name}
Class: ${_selectedStudent?.className} - ${_selectedStudent?.section}
Month: ${payment.month}
Amount: ₹${payment.amount}

Thank you for the payment!
''';
    
    Share.share(message);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Collect Fee'),
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Search Student
            if (_selectedStudent == null) ...[
              Text(
                'Select Student',
                style: Theme.of(context).textTheme.titleMedium,
              ),
              const SizedBox(height: 8),
              TextField(
                decoration: const InputDecoration(
                  hintText: 'Search student by name...',
                  prefixIcon: Icon(Icons.search),
                ),
                onSubmitted: (value) async {
                  final schoolId = context.read<SchoolProvider>().schoolId;
                  await context.read<StudentProvider>().loadStudents(schoolId);
                  _showStudentPicker();
                },
                onTap: () async {
                  final schoolId = context.read<SchoolProvider>().schoolId;
                  await context.read<StudentProvider>().loadStudents(schoolId);
                  _showStudentPicker();
                },
              ),
            ] else ...[
              // Selected Student Card
              Card(
                child: ListTile(
                  leading: CircleAvatar(
                    child: Text(_selectedStudent!.name[0]),
                  ),
                  title: Text(_selectedStudent!.name),
                  subtitle: Text(
                    'Class ${_selectedStudent!.className} - ${_selectedStudent!.section}\nAdm: ${_selectedStudent!.admissionNo}',
                  ),
                  trailing: IconButton(
                    icon: const Icon(Icons.close),
                    onPressed: () => setState(() {
                      _selectedStudent = null;
                      _feeStructure = null;
                      _amountController.clear();
                    }),
                  ),
                ),
              ),
              const SizedBox(height: 24),

              // Fee Details
              if (_feeStructure != null) ...[
                Card(
                  color: Colors.blue.shade50,
                  child: Padding(
                    padding: const EdgeInsets.all(16),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          'Fee Structure (Class ${_selectedStudent!.className})',
                          style: const TextStyle(fontWeight: FontWeight.bold),
                        ),
                        const SizedBox(height: 8),
                        _feeRow('Monthly Fee', _feeStructure!['monthly_fee']),
                        _feeRow('Admission Fee', _feeStructure!['admission_fee']),
                        _feeRow('Exam Fee', _feeStructure!['exam_fee']),
                      ],
                    ),
                  ),
                ),
                const SizedBox(height: 16),
              ],

              // Month Selection
              DropdownButtonFormField<String>(
                value: _selectedMonth,
                decoration: const InputDecoration(
                  labelText: 'Select Month',
                ),
                items: FeeProvider.months
                    .map((m) => DropdownMenuItem(value: m, child: Text(m)))
                    .toList(),
                onChanged: (v) => setState(() => _selectedMonth = v!),
              ),
              const SizedBox(height: 16),

              // Amount
              TextFormField(
                controller: _amountController,
                keyboardType: TextInputType.number,
                decoration: const InputDecoration(
                  labelText: 'Amount *',
                  prefixText: '₹ ',
                ),
              ),
              const SizedBox(height: 16),

              // Remarks
              TextFormField(
                controller: _remarksController,
                decoration: const InputDecoration(
                  labelText: 'Remarks (Cash/Online/Cheque)',
                ),
              ),
              const SizedBox(height: 32),

              // Submit
              SizedBox(
                width: double.infinity,
                child: FilledButton(
                  onPressed: _isLoading ? null : _collectFee,
                  style: FilledButton.styleFrom(
                    padding: const EdgeInsets.symmetric(vertical: 16),
                  ),
                  child: _isLoading
                      ? const CircularProgressIndicator()
                      : const Text('Collect Fee & Generate Receipt'),
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }

  Widget _feeRow(String label, dynamic value) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 2),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(label),
          Text('₹${value ?? 0}', style: const TextStyle(fontWeight: FontWeight.w500)),
        ],
      ),
    );
  }

  void _showStudentPicker() {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      builder: (context) {
        return DraggableScrollableSheet(
          initialChildSize: 0.7,
          minChildSize: 0.5,
          maxChildSize: 0.95,
          expand: false,
          builder: (context, scrollController) {
            return Consumer<StudentProvider>(
              builder: (context, provider, _) {
                return Column(
                  children: [
                    Padding(
                      padding: const EdgeInsets.all(16),
                      child: Text(
                        'Select Student',
                        style: Theme.of(context).textTheme.titleLarge,
                      ),
                    ),
                    Expanded(
                      child: ListView.builder(
                        controller: scrollController,
                        itemCount: provider.students.length,
                        itemBuilder: (context, index) {
                          final student = provider.students[index];
                          return ListTile(
                            leading: CircleAvatar(child: Text(student.name[0])),
                            title: Text(student.name),
                            subtitle: Text('Class ${student.className} - ${student.section}'),
                            onTap: () {
                              Navigator.pop(context);
                              _selectStudent(student);
                            },
                          );
                        },
                      ),
                    ),
                  ],
                );
              },
            );
          },
        );
      },
    );
  }
}
