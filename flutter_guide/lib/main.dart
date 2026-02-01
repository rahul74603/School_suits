import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:google_fonts/google_fonts.dart';

import 'providers/school_provider.dart';
import 'providers/student_provider.dart';
import 'providers/fee_provider.dart';
import 'providers/staff_provider.dart';
import 'screens/splash_screen.dart';
import 'screens/login_screen.dart';
import 'screens/dashboard_screen.dart';
import 'screens/students/student_list_screen.dart';
import 'screens/students/add_student_screen.dart';
import 'screens/students/id_card_screen.dart';
import 'screens/fees/fee_collection_screen.dart';
import 'screens/fees/defaulters_screen.dart';
import 'screens/staff/staff_list_screen.dart';
import 'screens/settings/school_settings_screen.dart';
import 'database/database_helper.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  
  // Initialize database
  await DatabaseHelper.instance.database;
  
  runApp(const SchoolManagementApp());
}

class SchoolManagementApp extends StatelessWidget {
  const SchoolManagementApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MultiProvider(
      providers: [
        ChangeNotifierProvider(create: (_) => SchoolProvider()),
        ChangeNotifierProvider(create: (_) => StudentProvider()),
        ChangeNotifierProvider(create: (_) => FeeProvider()),
        ChangeNotifierProvider(create: (_) => StaffProvider()),
      ],
      child: MaterialApp(
        title: 'School Management',
        debugShowCheckedModeBanner: false,
        theme: ThemeData(
          colorScheme: ColorScheme.fromSeed(
            seedColor: const Color(0xFF1E88E5),
            brightness: Brightness.light,
          ),
          textTheme: GoogleFonts.poppinsTextTheme(),
          useMaterial3: true,
          appBarTheme: const AppBarTheme(
            centerTitle: true,
            elevation: 0,
          ),
          cardTheme: CardTheme(
            elevation: 2,
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(12),
            ),
          ),
          inputDecorationTheme: InputDecorationTheme(
            border: OutlineInputBorder(
              borderRadius: BorderRadius.circular(8),
            ),
            filled: true,
            fillColor: Colors.grey.shade50,
          ),
        ),
        initialRoute: '/',
        routes: {
          '/': (context) => const SplashScreen(),
          '/login': (context) => const LoginScreen(),
          '/dashboard': (context) => const DashboardScreen(),
          '/students': (context) => const StudentListScreen(),
          '/students/add': (context) => const AddStudentScreen(),
          '/students/id-card': (context) => const IdCardScreen(),
          '/fees/collect': (context) => const FeeCollectionScreen(),
          '/fees/defaulters': (context) => const DefaultersScreen(),
          '/staff': (context) => const StaffListScreen(),
          '/settings': (context) => const SchoolSettingsScreen(),
        },
      ),
    );
  }
}
