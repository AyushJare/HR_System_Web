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

  static const Color _brandGreen = Color(0xFF16A34A);
  static const Color _pageBg = Color(0xFFF4F6FB);

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

  Widget _buildLogo() {
    return Image.asset(
      'assets/images/vmc-logo.png',
      height: 32,
      width: 32,
      errorBuilder: (context, error, stackTrace) {
        return Container(
          height: 32,
          width: 32,
          alignment: Alignment.center,
          decoration: BoxDecoration(
            color: _brandGreen.withOpacity(0.1),
            borderRadius: BorderRadius.circular(8),
          ),
          child: Text(
            'V',
            style: TextStyle(
              fontWeight: FontWeight.bold,
              color: _brandGreen,
            ),
          ),
        );
      },
    );
  }

  PreferredSizeWidget _buildAppBar({List<Widget>? actions}) {
    return AppBar(
      backgroundColor: Colors.white,
      surfaceTintColor: Colors.white,
      elevation: 0,
      scrolledUnderElevation: 1,
      shadowColor: Colors.black12,
      titleSpacing: 20,
      title: Row(
        children: [
          _buildLogo(),
          const SizedBox(width: 12),
          const Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(
                'VMC',
                style: TextStyle(
                  fontWeight: FontWeight.bold,
                  fontSize: 16,
                  color: Colors.black87,
                ),
              ),
              Text(
                'Human Resources',
                style: TextStyle(
                  fontSize: 11,
                  fontWeight: FontWeight.w500,
                  color: Colors.black45,
                ),
              ),
            ],
          ),
        ],
      ),
      actions: actions,
    );
  }

  String _formattedToday() {
    const weekdays = [
      'Monday',
      'Tuesday',
      'Wednesday',
      'Thursday',
      'Friday',
      'Saturday',
      'Sunday',
    ];
    const months = [
      'January',
      'February',
      'March',
      'April',
      'May',
      'June',
      'July',
      'August',
      'September',
      'October',
      'November',
      'December',
    ];

    final now = DateTime.now();
    final weekday = weekdays[now.weekday - 1];
    final month = months[now.month - 1];

    return '$weekday, $month ${now.day}, ${now.year}';
  }

  @override
  Widget build(BuildContext context) {
    if (loading) {
      return Scaffold(
        backgroundColor: _pageBg,
        body: const Center(
          child: CircularProgressIndicator(
            color: _brandGreen,
          ),
        ),
      );
    }

    if (error != null) {
      return Scaffold(
        backgroundColor: _pageBg,
        appBar: _buildAppBar(
          actions: [
            IconButton(
              onPressed: handleLogout,
              icon: const Icon(Icons.logout, color: Colors.black54),
            ),
          ],
        ),
        body: Center(
          child: Padding(
            padding: const EdgeInsets.all(24),
            child: Container(
              padding: const EdgeInsets.all(20),
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(16),
                border: Border.all(color: Colors.red.shade100),
              ),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Icon(Icons.error_outline, color: Colors.red.shade400, size: 32),
                  const SizedBox(height: 12),
                  Text(
                    error!,
                    textAlign: TextAlign.center,
                    style: TextStyle(
                      color: Colors.red.shade600,
                      fontSize: 15,
                      fontWeight: FontWeight.w500,
                    ),
                  ),
                ],
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
      backgroundColor: _pageBg,
      appBar: _buildAppBar(
        actions: [
          IconButton(
            onPressed: () {},
            icon: const Icon(Icons.notifications_outlined, color: Colors.black54),
          ),
          IconButton(
            onPressed: handleLogout,
            icon: const Icon(Icons.logout, color: Colors.black54),
          ),
          const SizedBox(width: 4),
        ],
      ),
      body: RefreshIndicator(
        color: _brandGreen,
        onRefresh: loadUser,
        child: SingleChildScrollView(
          physics: const AlwaysScrollableScrollPhysics(),
          padding: const EdgeInsets.fromLTRB(20, 20, 20, 32),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Eyebrow label, like the web dashboard's "DAILY SUMMARY"
              Text(
                'DAILY SUMMARY',
                style: TextStyle(
                  fontSize: 12,
                  fontWeight: FontWeight.bold,
                  letterSpacing: 1.2,
                  color: _brandGreen,
                ),
              ),

              const SizedBox(height: 6),

              Text(
                'Welcome, $fullName',
                style: const TextStyle(
                  fontSize: 26,
                  fontWeight: FontWeight.bold,
                  color: Colors.black87,
                  height: 1.15,
                ),
              ),

              const SizedBox(height: 6),

              Text(
                _formattedToday(),
                style: TextStyle(
                  color: Colors.grey.shade600,
                  fontSize: 14,
                ),
              ),

              const SizedBox(height: 20),

              // Profile summary card, restyled with a brand gradient
              Container(
                width: double.infinity,
                padding: const EdgeInsets.all(20),
                decoration: BoxDecoration(
                  gradient: const LinearGradient(
                    begin: Alignment.topLeft,
                    end: Alignment.bottomRight,
                    colors: [Color(0xFF16A34A), Color(0xFF0D9488)],
                  ),
                  borderRadius: BorderRadius.circular(20),
                  boxShadow: [
                    BoxShadow(
                      color: _brandGreen.withOpacity(0.25),
                      blurRadius: 16,
                      offset: const Offset(0, 8),
                    ),
                  ],
                ),
                child: Row(
                  children: [
                    Container(
                      width: 56,
                      height: 56,
                      decoration: BoxDecoration(
                        color: Colors.white.withOpacity(0.18),
                        shape: BoxShape.circle,
                        border: Border.all(
                          color: Colors.white.withOpacity(0.4),
                          width: 1.5,
                        ),
                      ),
                      alignment: Alignment.center,
                      child: Text(
                        fullName.isNotEmpty
                            ? fullName.substring(0, 1).toUpperCase()
                            : 'U',
                        style: const TextStyle(
                          color: Colors.white,
                          fontSize: 22,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                    ),

                    const SizedBox(width: 16),

                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            fullName,
                            style: const TextStyle(
                              fontSize: 17,
                              fontWeight: FontWeight.bold,
                              color: Colors.white,
                            ),
                          ),
                          const SizedBox(height: 4),
                          Text(
                            role == 'ADMIN' ? 'Administrator' : userType,
                            style: TextStyle(
                              color: Colors.white.withOpacity(0.85),
                              fontSize: 13,
                            ),
                          ),
                          if (employeeCode.isNotEmpty) ...[
                            const SizedBox(height: 6),
                            Container(
                              padding: const EdgeInsets.symmetric(
                                horizontal: 10,
                                vertical: 4,
                              ),
                              decoration: BoxDecoration(
                                color: Colors.white.withOpacity(0.16),
                                borderRadius: BorderRadius.circular(20),
                              ),
                              child: Text(
                                employeeCode,
                                style: const TextStyle(
                                  color: Colors.white,
                                  fontSize: 11,
                                  fontWeight: FontWeight.w600,
                                  letterSpacing: 0.4,
                                ),
                              ),
                            ),
                          ],
                        ],
                      ),
                    ),
                  ],
                ),
              ),

              const SizedBox(height: 28),

              Row(
                children: [
                  Container(
                    width: 4,
                    height: 18,
                    decoration: BoxDecoration(
                      color: _brandGreen,
                      borderRadius: BorderRadius.circular(2),
                    ),
                  ),
                  const SizedBox(width: 8),
                  const Text(
                    'QUICK ACTIONS',
                    style: TextStyle(
                      fontSize: 13,
                      fontWeight: FontWeight.bold,
                      letterSpacing: 0.8,
                      color: Colors.black87,
                    ),
                  ),
                ],
              ),

              const SizedBox(height: 14),

              // Quick action rows: compact, color-coded options
              // (not big tiles) matching the web app's accent colors.
              _ActionCard(
                icon: Icons.login,
                title: 'Mark Attendance',
                accentColor: const Color(0xFF16A34A),
                backgroundColor: const Color(0xFFE9F9EF),
                onTap: () {
                  Navigator.pushNamed(context, '/attendance');
                },
              ),
              const SizedBox(height: 12),
              _ActionCard(
                icon: Icons.event_note_outlined,
                title: 'Apply Leave',
                accentColor: const Color(0xFF2563EB),
                backgroundColor: const Color(0xFFEAF1FE),
                onTap: () {
                  Navigator.pushNamed(context, '/leave');
                },
              ),
              if (canViewApprovals) ...[
                const SizedBox(height: 12),
                _ActionCard(
                  icon: Icons.approval,
                  title: 'Approvals',
                  accentColor: const Color(0xFFEA580C),
                  backgroundColor: const Color(0xFFFDF0E7),
                  onTap: () {
                    Navigator.pushNamed(context, '/approvals');
                  },
                ),
              ],
              const SizedBox(height: 12),
              _ActionCard(
                icon: Icons.person_outline,
                title: 'My Profile',
                accentColor: const Color(0xFF9333EA),
                backgroundColor: const Color(0xFFF3E9FD),
                onTap: () {
                  Navigator.pushNamed(context, '/profile');
                },
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _ActionCard extends StatelessWidget {
  final IconData icon;
  final String title;
  final Color accentColor;
  final Color backgroundColor;
  final VoidCallback onTap;

  const _ActionCard({
    required this.icon,
    required this.title,
    required this.accentColor,
    required this.backgroundColor,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.transparent,
      child: InkWell(
        borderRadius: BorderRadius.circular(16),
        onTap: onTap,
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 14),
          decoration: BoxDecoration(
            color: backgroundColor,
            borderRadius: BorderRadius.circular(16),
            border: Border.all(
              color: accentColor.withOpacity(0.12),
            ),
          ),
          child: Row(
            children: [
              Container(
                width: 40,
                height: 40,
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(11),
                  boxShadow: [
                    BoxShadow(
                      color: accentColor.withOpacity(0.15),
                      blurRadius: 6,
                      offset: const Offset(0, 3),
                    ),
                  ],
                ),
                alignment: Alignment.center,
                child: Icon(icon, color: accentColor, size: 20),
              ),
              const SizedBox(width: 14),
              Expanded(
                child: Text(
                  title,
                  style: const TextStyle(
                    fontWeight: FontWeight.bold,
                    fontSize: 14.5,
                    color: Colors.black87,
                  ),
                ),
              ),
              Icon(Icons.chevron_right, color: accentColor, size: 22),
            ],
          ),
        ),
      ),
    );
  }
}