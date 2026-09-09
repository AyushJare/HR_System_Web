import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../../services/attendance_service.dart';
// import '../leave/leave_screen.dart';

class CalendarScreen extends StatefulWidget {
  const CalendarScreen({super.key});

  @override
  State<CalendarScreen> createState() => _CalendarScreenState();
}

class _CalendarScreenState extends State<CalendarScreen> {
  static const Color _brandGreen = Color(0xFF16A34A);
  static const Color _pageBg = Color(0xFFF4F6FB);

  // ============================================================
  // OLD CALENDAR STATE
  // Kept for future restoration.
  // ============================================================

  // DateTime _selectedMonth = DateTime(DateTime.now().year, DateTime.now().month);

  Map<String, dynamic>? _data;
  bool _loading = true;
  String? _error;

  // ============================================================
  // NEW: EXPANDABLE ATTENDANCE ROW STATE
  // ============================================================

  final Set<String> _expandedDays = <String>{};

  List<Map<String, dynamic>> _recentAttendanceDays = [];

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
      // ============================================================
      // NEW ATTENDANCE LIST
      //
      // We start from the current month and keep checking previous
      // months until we have the latest 10 PRESENT / HALF_DAY days.
      //
      // This is necessary so that, for example, if the current
      // month only has 6 qualifying attendance days, we can take
      // the remaining 4 from the previous month.
      // ============================================================

      final now = DateTime.now();

      final currentMonth = DateTime(now.year, now.month);

      final recentDays = <Map<String, dynamic>>[];

      Map<String, dynamic>? currentMonthData;

      for (int monthOffset = 0; monthOffset < 12; monthOffset++) {
        if (recentDays.length >= 10) {
          break;
        }

        final month = DateTime(
          currentMonth.year,
          currentMonth.month - monthOffset,
        );

        final monthString =
            '${month.year.toString().padLeft(4, '0')}-'
            '${month.month.toString().padLeft(2, '0')}';

        final data = await AttendanceService.getAttendanceSummary(monthString);

        // Keep the current month's data for the existing monthly
        // summary section.
        if (monthOffset == 0) {
          currentMonthData = data;
        }

        final days = data['days'];

        if (days is! List) {
          continue;
        }

        for (final item in days) {
          if (item is! Map) {
            continue;
          }

          final day = Map<String, dynamic>.from(item);

          final status = day['status']?.toString().toUpperCase() ?? '';

          // Only Present / Worked / Half Day are displayed.
          if (status != 'PRESENT' &&
              status != 'WORKED' &&
              status != 'HALF_DAY') {
            continue;
          }

          // Make sure the date exists.
          final dateStr = day['dateStr']?.toString();

          if (dateStr == null || dateStr.isEmpty) {
            continue;
          }

          recentDays.add(day);
        }
      }

      // ============================================================
      // Sort newest first.
      // ============================================================

      recentDays.sort((a, b) {
        final dateA = DateTime.tryParse(a['dateStr']?.toString() ?? '');

        final dateB = DateTime.tryParse(b['dateStr']?.toString() ?? '');

        if (dateA == null && dateB == null) {
          return 0;
        }

        if (dateA == null) {
          return 1;
        }

        if (dateB == null) {
          return -1;
        }

        return dateB.compareTo(dateA);
      });

      // Keep only the latest 10 qualifying attendance days.
      final latestTen = recentDays.take(10).toList();

      if (!mounted) return;

