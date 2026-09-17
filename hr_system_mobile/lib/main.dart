import 'package:flutter/material.dart';

import 'services/auth_service.dart';

import 'screens/auth/login_screen.dart';
import 'screens/dashboard/dashboard_screen.dart';
import 'screens/attendance/attendance_screen.dart';
import 'screens/leave/leave_screen.dart';
import 'screens/profile/profile_screen.dart';
import 'screens/approvals/approvals_screen.dart';
import 'screens/audit/audit_log_screen.dart';
import 'screens/calendar/calendar_screen.dart';

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
        colorScheme: ColorScheme.fromSeed(seedColor: Colors.green),
        useMaterial3: true,
      ),

      home: const SessionCheckScreen(),

      routes: {
        '/dashboard': (context) => const DashboardScreen(),
        '/attendance': (context) => const AttendanceScreen(),
        '/calendar': (context) => const CalendarScreen(),
        '/leave': (context) =>
            const LeaveScreen(openAttendanceCorrection: true),
        '/profile': (context) => const ProfileScreen(),
        '/approvals': (context) => const ApprovalsScreen(),
        '/audit': (context) => const AuditLogScreen(),
      },
    );
  }
}

class SessionCheckScreen extends StatefulWidget {
  const SessionCheckScreen({super.key});

  @override
  State<SessionCheckScreen> createState() => _SessionCheckScreenState();
}

class _SessionCheckScreenState extends State<SessionCheckScreen> {
  @override
  void initState() {
    super.initState();
    _checkSession();
  }

  Future<void> _checkSession() async {
    final isLoggedIn = await AuthService.restoreSession();

    if (!mounted) return;

    if (isLoggedIn) {
      Navigator.of(context).pushReplacementNamed('/dashboard');
    } else {
      Navigator.of(
        context,
      ).pushReplacement(MaterialPageRoute(builder: (_) => const LoginScreen()));
    }
  }

  @override
  Widget build(BuildContext context) {
    return const Scaffold(body: Center(child: CircularProgressIndicator()));
  }
}
