import 'package:flutter/material.dart';
import 'package:geolocator/geolocator.dart';
import 'package:intl/intl.dart';
import '../../services/attendance_service.dart';
import '../../services/auth_service.dart';
import '../../models/user.dart';

class AttendanceScreen extends StatefulWidget {
  const AttendanceScreen({super.key});

  @override
  State<AttendanceScreen> createState() => _AttendanceScreenState();
}

class _AttendanceScreenState extends State<AttendanceScreen> {
  Map<String, dynamic>? summary;
  bool loading = true;
  bool actionLoading = false;
  String? error;
  bool _isCheckedIn = false;
  bool _isCheckedOut = false;
  DateTime? _checkInTime;
  DateTime? _checkOutTime;

  static const Color _brandGreen = Color(0xFF16A34A);
  static const Color _pageBg = Color(0xFFF4F6FB);

  @override
  void initState() {
    super.initState();
    _initScreen();
  }

  Future<void> _initScreen() async {
    await loadAttendance();
  }

  Future<void> loadAttendance() async {
    setState(() {
      loading = true;
      error = null;
    });

    try {
      final now = DateTime.now();
      final month =
          '${now.year.toString().padLeft(4, '0')}-'
          '${now.month.toString().padLeft(2, '0')}';

      final data = await AttendanceService.getAttendanceSummary(month);
      print('FULL ATTENDANCE SUMMARY: $data');
      final todayData = data['todayAttendance'] is Map
          ? Map<String, dynamic>.from(data['todayAttendance'])
          : null;

      if (!mounted) return;

      // Extract today's attendance
      final checkInTime = todayData?['timeIn'] != null
          ? DateTime.parse(todayData!['timeIn'].toString())
          : null;

      final checkOutTime = todayData?['timeOut'] != null
          ? DateTime.parse(todayData!['timeOut'].toString())
          : null;

      setState(() {
        summary = data;
        _checkInTime = checkInTime;
        _checkOutTime = checkOutTime;
        _isCheckedIn = checkInTime != null;
        _isCheckedOut = checkOutTime != null;
        loading = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        error = e.toString().replaceFirst('Exception: ', '');
        loading = false;
      });
    }
  }

  Map<String, dynamic>? _getTodayAttendance(Map<String, dynamic> data) {
    final daily = data['dailyAttendance'];
    if (daily is! List) return null;

    final now = DateTime.now();
    for (final item in daily) {
      if (item is! Map) continue;
      final dateString = item['date']?.toString();
      if (dateString == null) continue;

      final date = DateTime.tryParse(dateString);
      if (date == null) continue;

      if (date.year == now.year &&
          date.month == now.month &&
          date.day == now.day) {
        return Map<String, dynamic>.from(item);
      }
    }
    return null;
  }

  Future<Position> _getLocation() async {
    final serviceEnabled = await Geolocator.isLocationServiceEnabled();
    if (!serviceEnabled) {
      throw Exception('Please turn on location services.');
    }

    LocationPermission permission = await Geolocator.checkPermission();
    if (permission == LocationPermission.denied) {
      permission = await Geolocator.requestPermission();
    }

    if (permission == LocationPermission.denied) {
      throw Exception('Location permission was denied.');
    }

    if (permission == LocationPermission.deniedForever) {
      throw Exception(
        'Location permission is permanently denied. '
        'Please enable it from device settings.',
      );
    }

    return Geolocator.getCurrentPosition(
      locationSettings: const LocationSettings(
        accuracy: LocationAccuracy.high,
      ),
    );
  }

