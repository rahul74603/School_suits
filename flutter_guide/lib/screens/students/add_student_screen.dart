import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../providers/student_provider.dart';
import '../../providers/school_provider.dart';
import '../../models/student.dart';

class AddStudentScreen extends StatefulWidget {
  const AddStudentScreen({super.key});

  @override
  State<AddStudentScreen> createState() => _AddStudentScreenState();
}

class _AddStudentScreenState extends State<AddStudentScreen> {
  final _formKey = GlobalKey<FormState>();
  bool _isLoading = false;

  // Controllers
  late TextEditingController _admissionNoController;
  final _nameController = TextEditingController();
  final _fatherNameController = TextEditingController();
  final _motherNameController = TextEditingController();
  final _rollNoController = TextEditingController();
  final _aadhaarController = TextEditingController();
  final _contactController = TextEditingController();
  final _addressController = TextEditingController();

  String _selectedClass = '1';
  String _selectedSection = 'A';
  String _selectedCategory = 'General';
  DateTime? _selectedDob;

  @override
  void initState() {
    super.initState();
    final admNo = context.read<StudentProvider>().generateAdmissionNo();
    _admissionNoController = TextEditingController(text: admNo);
  }

  @override
  void dispose() {
    _admissionNoController.dispose();
    _nameController.dispose();
    _fatherNameController.dispose();
    _motherNameController.dispose();
    _rollNoController.dispose();
    _aadhaarController.dispose();
    _contactController.dispose();
    _addressController.dispose();
    super.dispose();
  }

  Future<void> _selectDate() async {
    final picked = await showDatePicker(
      context: context,
      initialDate: DateTime(2010),
      firstDate: DateTime(2000),
      lastDate: DateTime.now(),
    );
    if (picked != null) {
      setState(() => _selectedDob = picked);
    }
  }

