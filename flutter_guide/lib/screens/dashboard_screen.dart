import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../providers/school_provider.dart';

class DashboardScreen extends StatefulWidget {
  const DashboardScreen({super.key});

  @override
  State<DashboardScreen> createState() => _DashboardScreenState();
}

class _DashboardScreenState extends State<DashboardScreen> {
  Map<String, dynamic> _stats = {};
  bool _isLoading = true;

  @override
  void initState() {
    super.initState();
    _loadStats();
  }

  Future<void> _loadStats() async {
    final provider = context.read<SchoolProvider>();
    final stats = await provider.getDashboardStats();
    setState(() {
      _stats = stats;
      _isLoading = false;
    });
  }

  @override
  Widget build(BuildContext context) {
    final provider = context.watch<SchoolProvider>();
    final school = provider.currentSchool;

    return Scaffold(
      appBar: AppBar(
        title: Text(school?.name ?? 'Dashboard'),
        actions: [
          IconButton(
            icon: const Icon(Icons.settings),
            onPressed: () => Navigator.pushNamed(context, '/settings'),
          ),
          IconButton(
            icon: const Icon(Icons.logout),
            onPressed: () {
              provider.logout();
              Navigator.pushReplacementNamed(context, '/login');
            },
          ),
        ],
      ),
      drawer: _buildDrawer(context),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator())
          : RefreshIndicator(
              onRefresh: _loadStats,
              child: SingleChildScrollView(
                physics: const AlwaysScrollableScrollPhysics(),
                padding: const EdgeInsets.all(16),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    // Stats Cards
                    Row(
                      children: [
                        Expanded(
                          child: _StatCard(
                            title: 'Total Students',
                            value: '${_stats['total_students'] ?? 0}',
                            icon: Icons.people,
                            color: Colors.blue,
                          ),
                        ),
                        const SizedBox(width: 12),
                        Expanded(
                          child: _StatCard(
                            title: "Today's Collection",
                            value: '₹${_stats['today_collection'] ?? 0}',
                            icon: Icons.currency_rupee,
                            color: Colors.green,
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 12),
                    Row(
                      children: [
                        Expanded(
                          child: _StatCard(
                            title: 'Monthly Collection',
                            value: '₹${_stats['monthly_collection'] ?? 0}',
                            icon: Icons.account_balance_wallet,
                            color: Colors.orange,
                          ),
                        ),
                        const SizedBox(width: 12),
                        Expanded(
                          child: _StatCard(
                            title: 'Defaulters',
                            value: '0',
                            icon: Icons.warning,
                            color: Colors.red,
                            onTap: () => Navigator.pushNamed(context, '/fees/defaulters'),
                          ),
                        ),
                      ],
                    ),
                    
                    const SizedBox(height: 24),
                    
                    // Quick Actions
                    Text(
                      'Quick Actions',
                      style: Theme.of(context).textTheme.titleLarge?.copyWith(
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                    const SizedBox(height: 12),
                    
                    Wrap(
                      spacing: 12,
                      runSpacing: 12,
                      children: [
                        _QuickActionButton(
                          icon: Icons.person_add,
                          label: 'New Admission',
                          color: Colors.blue,
                          onTap: () => Navigator.pushNamed(context, '/students/add'),
                        ),
                        _QuickActionButton(
                          icon: Icons.payment,
                          label: 'Collect Fees',
                          color: Colors.green,
                          onTap: () => Navigator.pushNamed(context, '/fees/collect'),
                        ),
                        _QuickActionButton(
                          icon: Icons.badge,
                          label: 'ID Cards',
                          color: Colors.purple,
                          onTap: () => Navigator.pushNamed(context, '/students/id-card'),
                        ),
                        _QuickActionButton(
                          icon: Icons.list_alt,
                          label: 'Defaulters',
                          color: Colors.red,
                          onTap: () => Navigator.pushNamed(context, '/fees/defaulters'),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
            ),
    );
  }

  Widget _buildDrawer(BuildContext context) {
    final provider = context.watch<SchoolProvider>();
    final school = provider.currentSchool;
    
    return Drawer(
      child: ListView(
        padding: EdgeInsets.zero,
        children: [
          DrawerHeader(
            decoration: BoxDecoration(
              color: Theme.of(context).colorScheme.primary,
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisAlignment: MainAxisAlignment.end,
              children: [
                const CircleAvatar(
                  radius: 30,
                  backgroundColor: Colors.white,
                  child: Icon(Icons.school, size: 32),
                ),
                const SizedBox(height: 12),
                Text(
                  school?.name ?? 'School Name',
                  style: const TextStyle(
                    color: Colors.white,
                    fontSize: 18,
                    fontWeight: FontWeight.bold,
                  ),
                ),
                Text(
                  school?.address ?? '',
                  style: TextStyle(
                    color: Colors.white.withOpacity(0.8),
                    fontSize: 12,
                  ),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
              ],
            ),
          ),
          ListTile(
            leading: const Icon(Icons.dashboard),
            title: const Text('Dashboard'),
            selected: true,
            onTap: () => Navigator.pop(context),
          ),
          ListTile(
            leading: const Icon(Icons.people),
            title: const Text('Students'),
            onTap: () {
              Navigator.pop(context);
              Navigator.pushNamed(context, '/students');
            },
          ),
          ListTile(
            leading: const Icon(Icons.payment),
            title: const Text('Fee Collection'),
            onTap: () {
              Navigator.pop(context);
              Navigator.pushNamed(context, '/fees/collect');
            },
          ),
          ListTile(
            leading: const Icon(Icons.warning_amber),
            title: const Text('Defaulters'),
            onTap: () {
              Navigator.pop(context);
              Navigator.pushNamed(context, '/fees/defaulters');
            },
          ),
          ListTile(
            leading: const Icon(Icons.group),
            title: const Text('Staff'),
            onTap: () {
              Navigator.pop(context);
              Navigator.pushNamed(context, '/staff');
            },
          ),
          const Divider(),
          ListTile(
            leading: const Icon(Icons.settings),
            title: const Text('Settings'),
            onTap: () {
              Navigator.pop(context);
              Navigator.pushNamed(context, '/settings');
            },
          ),
          ListTile(
            leading: const Icon(Icons.logout),
            title: const Text('Logout'),
            onTap: () {
              provider.logout();
              Navigator.pushReplacementNamed(context, '/login');
            },
          ),
        ],
      ),
    );
  }
}

class _StatCard extends StatelessWidget {
  final String title;
  final String value;
  final IconData icon;
  final Color color;
  final VoidCallback? onTap;

  const _StatCard({
    required this.title,
    required this.value,
    required this.icon,
    required this.color,
    this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return Card(
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(12),
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Container(
                padding: const EdgeInsets.all(8),
                decoration: BoxDecoration(
                  color: color.withOpacity(0.1),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Icon(icon, color: color, size: 24),
              ),
              const SizedBox(height: 12),
              Text(
                value,
                style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                  fontWeight: FontWeight.bold,
                ),
              ),
              Text(
                title,
                style: Theme.of(context).textTheme.bodySmall?.copyWith(
                  color: Colors.grey[600],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _QuickActionButton extends StatelessWidget {
  final IconData icon;
  final String label;
  final Color color;
  final VoidCallback onTap;

  const _QuickActionButton({
    required this.icon,
    required this.label,
    required this.color,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(12),
      child: Container(
        width: 100,
        padding: const EdgeInsets.symmetric(vertical: 16, horizontal: 12),
        decoration: BoxDecoration(
          color: color.withOpacity(0.1),
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: color.withOpacity(0.3)),
        ),
        child: Column(
          children: [
            Icon(icon, color: color, size: 28),
            const SizedBox(height: 8),
            Text(
              label,
              style: TextStyle(
                color: color,
                fontWeight: FontWeight.w500,
                fontSize: 12,
              ),
              textAlign: TextAlign.center,
            ),
          ],
        ),
      ),
    );
  }
}
