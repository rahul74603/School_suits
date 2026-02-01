import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../providers/school_provider.dart';

class SchoolSettingsScreen extends StatefulWidget {
  const SchoolSettingsScreen({super.key});

  @override
  State<SchoolSettingsScreen> createState() => _SchoolSettingsScreenState();
}

class _SchoolSettingsScreenState extends State<SchoolSettingsScreen> {
  final _formKey = GlobalKey<FormState>();
  late TextEditingController _nameController;
  late TextEditingController _addressController;
  late TextEditingController _contactController;
  bool _isLoading = false;

  @override
  void initState() {
    super.initState();
    final school = context.read<SchoolProvider>().currentSchool;
    _nameController = TextEditingController(text: school?.name ?? '');
    _addressController = TextEditingController(text: school?.address ?? '');
    _contactController = TextEditingController(text: school?.contact ?? '');
  }

  @override
  void dispose() {
    _nameController.dispose();
    _addressController.dispose();
    _contactController.dispose();
    super.dispose();
  }

  Future<void> _saveSettings() async {
    if (!_formKey.currentState!.validate()) return;

    setState(() => _isLoading = true);

    await context.read<SchoolProvider>().updateSchool({
      'name': _nameController.text.trim(),
      'address': _addressController.text.trim(),
      'contact': _contactController.text.trim(),
    });

    setState(() => _isLoading = false);

    if (mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Settings saved successfully!'),
          backgroundColor: Colors.green,
        ),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('School Settings'),
      ),
      body: Form(
        key: _formKey,
        child: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            // School Logo Section
            Center(
              child: Column(
                children: [
                  Container(
                    width: 120,
                    height: 120,
                    decoration: BoxDecoration(
                      color: Colors.grey[200],
                      borderRadius: BorderRadius.circular(16),
                      border: Border.all(color: Colors.grey[300]!),
                    ),
                    child: Icon(
                      Icons.school,
                      size: 64,
                      color: Colors.grey[400],
                    ),
                  ),
                  const SizedBox(height: 8),
                  TextButton.icon(
                    onPressed: () {
                      // Image picker would go here
                      ScaffoldMessenger.of(context).showSnackBar(
                        const SnackBar(content: Text('Logo upload coming soon')),
                      );
                    },
                    icon: const Icon(Icons.upload),
                    label: const Text('Upload Logo'),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 24),
            const Divider(),
            const SizedBox(height: 16),

            // School Profile Section
            Text(
              'School Profile',
              style: Theme.of(context).textTheme.titleMedium?.copyWith(
                fontWeight: FontWeight.bold,
              ),
            ),
            const SizedBox(height: 16),

            TextFormField(
              controller: _nameController,
              textCapitalization: TextCapitalization.words,
              decoration: const InputDecoration(
                labelText: 'School Name *',
                prefixIcon: Icon(Icons.business),
              ),
              validator: (v) => v?.isEmpty == true ? 'Required' : null,
            ),
            const SizedBox(height: 16),

            TextFormField(
              controller: _addressController,
              maxLines: 3,
              textCapitalization: TextCapitalization.sentences,
              decoration: const InputDecoration(
                labelText: 'Address *',
                prefixIcon: Icon(Icons.location_on),
                alignLabelWithHint: true,
              ),
              validator: (v) => v?.isEmpty == true ? 'Required' : null,
            ),
            const SizedBox(height: 16),

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
            const SizedBox(height: 32),

            // Save Button
            FilledButton(
              onPressed: _isLoading ? null : _saveSettings,
              style: FilledButton.styleFrom(
                padding: const EdgeInsets.symmetric(vertical: 16),
              ),
              child: _isLoading
                  ? const CircularProgressIndicator()
                  : const Text('Save Settings'),
            ),

            const SizedBox(height: 32),
            const Divider(),
            const SizedBox(height: 16),

            // Additional Settings
            Text(
              'Quick Settings',
              style: Theme.of(context).textTheme.titleMedium?.copyWith(
                fontWeight: FontWeight.bold,
              ),
            ),
            const SizedBox(height: 16),

            Card(
              child: Column(
                children: [
                  ListTile(
                    leading: const Icon(Icons.monetization_on),
                    title: const Text('Fee Structure'),
                    subtitle: const Text('Set class-wise fee amounts'),
                    trailing: const Icon(Icons.chevron_right),
                    onTap: () {
                      // Navigate to fee structure settings
                      ScaffoldMessenger.of(context).showSnackBar(
                        const SnackBar(content: Text('Coming soon')),
                      );
                    },
                  ),
                  const Divider(height: 1),
                  ListTile(
                    leading: const Icon(Icons.backup),
                    title: const Text('Backup Data'),
                    subtitle: const Text('Export database to file'),
                    trailing: const Icon(Icons.chevron_right),
                    onTap: () {
                      ScaffoldMessenger.of(context).showSnackBar(
                        const SnackBar(content: Text('Backup feature coming soon')),
                      );
                    },
                  ),
                  const Divider(height: 1),
                  ListTile(
                    leading: const Icon(Icons.restore),
                    title: const Text('Restore Data'),
                    subtitle: const Text('Import from backup file'),
                    trailing: const Icon(Icons.chevron_right),
                    onTap: () {
                      ScaffoldMessenger.of(context).showSnackBar(
                        const SnackBar(content: Text('Restore feature coming soon')),
                      );
                    },
                  ),
                ],
              ),
            ),

            const SizedBox(height: 32),

            // App Info
            Center(
              child: Column(
                children: [
                  Text(
                    'School Management App',
                    style: TextStyle(color: Colors.grey[600]),
                  ),
                  Text(
                    'Version 1.0.0',
                    style: TextStyle(color: Colors.grey[500], fontSize: 12),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 16),
          ],
        ),
      ),
    );
  }
}
