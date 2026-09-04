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
        title: const Text('Confirm Check Out'),
        content: const Text('Are you sure you want to check out?'),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: const Text('Cancel'),
          ),
          ElevatedButton(
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

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Attendance'),
        actions: [
          IconButton(
            onPressed: loading ? null : loadAttendance,
            icon: const Icon(Icons.refresh),
          ),
        ],
      ),
      body: RefreshIndicator(
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
              child: CircularProgressIndicator(),
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
          const SizedBox(height: 100),
          const Icon(Icons.error_outline, size: 60, color: Colors.red),
          const SizedBox(height: 16),
          Text(
            error!,
            textAlign: TextAlign.center,
            style: const TextStyle(color: Colors.red, fontSize: 16),
          ),
          const SizedBox(height: 20),
          ElevatedButton(
            onPressed: loadAttendance,
            child: const Text('Retry'),
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
      padding: const EdgeInsets.all(20),
      children: [
        const Text(
          'Attendance',
          style: TextStyle(fontSize: 28, fontWeight: FontWeight.bold),
        ),
        const SizedBox(height: 6),
        Text(
          monthName,
          style: TextStyle(color: Colors.grey.shade600, fontSize: 16),
        ),
        const SizedBox(height: 24),
        if (error != null)
          Container(
            width: double.infinity,
            padding: const EdgeInsets.all(14),
            margin: const EdgeInsets.only(bottom: 16),
            decoration:
                BoxDecoration(color: Colors.red.shade50, borderRadius: BorderRadius.circular(10)),
            child: Text(error!, style: TextStyle(color: Colors.red.shade700)),
          ),
        
        // TODAY'S ATTENDANCE CARD
        _buildTodayAttendanceCard(),
        const SizedBox(height: 24),

        // ATTENDANCE PERCENTAGE
        Card(
          child: Padding(
            padding: const EdgeInsets.all(24),
            child: Column(
              children: [
                const Icon(Icons.analytics_outlined, size: 48),
                const SizedBox(height: 12),
                Text(
                  '$percentage%',
                  style: const TextStyle(fontSize: 38, fontWeight: FontWeight.bold),
                ),
                const SizedBox(height: 4),
                const Text('Attendance Percentage', style: TextStyle(fontSize: 16)),
                const SizedBox(height: 12),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                  decoration: BoxDecoration(
                    borderRadius: BorderRadius.circular(20),
                    color: Colors.grey.shade200,
                  ),
                  child: Text(status, style: const TextStyle(fontWeight: FontWeight.bold)),
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
        ),
        const SizedBox(height: 24),

        const Text(
          'Monthly Summary',
          style: TextStyle(fontSize: 22, fontWeight: FontWeight.bold),
        ),
        const SizedBox(height: 14),

        Row(
          children: [
            Expanded(
              child: _SummaryCard(title: 'Present', value: present, icon: Icons.check_circle_outline),
            ),
            const SizedBox(width: 10),
            Expanded(
              child: _SummaryCard(title: 'Half Days', value: halfDays, icon: Icons.timelapse),
            ),
          ],
        ),
        const SizedBox(height: 10),

        Row(
          children: [
            Expanded(
              child: _SummaryCard(title: 'Absent', value: absent, icon: Icons.cancel_outlined),
            ),
            const SizedBox(width: 10),
            Expanded(
              child: _SummaryCard(title: 'On Leave', value: leave, icon: Icons.beach_access_outlined),
            ),
          ],
        ),
        const SizedBox(height: 10),

        Row(
          children: [
            Expanded(
              child: _SummaryCard(title: 'Weekly Off', value: weeklyOff, icon: Icons.weekend_outlined),
            ),
            const SizedBox(width: 10),
            Expanded(
              child: _SummaryCard(title: 'Holidays', value: holidays, icon: Icons.celebration_outlined),
            ),
          ],
        ),
        const SizedBox(height: 10),

        _SummaryCard(title: 'Working Days', value: workingDays, icon: Icons.work_outline),
      ],
    );
  }

  Widget _buildTodayAttendanceCard() {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(20),
        child: Column(
          children: [
            Icon(
              _isCheckedOut
                  ? Icons.task_alt
                  : _isCheckedIn
                      ? Icons.check_circle
                      : Icons.location_on,
              size: 52,
            ),
            const SizedBox(height: 12),
            Text(
              _isCheckedOut
                  ? 'Checked out'
                  : _isCheckedIn
                      ? 'Checked in'
                      : 'Not checked in today',
              style: const TextStyle(fontSize: 20, fontWeight: FontWeight.bold),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 8),
            if (!_isCheckedIn)
              const Text(
                'Use your current location to check in.',
                textAlign: TextAlign.center,
              )
            else if (!_isCheckedOut)
              const Text(
                'You are checked in. Check out when you finish for today.',
                textAlign: TextAlign.center,
              )
            else
              const Text(
                'Your check-in and check-out have been recorded.',
                textAlign: TextAlign.center,
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
                          child: CircularProgressIndicator(strokeWidth: 2),
                        )
                      : const Icon(Icons.login),
                  label: Text(actionLoading ? 'Getting location...' : 'Check In'),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: Colors.green,
                    foregroundColor: Colors.white,
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
                          child: CircularProgressIndicator(strokeWidth: 2),
                        )
                      : const Icon(Icons.logout),
                  label: Text(actionLoading ? 'Processing...' : 'Check Out'),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: Colors.red,
                    foregroundColor: Colors.white,
                  ),
                ),
              )
            else
              Container(
                width: double.infinity,
                padding: const EdgeInsets.symmetric(vertical: 14),
                decoration:
                    BoxDecoration(borderRadius: BorderRadius.circular(10), color: Colors.grey.shade200),
                child: const Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Icon(Icons.check_circle),
                    SizedBox(width: 8),
                    Text('Checkout Complete', style: TextStyle(fontWeight: FontWeight.bold)),
                  ],
                ),
              ),
          ],
        ),
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
        borderRadius: BorderRadius.circular(10),
        color: Colors.grey.shade100,
      ),
      child: Row(
        children: [
          Icon(icon, size: 22),
          const SizedBox(width: 12),
          Expanded(
            child: Text(label, style: const TextStyle(fontWeight: FontWeight.w500)),
          ),
          Text(value, style: const TextStyle(fontWeight: FontWeight.bold)),
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

  const _SummaryCard({
    required this.title,
    required this.value,
    required this.icon,
  });

  @override
  Widget build(BuildContext context) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Row(
          children: [
            Icon(icon, size: 30),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(value, style: const TextStyle(fontSize: 22, fontWeight: FontWeight.bold)),
                  Text(title, style: TextStyle(color: Colors.grey.shade600)),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}