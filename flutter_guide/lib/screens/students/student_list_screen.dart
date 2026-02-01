import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../providers/student_provider.dart';
import '../../providers/school_provider.dart';
import '../../models/student.dart';

class StudentListScreen extends StatefulWidget {
  const StudentListScreen({super.key});

  @override
  State<StudentListScreen> createState() => _StudentListScreenState();
}

class _StudentListScreenState extends State<StudentListScreen> {
  final _searchController = TextEditingController();

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      _loadStudents();
    });
  }

  Future<void> _loadStudents() async {
    final schoolId = context.read<SchoolProvider>().schoolId;
    await context.read<StudentProvider>().loadStudents(schoolId);
  }

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Students'),
        actions: [
          IconButton(
            icon: const Icon(Icons.filter_list),
            onPressed: _showFilterDialog,
          ),
        ],
      ),
      body: Column(
        children: [
          // Search Bar
          Padding(
            padding: const EdgeInsets.all(16),
            child: TextField(
              controller: _searchController,
              decoration: InputDecoration(
                hintText: 'Search by name...',
                prefixIcon: const Icon(Icons.search),
                suffixIcon: _searchController.text.isNotEmpty
                    ? IconButton(
                        icon: const Icon(Icons.clear),
                        onPressed: () {
                          _searchController.clear();
                          context.read<StudentProvider>().setSearchQuery('');
                          _loadStudents();
                        },
                      )
                    : null,
              ),
              onSubmitted: (value) {
                context.read<StudentProvider>().setSearchQuery(value);
                _loadStudents();
              },
            ),
          ),

          // Filter Chips
          Consumer<StudentProvider>(
            builder: (context, provider, _) {
              return Padding(
                padding: const EdgeInsets.symmetric(horizontal: 16),
                child: Row(
                  children: [
                    FilterChip(
                      label: Text('Class: ${provider.selectedClass}'),
                      selected: provider.selectedClass != 'All',
                      onSelected: (_) => _showFilterDialog(),
                    ),
                    const SizedBox(width: 8),
                    FilterChip(
                      label: Text('Section: ${provider.selectedSection}'),
                      selected: provider.selectedSection != 'All',
                      onSelected: (_) => _showFilterDialog(),
                    ),
                  ],
                ),
              );
            },
          ),
          const SizedBox(height: 8),

          // Student List
          Expanded(
            child: Consumer<StudentProvider>(
              builder: (context, provider, _) {
                if (provider.isLoading) {
                  return const Center(child: CircularProgressIndicator());
                }

                if (provider.students.isEmpty) {
                  return Center(
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Icon(Icons.people_outline, size: 64, color: Colors.grey[400]),
                        const SizedBox(height: 16),
                        Text(
                          'No students found',
                          style: TextStyle(color: Colors.grey[600], fontSize: 16),
                        ),
                        const SizedBox(height: 8),
                        FilledButton.icon(
                          onPressed: () => Navigator.pushNamed(context, '/students/add'),
                          icon: const Icon(Icons.add),
                          label: const Text('Add Student'),
                        ),
                      ],
                    ),
                  );
                }

                return RefreshIndicator(
                  onRefresh: _loadStudents,
                  child: ListView.builder(
                    padding: const EdgeInsets.symmetric(horizontal: 16),
                    itemCount: provider.students.length,
                    itemBuilder: (context, index) {
                      final student = provider.students[index];
                      return _StudentCard(student: student);
                    },
                  ),
                );
              },
            ),
          ),
        ],
      ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () => Navigator.pushNamed(context, '/students/add'),
        icon: const Icon(Icons.add),
        label: const Text('New Admission'),
      ),
    );
  }

  void _showFilterDialog() {
    showModalBottomSheet(
      context: context,
      builder: (context) {
        return Consumer<StudentProvider>(
          builder: (context, provider, _) {
            return Padding(
              padding: const EdgeInsets.all(24),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'Filter Students',
                    style: Theme.of(context).textTheme.titleLarge,
                  ),
                  const SizedBox(height: 24),
                  
                  Text('Class', style: Theme.of(context).textTheme.titleSmall),
                  const SizedBox(height: 8),
                  Wrap(
                    spacing: 8,
                    children: StudentProvider.classes.map((c) {
                      return ChoiceChip(
                        label: Text(c),
                        selected: provider.selectedClass == c,
                        onSelected: (_) {
                          provider.setClassFilter(c);
                        },
                      );
                    }).toList(),
                  ),
                  
                  const SizedBox(height: 16),
                  
                  Text('Section', style: Theme.of(context).textTheme.titleSmall),
                  const SizedBox(height: 8),
                  Wrap(
                    spacing: 8,
                    children: StudentProvider.sections.map((s) {
                      return ChoiceChip(
                        label: Text(s),
                        selected: provider.selectedSection == s,
                        onSelected: (_) {
                          provider.setSectionFilter(s);
                        },
                      );
                    }).toList(),
                  ),
                  
                  const SizedBox(height: 24),
                  
                  SizedBox(
                    width: double.infinity,
                    child: FilledButton(
                      onPressed: () {
                        Navigator.pop(context);
                        _loadStudents();
                      },
                      child: const Text('Apply Filter'),
                    ),
                  ),
                ],
              ),
            );
          },
        );
      },
    );
  }
}

class _StudentCard extends StatelessWidget {
  final Student student;

  const _StudentCard({required this.student});

  @override
  Widget build(BuildContext context) {
    return Card(
      margin: const EdgeInsets.only(bottom: 12),
      child: ListTile(
        contentPadding: const EdgeInsets.all(12),
        leading: CircleAvatar(
          backgroundColor: Theme.of(context).colorScheme.primaryContainer,
          child: Text(
            student.name[0].toUpperCase(),
            style: TextStyle(
              color: Theme.of(context).colorScheme.primary,
              fontWeight: FontWeight.bold,
            ),
          ),
        ),
        title: Text(
          student.name,
          style: const TextStyle(fontWeight: FontWeight.w600),
        ),
        subtitle: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('Class ${student.className} - ${student.section}'),
            Text(
              'Adm No: ${student.admissionNo}',
              style: TextStyle(color: Colors.grey[600], fontSize: 12),
            ),
          ],
        ),
        trailing: PopupMenuButton(
          itemBuilder: (context) => [
            const PopupMenuItem(
              value: 'view',
              child: Row(
                children: [
                  Icon(Icons.visibility),
                  SizedBox(width: 8),
                  Text('View'),
                ],
              ),
            ),
            const PopupMenuItem(
              value: 'id_card',
              child: Row(
                children: [
                  Icon(Icons.badge),
                  SizedBox(width: 8),
                  Text('ID Card'),
                ],
              ),
            ),
            const PopupMenuItem(
              value: 'fees',
              child: Row(
                children: [
                  Icon(Icons.payment),
                  SizedBox(width: 8),
                  Text('Collect Fee'),
                ],
              ),
            ),
          ],
          onSelected: (value) {
            switch (value) {
              case 'view':
                // Navigate to student detail
                break;
              case 'id_card':
                Navigator.pushNamed(
                  context, 
                  '/students/id-card',
                  arguments: student,
                );
                break;
              case 'fees':
                Navigator.pushNamed(
                  context, 
                  '/fees/collect',
                  arguments: student,
                );
                break;
            }
          },
        ),
      ),
    );
  }
}
