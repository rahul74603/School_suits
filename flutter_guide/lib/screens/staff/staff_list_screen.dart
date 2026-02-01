import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../providers/staff_provider.dart';
import '../../providers/school_provider.dart';
import '../../models/student.dart';

class StaffListScreen extends StatefulWidget {
  const StaffListScreen({super.key});

  @override
  State<StaffListScreen> createState() => _StaffListScreenState();
}

class _StaffListScreenState extends State<StaffListScreen> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      _loadStaff();
    });
  }

  Future<void> _loadStaff() async {
    final schoolId = context.read<SchoolProvider>().schoolId;
    await context.read<StaffProvider>().loadStaff(schoolId);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Staff Management'),
      ),
      body: Consumer<StaffProvider>(
        builder: (context, provider, _) {
          if (provider.isLoading) {
            return const Center(child: CircularProgressIndicator());
          }

          if (provider.staffList.isEmpty) {
            return Center(
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Icon(Icons.group_off, size: 64, color: Colors.grey[400]),
                  const SizedBox(height: 16),
                  Text(
                    'No staff members added',
                    style: TextStyle(color: Colors.grey[600]),
                  ),
                  const SizedBox(height: 8),
                  FilledButton.icon(
                    onPressed: () => _showAddStaffDialog(context),
                    icon: const Icon(Icons.add),
                    label: const Text('Add Staff'),
                  ),
                ],
              ),
            );
          }

          return RefreshIndicator(
            onRefresh: _loadStaff,
            child: ListView.builder(
              padding: const EdgeInsets.all(16),
              itemCount: provider.staffList.length,
              itemBuilder: (context, index) {
                final staff = provider.staffList[index];
                return Card(
                  margin: const EdgeInsets.only(bottom: 12),
                  child: ListTile(
                    leading: CircleAvatar(
                      backgroundColor: Theme.of(context).colorScheme.primaryContainer,
                      child: Text(
                        staff.name[0],
                        style: TextStyle(
                          color: Theme.of(context).colorScheme.primary,
                        ),
                      ),
                    ),
                    title: Text(staff.name),
                    subtitle: Text(staff.designation),
                    trailing: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      crossAxisAlignment: CrossAxisAlignment.end,
                      children: [
                        Text(
                          '₹${staff.basicSalary}',
                          style: const TextStyle(
                            fontWeight: FontWeight.bold,
                            fontSize: 16,
                          ),
                        ),
                        const Text('/ month', style: TextStyle(fontSize: 10)),
                      ],
                    ),
                  ),
                );
              },
            ),
          );
        },
      ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () => _showAddStaffDialog(context),
        icon: const Icon(Icons.add),
        label: const Text('Add Staff'),
      ),
    );
  }

  void _showAddStaffDialog(BuildContext context) {
    final formKey = GlobalKey<FormState>();
    final nameController = TextEditingController();
    final salaryController = TextEditingController();
    final contactController = TextEditingController();
    String designation = 'Teacher';

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      builder: (context) {
        return Padding(
          padding: EdgeInsets.only(
            bottom: MediaQuery.of(context).viewInsets.bottom,
            left: 24,
            right: 24,
            top: 24,
          ),
          child: Form(
            key: formKey,
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Add Staff Member',
                  style: Theme.of(context).textTheme.titleLarge,
                ),
                const SizedBox(height: 24),

                TextFormField(
                  controller: nameController,
                  textCapitalization: TextCapitalization.words,
                  decoration: const InputDecoration(
                    labelText: 'Full Name *',
                    prefixIcon: Icon(Icons.person),
                  ),
                  validator: (v) => v?.isEmpty == true ? 'Required' : null,
                ),
                const SizedBox(height: 16),

                DropdownButtonFormField<String>(
                  value: designation,
                  decoration: const InputDecoration(
                    labelText: 'Designation *',
                  ),
                  items: StaffProvider.designations
                      .map((d) => DropdownMenuItem(value: d, child: Text(d)))
                      .toList(),
                  onChanged: (v) => designation = v!,
                ),
                const SizedBox(height: 16),

                TextFormField(
                  controller: salaryController,
                  keyboardType: TextInputType.number,
                  decoration: const InputDecoration(
                    labelText: 'Basic Salary *',
                    prefixText: '₹ ',
                    prefixIcon: Icon(Icons.currency_rupee),
                  ),
                  validator: (v) {
                    if (v?.isEmpty == true) return 'Required';
                    if (int.tryParse(v!) == null) return 'Enter valid amount';
                    return null;
                  },
                ),
                const SizedBox(height: 16),

                TextFormField(
                  controller: contactController,
                  keyboardType: TextInputType.phone,
                  maxLength: 10,
                  decoration: const InputDecoration(
                    labelText: 'Contact *',
                    prefixIcon: Icon(Icons.phone),
                    prefixText: '+91 ',
                    counterText: '',
                  ),
                  validator: (v) {
                    if (v?.isEmpty == true) return 'Required';
                    if (v!.length != 10) return 'Enter 10 digits';
                    return null;
                  },
                ),
                const SizedBox(height: 24),

                SizedBox(
                  width: double.infinity,
                  child: FilledButton(
                    onPressed: () async {
                      if (!formKey.currentState!.validate()) return;

                      final schoolId = context.read<SchoolProvider>().schoolId;
                      final staff = Staff(
                        name: nameController.text.trim(),
                        designation: designation,
                        basicSalary: int.parse(salaryController.text),
                        contact: contactController.text.trim(),
                        schoolId: schoolId,
                      );

                      final success = await context.read<StaffProvider>().addStaff(staff);
                      
                      if (success && context.mounted) {
                        Navigator.pop(context);
                        _loadStaff();
                        ScaffoldMessenger.of(context).showSnackBar(
                          const SnackBar(content: Text('Staff added successfully')),
                        );
                      }
                    },
                    child: const Text('Add Staff'),
                  ),
                ),
                const SizedBox(height: 24),
              ],
            ),
          ),
        );
      },
    );
  }
}