  Future<void> _saveStudent() async {
    if (!_formKey.currentState!.validate()) return;

    setState(() => _isLoading = true);

    final schoolId = context.read<SchoolProvider>().schoolId;
    final student = Student(
      admissionNo: _admissionNoController.text,
      name: _nameController.text.trim(),
      fatherName: _fatherNameController.text.trim(),
      motherName: _motherNameController.text.trim().isEmpty 
          ? null 
          : _motherNameController.text.trim(),
      className: _selectedClass,
      section: _selectedSection,
      rollNo: _rollNoController.text.trim().isEmpty 
          ? null 
          : _rollNoController.text.trim(),
      aadhaar: _aadhaarController.text.trim().isEmpty 
          ? null 
          : _aadhaarController.text.trim(),
      category: _selectedCategory,
      dob: _selectedDob?.toIso8601String().split('T')[0],
      contact: _contactController.text.trim(),
      address: _addressController.text.trim().isEmpty 
          ? null 
          : _addressController.text.trim(),
      schoolId: schoolId,
    );

    final success = await context.read<StudentProvider>().addStudent(student);
    
    setState(() => _isLoading = false);

    if (success && mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Student added successfully!'),
          backgroundColor: Colors.green,
        ),
      );
      Navigator.pop(context);
    } else if (mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Failed to add student'),
          backgroundColor: Colors.red,
        ),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('New Admission'),
      ),
      body: Form(
        key: _formKey,
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Admission Number
              TextFormField(
                controller: _admissionNoController,
                decoration: const InputDecoration(
                  labelText: 'Admission No *',
                  prefixIcon: Icon(Icons.numbers),
                ),
                validator: (v) => v?.isEmpty == true ? 'Required' : null,
              ),
              const SizedBox(height: 16),

              // Student Name
              TextFormField(
                controller: _nameController,
                textCapitalization: TextCapitalization.words,
                decoration: const InputDecoration(
                  labelText: 'Student Name *',
                  prefixIcon: Icon(Icons.person),
                ),
                validator: (v) => v?.isEmpty == true ? 'Required' : null,
              ),
              const SizedBox(height: 16),

              // Father Name
              TextFormField(
                controller: _fatherNameController,
                textCapitalization: TextCapitalization.words,
                decoration: const InputDecoration(
                  labelText: 'Father Name *',
                  prefixIcon: Icon(Icons.person_outline),
                ),
                validator: (v) => v?.isEmpty == true ? 'Required' : null,
              ),
              const SizedBox(height: 16),

              // Mother Name
              TextFormField(
                controller: _motherNameController,
                textCapitalization: TextCapitalization.words,
                decoration: const InputDecoration(
                  labelText: 'Mother Name',
                  prefixIcon: Icon(Icons.person_outline),
                ),
              ),
              const SizedBox(height: 16),

              // Class and Section Row
              Row(
                children: [
                  Expanded(
                    child: DropdownButtonFormField<String>(
                      value: _selectedClass,
                      decoration: const InputDecoration(
                        labelText: 'Class *',
                      ),
                      items: StudentProvider.classes
                          .where((c) => c != 'All')
                          .map((c) => DropdownMenuItem(value: c, child: Text(c)))
                          .toList(),
                      onChanged: (v) => setState(() => _selectedClass = v!),
                    ),
                  ),
                  const SizedBox(width: 16),
                  Expanded(
                    child: DropdownButtonFormField<String>(
                      value: _selectedSection,
                      decoration: const InputDecoration(
                        labelText: 'Section *',
                      ),
                      items: StudentProvider.sections
                          .where((s) => s != 'All')
                          .map((s) => DropdownMenuItem(value: s, child: Text(s)))
                          .toList(),
                      onChanged: (v) => setState(() => _selectedSection = v!),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 16),

              // Roll No
              TextFormField(
                controller: _rollNoController,
                keyboardType: TextInputType.number,
                decoration: const InputDecoration(
                  labelText: 'Roll No',
                  prefixIcon: Icon(Icons.format_list_numbered),
                ),
              ),
              const SizedBox(height: 16),

              // DOB
              GestureDetector(
                onTap: _selectDate,
                child: AbsorbPointer(
                  child: TextFormField(
                    decoration: InputDecoration(
                      labelText: 'Date of Birth',
                      prefixIcon: const Icon(Icons.calendar_today),
                      hintText: _selectedDob != null
                          ? '${_selectedDob!.day}/${_selectedDob!.month}/${_selectedDob!.year}'
                          : 'Select Date',
                    ),
                    controller: TextEditingController(
                      text: _selectedDob != null
                          ? '${_selectedDob!.day}/${_selectedDob!.month}/${_selectedDob!.year}'
                          : '',
                    ),
                  ),
                ),
              ),
              const SizedBox(height: 16),

              // Category
              DropdownButtonFormField<String>(
                value: _selectedCategory,
                decoration: const InputDecoration(
                  labelText: 'Category',
                ),
                items: StudentProvider.categories
                    .map((c) => DropdownMenuItem(value: c, child: Text(c)))
                    .toList(),
                onChanged: (v) => setState(() => _selectedCategory = v!),
              ),
              const SizedBox(height: 16),

              // Aadhaar
              TextFormField(
                controller: _aadhaarController,
                keyboardType: TextInputType.number,
                maxLength: 12,
                decoration: const InputDecoration(
                  labelText: 'Aadhaar Number',
                  prefixIcon: Icon(Icons.credit_card),
                  counterText: '',
                ),
              ),
              const SizedBox(height: 16),

              // Contact
              TextFormField(
                controller: _contactController,
                keyboardType: TextInputType.phone,
                maxLength: 10,
                decoration: const InputDecoration(
                  labelText: 'Contact Number *',
                  prefixIcon: Icon(Icons.phone),
                  prefixText: '+91 ',
                  counterText: '',
                ),
                validator: (v) {
                  if (v?.isEmpty == true) return 'Required';
                  if (v!.length != 10) return 'Enter 10 digit number';
                  return null;
                },
              ),
              const SizedBox(height: 16),

              // Address
              TextFormField(
                controller: _addressController,
                maxLines: 3,
                textCapitalization: TextCapitalization.sentences,
                decoration: const InputDecoration(
                  labelText: 'Address',
                  prefixIcon: Icon(Icons.location_on),
                  alignLabelWithHint: true,
                ),
              ),
              const SizedBox(height: 32),

              // Submit Button
              SizedBox(
                width: double.infinity,
                child: FilledButton(
                  onPressed: _isLoading ? null : _saveStudent,
                  style: FilledButton.styleFrom(
                    padding: const EdgeInsets.symmetric(vertical: 16),
                  ),
                  child: _isLoading
                      ? const SizedBox(
                          height: 20,
                          width: 20,
                          child: CircularProgressIndicator(strokeWidth: 2),
                        )
                      : const Text('Save Student'),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
