import 'package:flutter/material.dart';

import 'screens/auth/login_screen.dart';
import 'screens/dashboard/dashboard_screen.dart';
import 'screens/attendance/attendance_screen.dart';
import 'screens/leave/leave_screen.dart';
import 'screens/profile/profile_screen.dart';
import 'screens/approvals/approvals_screen.dart';
import 'screens/audit/audit_log_screen.dart';

void main() {
  runApp(const HRSystemApp());
}

class HRSystemApp extends StatelessWidget {
  const HRSystemApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      debugShowCheckedModeBanner: false,
      title: 'VMC - HR System',

      theme: ThemeData(
        colorScheme: ColorScheme.fromSeed(
          seedColor: Colors.green,
        ),
        useMaterial3: true,
      ),

      home: const LoginScreen(),

      routes: {
        '/dashboard': (context) => const DashboardScreen(),
        '/attendance': (context) => const AttendanceScreen(),
        '/leave': (context) => const LeaveScreen(),
        '/profile': (context) => const ProfileScreen(),
        '/approvals': (context) => const ApprovalsScreen(),
        '/audit': (context) => const AuditLogScreen(),
      },
    );
  }
}