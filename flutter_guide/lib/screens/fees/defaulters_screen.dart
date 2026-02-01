import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:share_plus/share_plus.dart';
import '../../providers/fee_provider.dart';
import '../../providers/school_provider.dart';

class DefaultersScreen extends StatefulWidget {
  const DefaultersScreen({super.key});

  @override
  State<DefaultersScreen> createState() => _DefaultersScreenState();
}

class _DefaultersScreenState extends State<DefaultersScreen> {
  String _selectedMonth = FeeProvider.months[DateTime.now().month - 1];
  String _selectedClass = 'All';

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      _loadDefaulters();
    });
  }

  Future<void> _loadDefaulters() async {
    await context.read<FeeProvider>().loadDefaulters(
      _selectedMonth,
      DateTime.now().year,
      classFilter: _selectedClass == 'All' ? null : _selectedClass,
    );
  }

  void _shareDefaultersList() {
    final provider = context.read<FeeProvider>();
    final school = context.read<SchoolProvider>().currentSchool;
    
    if (provider.defaulters.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('No defaulters to share')),
      );
      return;
    }

    final buffer = StringBuffer();
    buffer.writeln('*${school?.name ?? "School"}*');
    buffer.writeln('Fee Defaulters - $_selectedMonth ${DateTime.now().year}');
    buffer.writeln('');
    
    int totalPending = 0;
    for (var d in provider.defaulters) {
      buffer.writeln('${d['name']} (Class ${d['class']}) - ₹${d['monthly_fee']}');
      totalPending += (d['monthly_fee'] as int?) ?? 0;
    }
    
    buffer.writeln('');
    buffer.writeln('Total Pending: ₹$totalPending');
    buffer.writeln('Total Students: ${provider.defaulters.length}');
    
    Share.share(buffer.toString());
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Fee Defaulters'),
        actions: [
          IconButton(
            icon: const Icon(Icons.share),
            onPressed: _shareDefaultersList,
            tooltip: 'Share on WhatsApp',
          ),
        ],
      ),
      body: Column(
        children: [
          // Filters
          Padding(
            padding: const EdgeInsets.all(16),
            child: Row(
              children: [
                Expanded(
                  child: DropdownButtonFormField<String>(
                    value: _selectedMonth,
                    decoration: const InputDecoration(
                      labelText: 'Month',
                      contentPadding: EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                    ),
                    items: FeeProvider.months
                        .map((m) => DropdownMenuItem(value: m, child: Text(m)))
                        .toList(),
                    onChanged: (v) {
                      setState(() => _selectedMonth = v!);
                      _loadDefaulters();
                    },
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: DropdownButtonFormField<String>(
                    value: _selectedClass,
                    decoration: const InputDecoration(
                      labelText: 'Class',
                      contentPadding: EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                    ),
                    items: ['All', 'LKG', 'UKG', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12']
                        .map((c) => DropdownMenuItem(value: c, child: Text(c)))
                        .toList(),
                    onChanged: (v) {
                      setState(() => _selectedClass = v!);
                      _loadDefaulters();
                    },
                  ),
                ),
              ],
            ),
          ),

          // Summary Card
          Consumer<FeeProvider>(
            builder: (context, provider, _) {
              int totalPending = 0;
              for (var d in provider.defaulters) {
                totalPending += (d['monthly_fee'] as int?) ?? 0;
              }
              
              return Card(
                margin: const EdgeInsets.symmetric(horizontal: 16),
                color: Colors.red.shade50,
                child: Padding(
                  padding: const EdgeInsets.all(16),
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.spaceAround,
                    children: [
                      Column(
                        children: [
                          Text(
                            '${provider.defaulters.length}',
                            style: const TextStyle(
                              fontSize: 24,
                              fontWeight: FontWeight.bold,
                              color: Colors.red,
                            ),
                          ),
                          const Text('Total Defaulters'),
                        ],
                      ),
                      Column(
                        children: [
                          Text(
                            '₹$totalPending',
                            style: const TextStyle(
                              fontSize: 24,
                              fontWeight: FontWeight.bold,
                              color: Colors.red,
                            ),
                          ),
                          const Text('Pending Amount'),
                        ],
                      ),
                    ],
                  ),
                ),
              );
            },
          ),
          const SizedBox(height: 8),

          // Defaulters List
          Expanded(
            child: Consumer<FeeProvider>(
              builder: (context, provider, _) {
                if (provider.isLoading) {
                  return const Center(child: CircularProgressIndicator());
                }

                if (provider.defaulters.isEmpty) {
                  return Center(
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Icon(Icons.check_circle, size: 64, color: Colors.green[300]),
                        const SizedBox(height: 16),
                        const Text(
                          'No defaulters found!',
                          style: TextStyle(fontSize: 16, color: Colors.green),
                        ),
                        const Text('All fees collected for this month'),
                      ],
                    ),
                  );
                }

                return ListView.builder(
                  padding: const EdgeInsets.all(16),
                  itemCount: provider.defaulters.length,
                  itemBuilder: (context, index) {
                    final defaulter = provider.defaulters[index];
                    return Card(
                      margin: const EdgeInsets.only(bottom: 8),
                      child: ListTile(
                        leading: CircleAvatar(
                          backgroundColor: Colors.red.shade100,
                          child: Text(
                            (defaulter['name'] as String)[0],
                            style: const TextStyle(color: Colors.red),
                          ),
                        ),
                        title: Text(defaulter['name'] as String),
                        subtitle: Text(
                          'Class ${defaulter['class']} - ${defaulter['section']}\n${defaulter['contact']}',
                        ),
                        trailing: Column(
                          mainAxisAlignment: MainAxisAlignment.center,
                          crossAxisAlignment: CrossAxisAlignment.end,
                          children: [
                            Text(
                              '₹${defaulter['monthly_fee']}',
                              style: const TextStyle(
                                fontWeight: FontWeight.bold,
                                color: Colors.red,
                                fontSize: 16,
                              ),
                            ),
                            const Text('Pending', style: TextStyle(fontSize: 12)),
                          ],
                        ),
                        onTap: () {
                          // Could navigate to fee collection with this student
                        },
                      ),
                    );
                  },
                );
              },
            ),
          ),
        ],
      ),
    );
  }
}
