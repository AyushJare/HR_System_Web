import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../../services/attendance_service.dart';
import '../leave/leave_screen.dart';

class CalendarScreen extends StatefulWidget {
  const CalendarScreen({super.key});

  @override
  State<CalendarScreen> createState() => _CalendarScreenState();
}

class _CalendarScreenState extends State<CalendarScreen> {
  static const Color _brandGreen = Color(0xFF16A34A);
  static const Color _pageBg = Color(0xFFF4F6FB);

  DateTime _selectedMonth = DateTime(DateTime.now().year, DateTime.now().month);

  Map<String, dynamic>? _data;
  bool _loading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _loadAttendance();
  }

  Future<void> _loadAttendance() async {
    setState(() {
      _loading = true;
      _error = null;
    });

    try {
      final month =
          '${_selectedMonth.year.toString().padLeft(4, '0')}-'
          '${_selectedMonth.month.toString().padLeft(2, '0')}';

      final data = await AttendanceService.getAttendanceSummary(month);

      if (!mounted) return;

      setState(() {
        _data = data;
        _loading = false;
      });
    } catch (e) {
      if (!mounted) return;

      setState(() {
        _loading = false;
        _error = e.toString().replaceFirst('Exception: ', '');
      });
    }
  }

  void _previousMonth() {
    setState(() {
      _selectedMonth = DateTime(_selectedMonth.year, _selectedMonth.month - 1);
    });

    _loadAttendance();
  }

  void _nextMonth() {
    setState(() {
      _selectedMonth = DateTime(_selectedMonth.year, _selectedMonth.month + 1);
    });

    _loadAttendance();
  }

  String _statusLabel(String status) {
    switch (status.toUpperCase()) {
      case 'PRESENT':
        return 'Present';
      case 'WORKED':
        return 'Worked';
      case 'ABSENT':
        return 'Absent';
      case 'HALF_DAY':
        return 'Half Day';
      case 'ON_LEAVE':
        return 'On Leave';
      case 'WEEKLY_OFF':
        return 'Weekly Off';
      case 'HOLIDAY':
        return 'Holiday';
      default:
        return status;
    }
  }

  String _statusCode(String status) {
    switch (status.toUpperCase()) {
      case 'PRESENT':
        return 'P';
      case 'WORKED':
        return 'P';
      case 'ABSENT':
        return 'A';
      case 'HALF_DAY':
        return 'H';
      case 'ON_LEAVE':
        return 'L';
      case 'WEEKLY_OFF':
        return 'WO';
      case 'HOLIDAY':
        return 'HOL';
      default:
        return '';
    }
  }

  String _formatTime(dynamic value) {
    if (value == null) return '--';

    try {
      final dateTime = DateTime.parse(value.toString()).toLocal();
      return DateFormat('hh:mm a').format(dateTime);
    } catch (_) {
      return '--';
    }
  }

  void _showDayDetails(Map<String, dynamic> day) {
    final status = day['status']?.toString() ?? 'UNKNOWN';
    final dateStr = day['dateStr']?.toString();

    DateTime? date;

    if (dateStr != null) {
      try {
        date = DateTime.parse(dateStr);
      } catch (_) {}
    }

    final dateText = date != null
        ? DateFormat('EEEE, d MMMM yyyy').format(date)
        : 'Attendance Details';

    showModalBottomSheet(
      context: context,
      backgroundColor: Colors.transparent,
      isScrollControlled: true,
      builder: (context) {
        return Container(
          padding: const EdgeInsets.fromLTRB(20, 12, 20, 28),
          decoration: const BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Center(
                child: Container(
                  width: 40,
                  height: 4,
                  decoration: BoxDecoration(
                    color: Colors.grey.shade300,
                    borderRadius: BorderRadius.circular(10),
                  ),
                ),
              ),

              const SizedBox(height: 20),

              Text(
                dateText,
                style: const TextStyle(
                  fontSize: 19,
                  fontWeight: FontWeight.bold,
                  color: Colors.black87,
                ),
              ),

              const SizedBox(height: 16),

              Container(
                padding: const EdgeInsets.symmetric(
                  horizontal: 12,
                  vertical: 8,
                ),
                decoration: BoxDecoration(
                  color: _pageBg,
                  borderRadius: BorderRadius.circular(10),
                ),
                child: Text(
                  '${_statusCode(status)} - ${_statusLabel(status)}',
                  style: const TextStyle(
                    fontWeight: FontWeight.bold,
                    color: Colors.black87,
                  ),
                ),
              ),

              if (status == 'PRESENT' ||
                  status == 'WORKED' ||
                  status == 'HALF_DAY' ||
                  status == 'ON_LEAVE') ...[
                const SizedBox(height: 20),

                Row(
                  children: [
                    Expanded(
                      child: _timeCard(
                        icon: Icons.login,
                        title: 'Check In',
                        value: _formatTime(day['timeIn']),
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: _timeCard(
                        icon: Icons.logout,
                        title: 'Check Out',
                        value: _formatTime(day['timeOut']),
                      ),
                    ),
                  ],
                ),
              ],

              const SizedBox(height: 20),

              SizedBox(
                width: double.infinity,
                child: OutlinedButton.icon(
                  onPressed: () {
                    Navigator.pop(context);
                    Navigator.push(
                      context,
                      MaterialPageRoute(
                        builder: (_) =>
                            const LeaveScreen(openAttendanceCorrection: true),
                      ),
                    );
                  },
                  icon: const Icon(Icons.edit_note_outlined, size: 20),
                  label: const Text('Raise Query'),
                  style: OutlinedButton.styleFrom(
                    foregroundColor: Colors.red,
                    side: const BorderSide(color: Colors.red),
                    minimumSize: const Size.fromHeight(48),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(12),
                    ),
                    textStyle: const TextStyle(fontWeight: FontWeight.bold),
                  ),
                ),
              ),

              if (day['holidayName'] != null) ...[
                const SizedBox(height: 16),
                Text(
                  day['holidayName'].toString(),
                  style: const TextStyle(
                    fontWeight: FontWeight.w600,
                    fontSize: 14,
                  ),
                ),
              ],

              if (day['reason'] != null) ...[
                const SizedBox(height: 8),
                Text(
                  day['reason'].toString(),
                  style: TextStyle(color: Colors.grey.shade600, fontSize: 13),
                ),
              ],
            ],
          ),
        );
      },
    );
  }

  Widget _timeCard({
    required IconData icon,
    required String title,
    required String value,
  }) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: _pageBg,
        borderRadius: BorderRadius.circular(14),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(icon, size: 17, color: _brandGreen),
              const SizedBox(width: 6),
              Text(
                title,
                style: TextStyle(
                  color: Colors.grey.shade600,
                  fontSize: 12,
                  fontWeight: FontWeight.w500,
                ),
              ),
            ],
          ),
          const SizedBox(height: 7),
          Text(
            value,
            style: const TextStyle(
              fontSize: 16,
              fontWeight: FontWeight.bold,
              color: Colors.black87,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildLegendItem(String code, String label) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Text(
          code,
          style: const TextStyle(
            fontSize: 11,
            fontWeight: FontWeight.bold,
            color: Colors.black87,
          ),
        ),
        const SizedBox(width: 5),
        Text(
          label,
          style: TextStyle(fontSize: 11, color: Colors.grey.shade700),
        ),
      ],
    );
  }

  Widget _buildCalendar() {
    final days = _data?['days'];

    if (days is! List) {
      return const Center(child: Text('No attendance data available'));
    }

    final daysByDate = <int, Map<String, dynamic>>{};

    for (final item in days) {
      if (item is Map) {
        final dayNumber = int.tryParse(item['day']?.toString() ?? '');

        if (dayNumber != null) {
          daysByDate[dayNumber] = Map<String, dynamic>.from(item);
        }
      }
    }

    final firstDay = DateTime(_selectedMonth.year, _selectedMonth.month, 1);

    final daysInMonth = DateTime(
      _selectedMonth.year,
      _selectedMonth.month + 1,
      0,
    ).day;

    // Monday = 0, Sunday = 6
    final firstWeekday = firstDay.weekday - 1;

    final totalCells = ((firstWeekday + daysInMonth) / 7).ceil() * 7;

    final cells = <Widget>[];

    for (int index = 0; index < totalCells; index++) {
      final dayNumber = index - firstWeekday + 1;

      if (dayNumber < 1 || dayNumber > daysInMonth) {
        cells.add(const SizedBox());
        continue;
      }

      final dayData = daysByDate[dayNumber];

      final status = dayData?['status']?.toString() ?? '';
      final statusCode = _statusCode(status);

      cells.add(
        GestureDetector(
          onTap: dayData == null ? null : () => _showDayDetails(dayData),
          child: Container(
            margin: const EdgeInsets.all(3),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(10),
              border: Border.all(color: Colors.black.withOpacity(0.08)),
            ),
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Text(
                  '$dayNumber',
                  style: const TextStyle(
                    fontSize: 13,
                    fontWeight: FontWeight.bold,
                    color: Colors.black87,
                  ),
                ),
                const SizedBox(height: 5),
                Text(
                  statusCode,
                  style: const TextStyle(
                    fontSize: 12,
                    fontWeight: FontWeight.bold,
                    color: Colors.black87,
                  ),
                ),
              ],
            ),
          ),
        ),
      );
    }

    return Column(
      children: [
        Row(
          children: const ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
              .map(
                (day) => Expanded(
                  child: Center(
                    child: Text(
                      day,
                      style: TextStyle(
                        fontSize: 11,
                        fontWeight: FontWeight.bold,
                        color: Colors.black54,
                      ),
                    ),
                  ),
                ),
              )
              .toList(),
        ),

        const SizedBox(height: 8),

        GridView.count(
          crossAxisCount: 7,
          shrinkWrap: true,
          physics: const NeverScrollableScrollPhysics(),
          childAspectRatio: 0.95,
          children: cells,
        ),
      ],
    );
  }

  Widget _buildSummary() {
    final attendance = _data?['attendance'];

    if (attendance is! Map) {
      return const SizedBox();
    }

    return Wrap(
      spacing: 8,
      runSpacing: 8,
      children: [
        _summaryChip('Present', attendance['presentDays'], Colors.green),
        _summaryChip('Half Day', attendance['halfDays'], Colors.orange),
        _summaryChip('Absent', attendance['absentDays'], Colors.red),
        _summaryChip('Leave', attendance['onLeaveDays'], Colors.blue),
        _summaryChip('Weekly Off', attendance['weeklyOffDays'], Colors.grey),
        _summaryChip('Holiday', attendance['holidayDays'], Colors.purple),
      ],
    );
  }

  Widget _summaryChip(String label, dynamic value, Color color) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 7),
      decoration: BoxDecoration(
        color: color.withOpacity(0.08),
        borderRadius: BorderRadius.circular(10),
      ),
      child: Text(
        '$label: ${value ?? 0}',
        style: TextStyle(
          color: color,
          fontSize: 11,
          fontWeight: FontWeight.w600,
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final monthName = DateFormat('MMMM yyyy').format(_selectedMonth);

    return Scaffold(
      backgroundColor: _pageBg,
      appBar: AppBar(
        backgroundColor: Colors.white,
        surfaceTintColor: Colors.white,
        elevation: 0,
        title: const Text(
          'My Attendance',
          style: TextStyle(fontWeight: FontWeight.bold, color: Colors.black87),
        ),
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator(color: _brandGreen))
          : _error != null
          ? Center(
              child: Padding(
                padding: const EdgeInsets.all(24),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Icon(
                      Icons.error_outline,
                      color: Colors.red.shade400,
                      size: 36,
                    ),
                    const SizedBox(height: 12),
                    Text(
                      _error!,
                      textAlign: TextAlign.center,
                      style: TextStyle(color: Colors.red.shade600),
                    ),
                    const SizedBox(height: 16),
                    ElevatedButton(
                      onPressed: _loadAttendance,
                      child: const Text('Retry'),
                    ),
                  ],
                ),
              ),
            )
          : RefreshIndicator(
              color: _brandGreen,
              onRefresh: _loadAttendance,
              child: SingleChildScrollView(
                physics: const AlwaysScrollableScrollPhysics(),
                padding: const EdgeInsets.fromLTRB(16, 16, 16, 32),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    // Month selector
                    Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 8,
                        vertical: 8,
                      ),
                      decoration: BoxDecoration(
                        color: Colors.white,
                        borderRadius: BorderRadius.circular(16),
                        border: Border.all(
                          color: Colors.black.withOpacity(0.05),
                        ),
                      ),
                      child: Row(
                        children: [
                          IconButton(
                            onPressed: _previousMonth,
                            icon: const Icon(Icons.chevron_left),
                          ),
                          Expanded(
                            child: Center(
                              child: Text(
                                monthName,
                                style: const TextStyle(
                                  fontSize: 17,
                                  fontWeight: FontWeight.bold,
                                  color: Colors.black87,
                                ),
                              ),
                            ),
                          ),
                          IconButton(
                            onPressed: _nextMonth,
                            icon: const Icon(Icons.chevron_right),
                          ),
                        ],
                      ),
                    ),

                    const SizedBox(height: 16),

                    // Calendar
                    Container(
                      padding: const EdgeInsets.all(12),
                      decoration: BoxDecoration(
                        color: Colors.white,
                        borderRadius: BorderRadius.circular(18),
                        border: Border.all(
                          color: Colors.black.withOpacity(0.05),
                        ),
                      ),
                      child: _buildCalendar(),
                    ),

                    const SizedBox(height: 16),

                    // Legend
                    Wrap(
                      spacing: 14,
                      runSpacing: 8,
                      children: [
                        _buildLegendItem('P', 'Present'),
                        _buildLegendItem('A', 'Absent'),
                        _buildLegendItem('H', 'Half Day'),
                        _buildLegendItem('L', 'Leave'),
                        _buildLegendItem('WO', 'Weekly Off'),
                        _buildLegendItem('HOL', 'Holiday'),
                      ],
                    ),

                    const SizedBox(height: 20),

                    const Text(
                      'MONTHLY SUMMARY',
                      style: TextStyle(
                        fontSize: 12,
                        fontWeight: FontWeight.bold,
                        letterSpacing: 1,
                        color: Colors.black87,
                      ),
                    ),

                    const SizedBox(height: 10),

                    _buildSummary(),
                  ],
                ),
              ),
            ),
    );
  }
}
