import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:printing/printing.dart';
import 'package:pdf/pdf.dart';
import 'package:pdf/widgets.dart' as pw;
import '../../models/student.dart';
import '../../providers/school_provider.dart';

class IdCardScreen extends StatelessWidget {
  const IdCardScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final student = ModalRoute.of(context)?.settings.arguments as Student?;
    final school = context.read<SchoolProvider>().currentSchool;

    if (student == null) {
      return Scaffold(
        appBar: AppBar(title: const Text('ID Card')),
        body: const Center(child: Text('No student selected')),
      );
    }

    return Scaffold(
      appBar: AppBar(
        title: const Text('Student ID Card'),
        actions: [
          IconButton(
            icon: const Icon(Icons.print),
            onPressed: () => _printIdCard(context, student, school),
          ),
        ],
      ),
      body: Center(
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: _IdCardPreview(student: student, school: school),
        ),
      ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () => _printIdCard(context, student, school),
        icon: const Icon(Icons.print),
        label: const Text('Print ID Card'),
      ),
    );
  }

  Future<void> _printIdCard(BuildContext context, Student student, dynamic school) async {
    final pdf = pw.Document();

    pdf.addPage(
      pw.Page(
        pageFormat: const PdfPageFormat(85.6 * PdfPageFormat.mm, 53.98 * PdfPageFormat.mm),
        build: (pw.Context context) {
          return pw.Container(
            padding: const pw.EdgeInsets.all(8),
            decoration: pw.BoxDecoration(
              border: pw.Border.all(color: PdfColors.blue, width: 2),
              borderRadius: pw.BorderRadius.circular(8),
            ),
            child: pw.Column(
              crossAxisAlignment: pw.CrossAxisAlignment.start,
              children: [
                // Header with School Name
                pw.Center(
                  child: pw.Column(
                    children: [
                      pw.Text(
                        school?.name ?? 'School Name',
                        style: pw.TextStyle(
                          fontSize: 12,
                          fontWeight: pw.FontWeight.bold,
                          color: PdfColors.blue900,
                        ),
                      ),
                      pw.Text(
                        school?.address ?? 'School Address',
                        style: const pw.TextStyle(fontSize: 7),
                      ),
                    ],
                  ),
                ),
                pw.Divider(height: 8, thickness: 0.5),
                pw.SizedBox(height: 4),
                
                // Student Details
                pw.Row(
                  crossAxisAlignment: pw.CrossAxisAlignment.start,
                  children: [
                    // Photo Placeholder
                    pw.Container(
                      width: 50,
                      height: 60,
                      decoration: pw.BoxDecoration(
                        border: pw.Border.all(color: PdfColors.grey400),
                      ),
                      child: pw.Center(
                        child: pw.Text('PHOTO', style: const pw.TextStyle(fontSize: 8)),
                      ),
                    ),
                    pw.SizedBox(width: 8),
                    
                    // Info
                    pw.Expanded(
                      child: pw.Column(
                        crossAxisAlignment: pw.CrossAxisAlignment.start,
                        children: [
                          _pdfInfoRow('Name', student.name),
                          _pdfInfoRow('Class', '${student.className} - ${student.section}'),
                          _pdfInfoRow('Roll No', student.rollNo ?? '-'),
                          _pdfInfoRow('Father', student.fatherName),
                          _pdfInfoRow('Contact', student.contact),
                        ],
                      ),
                    ),
                  ],
                ),
                
                pw.Spacer(),
                
                // Footer
                pw.Row(
                  mainAxisAlignment: pw.MainAxisAlignment.spaceBetween,
                  children: [
                    pw.Text(
                      'Adm No: ${student.admissionNo}',
                      style: const pw.TextStyle(fontSize: 7),
                    ),
                    pw.Text(
                      'Principal Sign',
                      style: const pw.TextStyle(fontSize: 7),
                    ),
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

  static pw.Widget _pdfInfoRow(String label, String value) {
    return pw.Padding(
      padding: const pw.EdgeInsets.only(bottom: 2),
      child: pw.Row(
        children: [
          pw.SizedBox(
            width: 40,
            child: pw.Text(
              '$label:',
              style: pw.TextStyle(fontSize: 7, fontWeight: pw.FontWeight.bold),
            ),
          ),
          pw.Text(value, style: const pw.TextStyle(fontSize: 7)),
        ],
      ),
    );
  }
}

class _IdCardPreview extends StatelessWidget {
  final Student student;
  final dynamic school;

  const _IdCardPreview({required this.student, this.school});

  @override
  Widget build(BuildContext context) {
    return Container(
      width: 340,
      height: 215,
      decoration: BoxDecoration(
        color: Colors.white,
        border: Border.all(color: Colors.blue, width: 3),
        borderRadius: BorderRadius.circular(12),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.1),
            blurRadius: 10,
            offset: const Offset(0, 5),
          ),
        ],
      ),
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: Column(
          children: [
            // Header
            Text(
              school?.name ?? 'School Name',
              style: const TextStyle(
                fontSize: 16,
                fontWeight: FontWeight.bold,
                color: Colors.blue,
              ),
            ),
            Text(
              school?.address ?? 'School Address',
              style: TextStyle(fontSize: 10, color: Colors.grey[600]),
            ),
            const Divider(),
            
            // Content
            Expanded(
              child: Row(
                children: [
                  // Photo
                  Container(
                    width: 80,
                    height: 100,
                    decoration: BoxDecoration(
                      color: Colors.grey[200],
                      border: Border.all(color: Colors.grey),
                      borderRadius: BorderRadius.circular(4),
                    ),
                    child: const Icon(Icons.person, size: 48, color: Colors.grey),
                  ),
                  const SizedBox(width: 12),
                  
                  // Details
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        _infoRow('Name', student.name),
                        _infoRow('Class', '${student.className} - ${student.section}'),
                        _infoRow('Roll No', student.rollNo ?? '-'),
                        _infoRow('Father', student.fatherName),
                        _infoRow('Contact', student.contact),
                      ],
                    ),
                  ),
                ],
              ),
            ),
            
            // Footer
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text(
                  'Adm No: ${student.admissionNo}',
                  style: TextStyle(fontSize: 10, color: Colors.grey[600]),
                ),
                Text(
                  'Principal Sign',
                  style: TextStyle(fontSize: 10, color: Colors.grey[600]),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  Widget _infoRow(String label, String value) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 4),
      child: Row(
        children: [
          SizedBox(
            width: 60,
            child: Text(
              '$label:',
              style: const TextStyle(
                fontSize: 11,
                fontWeight: FontWeight.w600,
              ),
            ),
          ),
          Expanded(
            child: Text(
              value,
              style: const TextStyle(fontSize: 11),
              overflow: TextOverflow.ellipsis,
            ),
          ),
        ],
      ),
    );
  }
}
