import 'package:flutter/material.dart';

import '../../services/auth_service.dart';
import '../../services/user_service.dart';

class ProfileScreen extends StatefulWidget {
  const ProfileScreen({super.key});

  @override
  State<ProfileScreen> createState() => _ProfileScreenState();
}

class _ProfileScreenState extends State<ProfileScreen> {
  Map<String, dynamic>? user;

  bool loading = true;
  bool loggingOut = false;

  String? error;

  @override
  void initState() {
    super.initState();
    loadProfile();
  }

  Future<void> loadProfile() async {
    setState(() {
      loading = true;
      error = null;
    });

    try {
      final data = await UserService.getCurrentUser();

      if (!mounted) return;

      setState(() {
        user = data;
        loading = false;
      });
    } catch (e) {
      if (!mounted) return;

      setState(() {
        error = e.toString().replaceFirst(
              'Exception: ',
              '',
            );
        loading = false;
      });
    }
  }

  Future<void> logout() async {
    setState(() {
      loggingOut = true;
    });

    try {
      await AuthService.logout();

      if (!mounted) return;

      Navigator.pushNamedAndRemoveUntil(
        context,
        '/',
        (route) => false,
      );
    } catch (e) {
      if (!mounted) return;

      setState(() {
        loggingOut = false;
      });

      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            e.toString().replaceFirst(
              'Exception: ',
              '',
            ),
          ),
        ),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    if (loading) {
      return const Scaffold(
        body: Center(
          child: CircularProgressIndicator(),
        ),
      );
    }

    if (error != null) {
      return Scaffold(
        appBar: AppBar(
          title: const Text('Profile'),
        ),
        body: RefreshIndicator(
          onRefresh: loadProfile,
          child: ListView(
            physics: const AlwaysScrollableScrollPhysics(),
            padding: const EdgeInsets.all(20),
            children: [
              const SizedBox(height: 100),
              const Icon(
                Icons.error_outline,
                size: 60,
                color: Colors.red,
              ),
              const SizedBox(height: 16),
              Text(
                error!,
                textAlign: TextAlign.center,
                style: const TextStyle(
                  color: Colors.red,
                  fontSize: 16,
                ),
              ),
              const SizedBox(height: 20),
              ElevatedButton(
                onPressed: loadProfile,
                child: const Text('Retry'),
              ),
            ],
          ),
        ),
      );
    }

    final fullName =
        user?['fullName']?.toString() ?? 'User';

    final email =
        user?['email']?.toString() ?? '';

    final employeeCode =
        user?['employeeCode']?.toString() ?? '';

    final userType =
        user?['userType']?.toString() ?? 'Employee';

    final role =
        user?['role']?.toString() ?? 'EMPLOYEE';

    final initial = fullName.isNotEmpty
        ? fullName.substring(0, 1).toUpperCase()
        : 'U';

    return Scaffold(
      appBar: AppBar(
        title: const Text('Profile'),
        actions: [
          IconButton(
            onPressed: loadProfile,
            icon: const Icon(Icons.refresh),
          ),
        ],
      ),
      body: RefreshIndicator(
        onRefresh: loadProfile,
        child: ListView(
          physics: const AlwaysScrollableScrollPhysics(),
          padding: const EdgeInsets.all(20),
          children: [
            const SizedBox(height: 10),

            CircleAvatar(
              radius: 48,
              backgroundColor: Colors.green.shade100,
              child: Text(
                initial,
                style: TextStyle(
                  color: Colors.green.shade700,
                  fontSize: 34,
                  fontWeight: FontWeight.bold,
                ),
              ),
            ),

            const SizedBox(height: 16),

            Center(
              child: Text(
                fullName,
                textAlign: TextAlign.center,
                style: const TextStyle(
                  fontSize: 25,
                  fontWeight: FontWeight.bold,
                ),
              ),
            ),

            const SizedBox(height: 6),

            Center(
              child: Text(
                email,
                textAlign: TextAlign.center,
                style: TextStyle(
                  color: Colors.grey.shade600,
                  fontSize: 15,
                ),
              ),
            ),

            const SizedBox(height: 28),

            _InfoTile(
              title: 'Email',
              value: email.isEmpty
                  ? 'Not available'
                  : email,
              icon: Icons.email_outlined,
            ),

            _InfoTile(
              title: 'Employee Code',
              value: employeeCode.isEmpty
                  ? 'Not available'
                  : employeeCode,
              icon: Icons.badge_outlined,
            ),

            _InfoTile(
              title: 'User Type',
              value: userType,
              icon: Icons.work_outline,
            ),

            _InfoTile(
              title: 'Role',
              value: role,
              icon: Icons.admin_panel_settings_outlined,
            ),

            const SizedBox(height: 20),

            SizedBox(
              height: 52,
              child: OutlinedButton.icon(
                onPressed: loggingOut ? null : logout,
                icon: loggingOut
                    ? const SizedBox(
                        width: 20,
                        height: 20,
                        child: CircularProgressIndicator(
                          strokeWidth: 2,
                        ),
                      )
                    : const Icon(Icons.logout),
                label: Text(
                  loggingOut
                      ? 'Signing Out...'
                      : 'Sign Out',
                  style: const TextStyle(
                    fontSize: 16,
                    fontWeight: FontWeight.bold,
                  ),
                ),
              ),
            ),

            const SizedBox(height: 30),
          ],
        ),
      ),
    );
  }
}

class _InfoTile extends StatelessWidget {
  final String title;
  final String value;
  final IconData icon;

  const _InfoTile({
    required this.title,
    required this.value,
    required this.icon,
  });

  @override
  Widget build(BuildContext context) {
    return Card(
      margin: const EdgeInsets.only(bottom: 12),
      child: ListTile(
        leading: Icon(icon),
        title: Text(title),
        subtitle: Text(
          value,
          style: const TextStyle(
            fontWeight: FontWeight.w600,
          ),
        ),
      ),
    );
  }
}