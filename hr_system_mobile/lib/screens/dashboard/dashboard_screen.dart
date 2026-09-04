import 'package:flutter/material.dart';
import '../../services/auth_service.dart';
import '../../services/user_service.dart';

class DashboardScreen extends StatefulWidget {
  const DashboardScreen({super.key});

  @override
  State<DashboardScreen> createState() => _DashboardScreenState();
}

class _DashboardScreenState extends State<DashboardScreen> {
  Map<String, dynamic>? user;
  bool loading = true;
  String? error;

  @override
  void initState() {
    super.initState();
    loadUser();
  }

  Future<void> loadUser() async {
    try {
      final data = await UserService.getCurrentUser();

      if (!mounted) return;

      setState(() {
        user = data;
        loading = false;
        error = null;
      });
    } catch (e) {
      if (!mounted) return;

      setState(() {
        error = e.toString().replaceFirst('Exception: ', '');
        loading = false;
      });
    }
  }

  Future<void> handleLogout() async {
    try {
      await AuthService.logout();
    } catch (_) {
      // Even if logout request fails, clear the local session
      // and return to the login screen.
    }

    if (!mounted) return;

    Navigator.pushNamedAndRemoveUntil(
      context,
      '/',
      (route) => false,
    );
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
          title: Row(
            children: [
              Image.asset(
                'assets/images/vmc-logo.png',
                height: 32,
                width: 32,
                errorBuilder: (context, error, stackTrace) {
                  return const SizedBox(
                    height: 32,
                    width: 32,
                    child: Text('V', style: TextStyle(fontWeight: FontWeight.bold)),
                  );
                },
              ),
              const SizedBox(width: 12),
              const Text('VMC'),
            ],
          ),
          actions: [
            IconButton(
              onPressed: handleLogout,
              icon: const Icon(Icons.logout),
            ),
          ],
        ),
        body: Center(
          child: Padding(
            padding: const EdgeInsets.all(24),
            child: Text(
              error!,
              textAlign: TextAlign.center,
              style: const TextStyle(
                color: Colors.red,
                fontSize: 16,
              ),
            ),
          ),
        ),
      );
    }

    final fullName = user?['fullName']?.toString() ?? 'User';
    final employeeCode = user?['employeeCode']?.toString() ?? '';
    final userType = user?['userType']?.toString() ?? 'Employee';
    final role = user?['role']?.toString() ?? 'EMPLOYEE';
    final permissions = user?['permissions'];
    final canViewApprovals =
        permissions is Map &&
        permissions['Approvals'] is Map &&
        permissions['Approvals']['view'] == true;

    return Scaffold(
      backgroundColor: Colors.grey.shade50,
      appBar: AppBar(
        title: Row(
          children: [
            Image.asset(
              'assets/images/vmc-logo.png',
              height: 32,
              width: 32,
              errorBuilder: (context, error, stackTrace) {
                return const SizedBox(
                  height: 32,
                  width: 32,
                  child: Text('V', style: TextStyle(fontWeight: FontWeight.bold)),
                );
              },
            ),
            const SizedBox(width: 12),
            const Text(
              'VMC',
              style: TextStyle(
                fontWeight: FontWeight.bold,
              ),
            ),
          ],
        ),
        actions: [
          IconButton(
            onPressed: () {},
            icon: const Icon(Icons.notifications_outlined),
          ),
          IconButton(
            onPressed: handleLogout,
            icon: const Icon(Icons.logout),
          ),
        ],
      ),
      body: RefreshIndicator(
        onRefresh: loadUser,
        child: SingleChildScrollView(
          physics: const AlwaysScrollableScrollPhysics(),
          padding: const EdgeInsets.all(20),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                'Welcome, $fullName',
                style: const TextStyle(
                  fontSize: 26,
                  fontWeight: FontWeight.bold,
                ),
              ),

              const SizedBox(height: 6),

              Text(
                '$userType${employeeCode.isNotEmpty ? ' • $employeeCode' : ''}',
                style: TextStyle(
                  color: Colors.grey.shade600,
                  fontSize: 15,
                ),
              ),

              const SizedBox(height: 24),

              Container(
                width: double.infinity,
                padding: const EdgeInsets.all(18),
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(14),
                  border: Border.all(
                    color: Colors.grey.shade200,
                  ),
                ),
                child: Row(
                  children: [
                    CircleAvatar(
                      radius: 28,
                      backgroundColor: Colors.green.shade100,
                      child: Text(
                        fullName.isNotEmpty
                            ? fullName.substring(0, 1).toUpperCase()
                            : 'U',
                        style: TextStyle(
                          color: Colors.green.shade700,
                          fontSize: 22,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                    ),

                    const SizedBox(width: 14),

                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            fullName,
                            style: const TextStyle(
                              fontSize: 17,
                              fontWeight: FontWeight.bold,
                            ),
                          ),

                          const SizedBox(height: 4),

                          Text(
                            role == 'ADMIN'
                                ? 'Administrator'
                                : userType,
                            style: TextStyle(
                              color: Colors.grey.shade600,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),

              const SizedBox(height: 28),

              const Text(
                'Quick Actions',
                style: TextStyle(
                  fontSize: 19,
                  fontWeight: FontWeight.bold,
                ),
              ),

              const SizedBox(height: 14),

              _ActionTile(
                icon: Icons.login,
                title: 'Mark Attendance',
                onTap: () {
                  Navigator.pushNamed(
                    context,
                    '/attendance',
                  );
                },
              ),

              _ActionTile(
                icon: Icons.event_note_outlined,
                title: 'Apply Leave',
                onTap: () {
                  Navigator.pushNamed(
                    context,
                    '/leave',
                  );
                },
              ),
               if (canViewApprovals)
                _ActionTile(
                  icon: Icons.approval,
                  title: 'Approvals',
                  onTap: () {
                    Navigator.pushNamed(context, '/approvals');
                  },
                ),

              _ActionTile(
                icon: Icons.person_outline,
                title: 'My Profile',
                onTap: () {
                  Navigator.pushNamed(
                    context,
                    '/profile',
                  );
                },
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _ActionTile extends StatelessWidget {
  final IconData icon;
  final String title;
  final VoidCallback onTap;

  const _ActionTile({
    required this.icon,
    required this.title,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(
          color: Colors.grey.shade200,
        ),
      ),
      child: ListTile(
        onTap: onTap,
        leading: Icon(
          icon,
          color: Colors.green.shade600,
        ),
        title: Text(
          title,
          style: const TextStyle(
            fontWeight: FontWeight.w600,
          ),
        ),
        trailing: const Icon(
          Icons.chevron_right,
          color: Colors.grey,
        ),
      ),
    );
  }
}