  Future<void> handleCheckIn() async {
    if (actionLoading) return;

    setState(() {
      actionLoading = true;
      error = null;
    });

    try {
      final position = await _getLocation();

      final result = await AttendanceService.checkInWithLocation({
        'latitude': position.latitude,
        'longitude': position.longitude,
        'accuracy': position.accuracy,
      });

      if (!mounted) return;

      if (result['success']) {
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(
              content: Text('✓ Checked in successfully!'),
              backgroundColor: Colors.green,
            ),
          );
        }
        await loadAttendance();
      } else {
        setState(() {
          error = result['message'] ?? 'Check-in failed';
        });
        _showError(error!);
      }
    } catch (e) {
      if (!mounted) return;
      setState(() {
        error = e.toString().replaceFirst('Exception: ', '');
      });
      _showError(error!);
    } finally {
      if (mounted) {
        setState(() {
          actionLoading = false;
        });
      }
    }
  }

  Future<void> handleCheckOut() async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(16),
        ),
        title: const Text('Confirm Check Out'),
        content: const Text('Are you sure you want to check out?'),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: const Text('Cancel'),
          ),
          ElevatedButton(
            style: ElevatedButton.styleFrom(
              backgroundColor: _brandGreen,
              foregroundColor: Colors.white,
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(10),
              ),
            ),
            onPressed: () => Navigator.pop(context, true),
            child: const Text('Confirm'),
          ),
        ],
      ),
    );

    if (confirmed != true) return;

    if (actionLoading) return;

    setState(() {
      actionLoading = true;
      error = null;
    });

    try {
      final result = await AttendanceService.checkOut();

      if (!mounted) return;

      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('✓ Checked out successfully!'),
          backgroundColor: Colors.green,
        ),
      );

      await loadAttendance();
    } catch (e) {
      if (!mounted) return;
      setState(() {
        error = e.toString().replaceFirst('Exception: ', '');
      });
      _showError(error!);
    } finally {
      if (mounted) {
        setState(() {
          actionLoading = false;
        });
      }
    }
  }

  void _showError(String message) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(message),
        backgroundColor: Colors.red,
      ),
    );
  }

  String _formatTime(DateTime? dateTime) {
    if (dateTime == null) return '--:--';
    return DateFormat('hh:mm a').format(dateTime);
  }

  String _calculateWorkedTime() {
    if (_checkInTime == null || _checkOutTime == null) {
      if (_checkInTime != null) {
        final duration = DateTime.now().difference(_checkInTime!);
        final hours = duration.inHours;
        final minutes = duration.inMinutes % 60;
        return '$hours h $minutes m';
      }
      return '--:--';
    }

    final duration = _checkOutTime!.difference(_checkInTime!);
    final hours = duration.inHours;
    final minutes = duration.inMinutes % 60;
    return '$hours h $minutes m';
  }

  Map<String, dynamic> get attendanceData {
    final data = summary?['attendance'];
    if (data is Map) {
      return Map<String, dynamic>.from(data);
    }
    return {};
  }

  Map<String, dynamic> get calculations {
    final data = summary?['calculations'];
    if (data is Map) {
      return Map<String, dynamic>.from(data);
    }
    return {};
  }

  Map<String, dynamic> get period {
    final data = summary?['period'];
    if (data is Map) {
      return Map<String, dynamic>.from(data);
    }
    return {};
  }

  Map<String, dynamic> get summaryData {
    final data = summary?['summary'];
    if (data is Map) {
      return Map<String, dynamic>.from(data);
    }
    return {};
  }

  String _value(Map<String, dynamic> data, String key) {
    return data[key]?.toString() ?? '0';
  }

  PreferredSizeWidget _buildAppBar() {
    return AppBar(
      backgroundColor: Colors.white,
      surfaceTintColor: Colors.white,
      elevation: 0,
      scrolledUnderElevation: 1,
      shadowColor: Colors.black12,
      title: const Text(
        'Attendance',
        style: TextStyle(
          fontWeight: FontWeight.bold,
          color: Colors.black87,
        ),
      ),
      actions: [
        IconButton(
          onPressed: loading ? null : loadAttendance,
          icon: const Icon(Icons.refresh, color: Colors.black54),
        ),
      ],
    );
  }

  Widget _sectionLabel(String text) {
    return Row(
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
        Text(
          text,
          style: const TextStyle(
            fontSize: 13,
            fontWeight: FontWeight.bold,
            letterSpacing: 0.8,
            color: Colors.black87,
          ),
        ),
      ],
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: _pageBg,
      appBar: _buildAppBar(),
      body: RefreshIndicator(
        color: _brandGreen,
        onRefresh: loadAttendance,
        child: _buildBody(),
      ),
    );
  }

  Widget _buildBody() {
    if (loading) {
      return ListView(
        physics: const AlwaysScrollableScrollPhysics(),
        children: const [
          SizedBox(
            height: 300,
            child: Center(
              child: CircularProgressIndicator(color: _brandGreen),
            ),
          ),
        ],
      );
    }

    if (error != null && summary == null) {
      return ListView(
        physics: const AlwaysScrollableScrollPhysics(),
        padding: const EdgeInsets.all(20),
        children: [
          const SizedBox(height: 80),
          _errorCard(error!),
          const SizedBox(height: 20),
          SizedBox(
            height: 48,
            child: ElevatedButton(
              style: ElevatedButton.styleFrom(
                backgroundColor: _brandGreen,
                foregroundColor: Colors.white,
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(12),
                ),
              ),
              onPressed: loadAttendance,
              child: const Text('Retry'),
            ),
          ),
        ],
      );
    }

    final present = _value(attendanceData, 'presentDays');
    final halfDays = _value(attendanceData, 'halfDays');
    final absent = _value(attendanceData, 'absentDays');
    final leave = _value(attendanceData, 'onLeaveDays');
    final weeklyOff = _value(attendanceData, 'weeklyOffDays');
    final holidays = _value(attendanceData, 'holidayDays');
    final workingDays = _value(calculations, 'totalWorkingDays');
    final percentage = _value(calculations, 'attendancePercentage');
    final status = summaryData['attendanceStatus']?.toString() ?? 'UNKNOWN';
    final monthName = period['monthName']?.toString() ?? 'This Month';

    return ListView(
      physics: const AlwaysScrollableScrollPhysics(),
      padding: const EdgeInsets.fromLTRB(20, 20, 20, 32),
      children: [
        Text(
          'ATTENDANCE',
          style: TextStyle(
            fontSize: 12,
            fontWeight: FontWeight.bold,
            letterSpacing: 1.2,
            color: _brandGreen,
          ),
        ),
        const SizedBox(height: 6),
        const Text(
          'Attendance',
          style: TextStyle(
            fontSize: 26,
            fontWeight: FontWeight.bold,
            color: Colors.black87,
          ),
        ),
        const SizedBox(height: 6),
        Text(
          monthName,
          style: TextStyle(color: Colors.grey.shade600, fontSize: 14),
        ),
        const SizedBox(height: 20),
        if (error != null) ...[
          _errorCard(error!),
          const SizedBox(height: 16),
        ],

        // TODAY'S ATTENDANCE CARD
        _buildTodayAttendanceCard(),
        const SizedBox(height: 24),

        // ATTENDANCE PERCENTAGE
        Container(
          width: double.infinity,
          padding: const EdgeInsets.all(24),
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(20),
            border: Border.all(color: Colors.grey.shade200),
          ),
          child: Column(
            children: [
              Container(
                width: 64,
                height: 64,
                decoration: BoxDecoration(
                  color: _brandGreen.withOpacity(0.1),
                  shape: BoxShape.circle,
                ),
                alignment: Alignment.center,
                child: const Icon(
                  Icons.analytics_outlined,
                  size: 30,
                  color: _brandGreen,
                ),
              ),
              const SizedBox(height: 14),
              Text(
                '$percentage%',
                style: const TextStyle(
                  fontSize: 38,
                  fontWeight: FontWeight.bold,
                  color: Colors.black87,
                ),
              ),
              const SizedBox(height: 4),
              Text(
                'Attendance Percentage',
                style: TextStyle(fontSize: 15, color: Colors.grey.shade600),
              ),
              const SizedBox(height: 14),
              Container(
                padding: const EdgeInsets.symmetric(
                  horizontal: 16,
                  vertical: 8,
                ),
                decoration: BoxDecoration(
                  borderRadius: BorderRadius.circular(20),
                  color: _brandGreen.withOpacity(0.1),
                ),
                child: Text(
                  status,
                  style: const TextStyle(
                    fontWeight: FontWeight.bold,
                    color: _brandGreen,
                  ),
                ),
              ),
              const SizedBox(height: 12),
              Text(
                summaryData['message']?.toString() ?? '',
                textAlign: TextAlign.center,
                style: TextStyle(color: Colors.grey.shade700),
              ),
            ],
          ),
        ),
        const SizedBox(height: 28),

        _sectionLabel('MONTHLY SUMMARY'),
        const SizedBox(height: 14),

        Row(
          children: [
            Expanded(
              child: _SummaryCard(
                title: 'Present',
                value: present,
                icon: Icons.check_circle_outline,
                accentColor: const Color(0xFF16A34A),
                backgroundColor: const Color(0xFFE9F9EF),
              ),
            ),
            const SizedBox(width: 10),
            Expanded(
              child: _SummaryCard(
                title: 'Half Days',
                value: halfDays,
                icon: Icons.timelapse,
                accentColor: const Color(0xFFD97706),
                backgroundColor: const Color(0xFFFDF3E3),
              ),
            ),
          ],
        ),
        const SizedBox(height: 10),

        Row(
          children: [
            Expanded(
              child: _SummaryCard(
                title: 'Absent',
                value: absent,
                icon: Icons.cancel_outlined,
                accentColor: const Color(0xFFDC2626),
                backgroundColor: const Color(0xFFFCEAEA),
              ),
            ),
            const SizedBox(width: 10),
            Expanded(
              child: _SummaryCard(
                title: 'On Leave',
                value: leave,
                icon: Icons.beach_access_outlined,
                accentColor: const Color(0xFF2563EB),
                backgroundColor: const Color(0xFFEAF1FE),
              ),
            ),
          ],
        ),
        const SizedBox(height: 10),

        Row(
          children: [
            Expanded(
              child: _SummaryCard(
                title: 'Weekly Off',
                value: weeklyOff,
                icon: Icons.weekend_outlined,
                accentColor: const Color(0xFF9333EA),
                backgroundColor: const Color(0xFFF3E9FD),
              ),
            ),
            const SizedBox(width: 10),
            Expanded(
              child: _SummaryCard(
                title: 'Holidays',
                value: holidays,
                icon: Icons.celebration_outlined,
                accentColor: const Color(0xFFDB2777),
                backgroundColor: const Color(0xFFFCE7F1),
              ),
            ),
          ],
        ),
        const SizedBox(height: 10),

        _SummaryCard(
          title: 'Working Days',
          value: workingDays,
          icon: Icons.work_outline,
          accentColor: const Color(0xFF0D9488),
          backgroundColor: const Color(0xFFE6F6F4),
        ),
      ],
    );
  }

  Widget _errorCard(String message) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.red.shade50,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: Colors.red.shade100),
      ),
      child: Row(
        children: [
          Icon(Icons.error_outline, color: Colors.red.shade400, size: 22),
          const SizedBox(width: 12),
          Expanded(
            child: Text(
              message,
              style: TextStyle(
                color: Colors.red.shade700,
                fontWeight: FontWeight.w500,
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildTodayAttendanceCard() {
    final Color statusColor = _isCheckedOut
        ? const Color(0xFF2563EB)
        : _isCheckedIn
            ? const Color(0xFF16A34A)
            : const Color(0xFFD97706);

    final Color statusBg = _isCheckedOut
        ? const Color(0xFFEAF1FE)
        : _isCheckedIn
            ? const Color(0xFFE9F9EF)
            : const Color(0xFFFDF3E3);

    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(22),
      decoration: BoxDecoration(
        color: statusBg,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: statusColor.withOpacity(0.15)),
      ),
      child: Column(
        children: [
          Container(
            width: 64,
            height: 64,
            decoration: BoxDecoration(
              color: Colors.white,
              shape: BoxShape.circle,
              boxShadow: [
                BoxShadow(
                  color: statusColor.withOpacity(0.18),
                  blurRadius: 10,
                  offset: const Offset(0, 4),
                ),
              ],
            ),
            alignment: Alignment.center,
            child: Icon(
              _isCheckedOut
                  ? Icons.task_alt
                  : _isCheckedIn
                      ? Icons.check_circle
                      : Icons.location_on,
              size: 32,
              color: statusColor,
            ),
          ),
          const SizedBox(height: 14),
          Text(
            _isCheckedOut
                ? 'Checked out'
                : _isCheckedIn
                    ? 'Checked in'
                    : 'Not checked in today',
            style: TextStyle(
              fontSize: 19,
              fontWeight: FontWeight.bold,
              color: statusColor,
            ),
            textAlign: TextAlign.center,
          ),
          const SizedBox(height: 6),
          if (!_isCheckedIn)
            Text(
              'Use your current location to check in.',
              textAlign: TextAlign.center,
              style: TextStyle(color: Colors.grey.shade700),
            )
          else if (!_isCheckedOut)
            Text(
              'You are checked in. Check out when you finish for today.',
              textAlign: TextAlign.center,
              style: TextStyle(color: Colors.grey.shade700),
            )
          else
            Text(
              'Your check-in and check-out have been recorded.',
              textAlign: TextAlign.center,
              style: TextStyle(color: Colors.grey.shade700),
            ),

          // TIMES
          if (_isCheckedIn) ...[
            const SizedBox(height: 18),
            _TimeRow(
              icon: Icons.login,
              label: 'Check-in Time',
              value: _formatTime(_checkInTime),
            ),
          ],

          if (_isCheckedIn && !_isCheckedOut) ...[
            const SizedBox(height: 10),
            _TimeRow(
              icon: Icons.schedule,
              label: 'Time Worked',
              value: _calculateWorkedTime(),
            ),
          ],

          if (_isCheckedOut) ...[
            const SizedBox(height: 10),
            _TimeRow(
              icon: Icons.logout,
              label: 'Check-out Time',
              value: _formatTime(_checkOutTime),
            ),
            const SizedBox(height: 10),
            _TimeRow(
              icon: Icons.schedule,
              label: 'Total Time Worked',
              value: _calculateWorkedTime(),
            ),
          ],

          const SizedBox(height: 18),

          // BUTTONS
          if (!_isCheckedIn)
            SizedBox(
              width: double.infinity,
              height: 50,
              child: ElevatedButton.icon(
                onPressed: actionLoading ? null : handleCheckIn,
                icon: actionLoading
                    ? const SizedBox(
                        width: 20,
                        height: 20,
                        child: CircularProgressIndicator(
                          strokeWidth: 2,
                          color: Colors.white,
                        ),
                      )
                    : const Icon(Icons.login),
                label: Text(actionLoading ? 'Getting location...' : 'Check In'),
                style: ElevatedButton.styleFrom(
                  backgroundColor: _brandGreen,
                  foregroundColor: Colors.white,
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(12),
                  ),
                ),
              ),
            )
          else if (!_isCheckedOut)
            SizedBox(
              width: double.infinity,
              height: 50,
              child: ElevatedButton.icon(
                onPressed: actionLoading ? null : handleCheckOut,
                icon: actionLoading
                    ? const SizedBox(
                        width: 20,
                        height: 20,
                        child: CircularProgressIndicator(
                          strokeWidth: 2,
                          color: Colors.white,
                        ),
                      )
                    : const Icon(Icons.logout),
                label: Text(actionLoading ? 'Processing...' : 'Check Out'),
                style: ElevatedButton.styleFrom(
                  backgroundColor: const Color(0xFFDC2626),
                  foregroundColor: Colors.white,
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(12),
                  ),
                ),
              ),
            )
          else
            Container(
              width: double.infinity,
              padding: const EdgeInsets.symmetric(vertical: 14),
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(12),
                color: Colors.white,
              ),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Icon(Icons.check_circle, color: statusColor),
                  const SizedBox(width: 8),
                  Text(
                    'Checkout Complete',
                    style: TextStyle(
                      fontWeight: FontWeight.bold,
                      color: statusColor,
                    ),
                  ),
                ],
              ),
            ),
        ],
      ),
    );
  }
}