      setState(() {
        _data = currentMonthData;
        _recentAttendanceDays = latestTen;
        _expandedDays.clear();
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

  // ============================================================
  // OLD CALENDAR MONTH NAVIGATION
  //
  // Kept commented so the calendar can be restored later.
  // ============================================================

  /*
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
  */

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

  // Added only for calendar cell colors.
  // Kept because the old calendar code is preserved below.
  Color _statusColor(String status) {
    switch (status.toUpperCase()) {
      case 'PRESENT':
      case 'WORKED':
        return Colors.green;
      case 'ABSENT':
        return Colors.red;
      case 'HALF_DAY':
        return Colors.orange;
      case 'ON_LEAVE':
        return Colors.blue;
      case 'WEEKLY_OFF':
        return Colors.grey;
      case 'HOLIDAY':
        return Colors.purple;
      default:
        return Colors.transparent;
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

  // ============================================================
  // OLD CALENDAR DAY DETAILS
  //
  // Kept commented so it can be restored together with the
  // calendar in the future.
  // ============================================================

  /*
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
  */

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

  // ============================================================
  // NEW: EXPANDABLE ATTENDANCE ROW
  // ============================================================

  Widget _buildRecentAttendanceRow(Map<String, dynamic> day) {
    final status = day['status']?.toString().toUpperCase() ?? '';

    final dateStr = day['dateStr']?.toString() ?? '';

    final date = DateTime.tryParse(dateStr);

    final rowKey = dateStr.isNotEmpty
        ? dateStr
        : '${day['day']?.toString() ?? ''}-$status';

    final expanded = _expandedDays.contains(rowKey);

    final isHalfDay = status == 'HALF_DAY';

    final statusColor = isHalfDay ? Colors.orange : Colors.green;

    final statusText = isHalfDay ? 'Half Day' : 'Present';

    final statusCode = isHalfDay ? 'H' : 'P';

    final dateText = date != null
        ? DateFormat('EEE, d MMM yyyy').format(date)
        : dateStr;

    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: statusColor.withOpacity(0.18)),
      ),
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          borderRadius: BorderRadius.circular(16),
          onTap: () {
            setState(() {
              if (expanded) {
                _expandedDays.remove(rowKey);
              } else {
                _expandedDays.add(rowKey);
              }
            });
          },
          child: Padding(
            padding: const EdgeInsets.all(14),
            child: Column(
              children: [
                Row(
                  children: [
                    Container(
                      width: 42,
                      height: 42,
                      decoration: BoxDecoration(
                        color: statusColor.withOpacity(0.10),
                        borderRadius: BorderRadius.circular(12),
                      ),
                      alignment: Alignment.center,
                      child: Text(
                        statusCode,
                        style: TextStyle(
                          color: statusColor,
                          fontSize: 17,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                    ),

                    const SizedBox(width: 12),

                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            dateText,
                            style: const TextStyle(
                              fontSize: 15,
                              fontWeight: FontWeight.bold,
                              color: Colors.black87,
                            ),
                          ),
                          const SizedBox(height: 4),
                          Text(
                            statusText,
                            style: TextStyle(
                              color: statusColor,
                              fontSize: 12.5,
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                        ],
                      ),
                    ),

                    Icon(
                      expanded
                          ? Icons.keyboard_arrow_up
                          : Icons.keyboard_arrow_down,
                      color: Colors.grey.shade600,
                    ),
                  ],
                ),

                // ==================================================
                // EXPANDED CLOCK IN / CLOCK OUT SECTION
                // ==================================================
                if (expanded) ...[
                  const SizedBox(height: 14),

                  Divider(height: 1, color: Colors.grey.shade200),

                  const SizedBox(height: 14),

                  Row(
                    children: [
                      Expanded(
                        child: _timeCard(
                          icon: Icons.login,
                          title: 'Clock In',
                          value: _formatTime(day['timeIn']),
                        ),
                      ),

                      const SizedBox(width: 10),

                      Expanded(
                        child: _timeCard(
                          icon: Icons.logout,
                          title: 'Clock Out',
                          value: _formatTime(day['timeOut']),
                        ),
                      ),
                    ],
                  ),
                ],
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildRecentAttendance() {
    if (_recentAttendanceDays.isEmpty) {
      return Container(
        width: double.infinity,
        padding: const EdgeInsets.all(20),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(18),
          border: Border.all(color: Colors.black.withOpacity(0.05)),
        ),
        child: Column(
          children: [
            Icon(
              Icons.event_busy_outlined,
              size: 38,
              color: Colors.grey.shade400,
            ),
            const SizedBox(height: 10),
            Text(
              'No recent attendance records',
              style: TextStyle(
                color: Colors.grey.shade600,
                fontSize: 14,
                fontWeight: FontWeight.w500,
              ),
            ),
          ],
        ),
      );
    }

    return Column(
      children: _recentAttendanceDays.map(_buildRecentAttendanceRow).toList(),
    );
  }

  // ============================================================
  // OLD CALENDAR UI
  //
  // Entire calendar is kept commented out for future restoration.
  // ============================================================

  /*
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

      final statusColor = _statusColor(status);
      final hasStatus = statusCode.isNotEmpty;

      cells.add(
        GestureDetector(
          onTap: dayData == null ? null : () => _showDayDetails(dayData),
          child: Container(
            margin: const EdgeInsets.all(3),
            decoration: BoxDecoration(
              color: hasStatus ? statusColor.withOpacity(0.08) : Colors.white,
              borderRadius: BorderRadius.circular(10),
              border: Border.all(
                color: hasStatus
                    ? statusColor.withOpacity(0.25)
                    : Colors.black.withOpacity(0.08),
              ),
            ),
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Text(
                  '$dayNumber',
                  style: TextStyle(
                    fontSize: 13,
                    fontWeight: FontWeight.bold,
                    color: hasStatus ? statusColor : Colors.black87,
                  ),
                ),
                const SizedBox(height: 5),
                Text(
                  statusCode,
                  style: TextStyle(
                    fontSize: 12,
                    fontWeight: FontWeight.bold,
                    color: hasStatus ? statusColor : Colors.black87,
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
  */

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
    // ============================================================
    // OLD CALENDAR MONTH NAME
    //
    // Kept commented for future restoration.
    // ============================================================

    // final monthName = DateFormat('MMMM yyyy').format(_selectedMonth);

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
                    // ==================================================
                    // NEW: RECENT ATTENDANCE
                    // ==================================================
                    const Text(
                      'RECENT ATTENDANCE',
                      style: TextStyle(
                        fontSize: 12,
                        fontWeight: FontWeight.bold,
                        letterSpacing: 1,
                        color: Colors.black87,
                      ),
                    ),

                    const SizedBox(height: 6),

                    Text(
                      'Last 10 days you were present or worked half day',
                      style: TextStyle(
                        fontSize: 12.5,
                        color: Colors.grey.shade600,
                      ),
                    ),

                    const SizedBox(height: 14),

                    _buildRecentAttendance(),

                    const SizedBox(height: 20),

                    // ==================================================
                    // OLD CALENDAR UI
                    //
                    // KEPT COMMENTED FOR FUTURE RESTORATION.
                    // ==================================================

                    /*
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
                    */

                    // ==================================================
                    // MONTHLY SUMMARY
                    // Existing functionality preserved.
                    // ==================================================
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