// ================================================================
// TIME ROW
// ================================================================
class _TimeRow extends StatelessWidget {
  final IconData icon;
  final String label;
  final String value;

  const _TimeRow({
    required this.icon,
    required this.label,
    required this.value,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(12),
        color: Colors.white,
      ),
      child: Row(
        children: [
          Icon(icon, size: 20, color: Colors.black54),
          const SizedBox(width: 12),
          Expanded(
            child: Text(
              label,
              style: const TextStyle(
                fontWeight: FontWeight.w500,
                color: Colors.black87,
              ),
            ),
          ),
          Text(
            value,
            style: const TextStyle(fontWeight: FontWeight.bold),
          ),
        ],
      ),
    );
  }
}

// ================================================================
// SUMMARY CARD
// ================================================================
class _SummaryCard extends StatelessWidget {
  final String title;
  final String value;
  final IconData icon;
  final Color accentColor;
  final Color backgroundColor;

  const _SummaryCard({
    required this.title,
    required this.value,
    required this.icon,
    required this.accentColor,
    required this.backgroundColor,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: backgroundColor,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: accentColor.withOpacity(0.12)),
      ),
      child: Row(
        children: [
          Container(
            width: 38,
            height: 38,
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(11),
              boxShadow: [
                BoxShadow(
                  color: accentColor.withOpacity(0.15),
                  blurRadius: 5,
                  offset: const Offset(0, 3),
                ),
              ],
            ),
            alignment: Alignment.center,
            child: Icon(icon, size: 19, color: accentColor),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  value,
                  style: const TextStyle(
                    fontSize: 20,
                    fontWeight: FontWeight.bold,
                    color: Colors.black87,
                  ),
                ),
                Text(
                  title,
                  style: TextStyle(
                    color: Colors.grey.shade600,
                    fontSize: 12.5,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}