import 'package:flutter/material.dart';
import '../../services/approval_service.dart';

class ApprovalsScreen extends StatefulWidget {
  const ApprovalsScreen({super.key});

  @override
  State<ApprovalsScreen> createState() => _ApprovalsScreenState();
}

class _ApprovalsScreenState extends State<ApprovalsScreen>
    with SingleTickerProviderStateMixin {
  late final TabController tabController;

  List<Map<String, dynamic>> loginApprovals = [];
  List<Map<String, dynamic>> leaveApprovals = [];
  List<Map<String, dynamic>> attendanceApprovals = [];
  List<Map<String, dynamic>> leaveTypes = [];

  bool loading = true;
  String? error;

  static const Color _brandGreen = Color(0xFF16A34A);
  static const Color _pageBg = Color(0xFFF4F6FB);

  @override
  void initState() {
    super.initState();

    tabController = TabController(
      length: 3,
      vsync: this,
    );

    loadApprovals();
  }

  @override
  void dispose() {
    tabController.dispose();
    super.dispose();
  }

  Future<void> loadApprovals() async {
    if (mounted) {
      setState(() {
        loading = true;
        error = null;
      });
    }

    try {
      final loginData =
          await ApprovalService.getLoginApprovals();

      final leaveData =
          await ApprovalService.getLeaveApprovals();

      final attendanceData =
          await ApprovalService.getAttendanceCorrectionApprovals();

      if (!mounted) return;

      setState(() {
        loginApprovals = loginData;
        leaveApprovals = leaveData;
        attendanceApprovals = attendanceData;
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

  Future<void> approveApproval(
    Map<String, dynamic> approval,
    String type,
  ) async {
    final id = _getId(approval);

    if (id == null) {
      _showMessage('Approval ID not found');
      return;
    }

    try {
      if (type == 'LOGIN') {
        await ApprovalService.approveLogin(id);
      } else if (type == 'LEAVE') {
        await ApprovalService.approveLeave(id);
      } else {
        await ApprovalService.approveAttendanceCorrection(id);
      }

      if (!mounted) return;

      _showMessage('Request approved');

      await loadApprovals();
    } catch (e) {
      _showMessage(
        e.toString().replaceFirst(
              'Exception: ',
              '',
            ),
      );
    }
  }

  Future<void> rejectApproval(
    Map<String, dynamic> approval,
    String type,
  ) async {
    final id = _getId(approval);

    if (id == null) {
      _showMessage('Approval ID not found');
      return;
    }

    final reason = await _askReason('Reject Request');

    if (reason == null) return;

    try {
      if (type == 'LOGIN') {
        await ApprovalService.rejectLogin(id, reason);
      } else if (type == 'LEAVE') {
        await ApprovalService.rejectLeave(id, reason);
      } else {
        await ApprovalService.rejectAttendanceCorrection(
          id,
          reason,
        );
      }

      if (!mounted) return;

      _showMessage('Request rejected');

      await loadApprovals();
    } catch (e) {
      _showMessage(
        e.toString().replaceFirst(
              'Exception: ',
              '',
            ),
      );
    }
  }

  String? _getId(Map<String, dynamic> item) {
    final id = item['id'] ?? item['_id'];

    return id?.toString();
  }

  Future<String?> _askReason(String title) async {
    final controller = TextEditingController();

    final result = await showDialog<String>(
      context: context,
      builder: (dialogContext) {
        return AlertDialog(
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(16),
          ),
          title: Text(title),
          content: TextField(
            controller: controller,
            maxLines: 3,
            decoration: InputDecoration(
              labelText: 'Reason',
              border: OutlineInputBorder(
                borderRadius: BorderRadius.circular(12),
              ),
            ),
          ),
          actions: [
            TextButton(
              onPressed: () {
                Navigator.of(dialogContext).pop();
              },
              child: const Text('Cancel'),
            ),
            ElevatedButton(
              style: ElevatedButton.styleFrom(
                backgroundColor: const Color(0xFFDC2626),
                foregroundColor: Colors.white,
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(10),
                ),
              ),
              onPressed: () {
                final reason = controller.text.trim();

                if (reason.isEmpty) {
                  return;
                }

                Navigator.of(dialogContext).pop(reason);
              },
              child: const Text('Reject'),
            ),
          ],
        );
      },
    );

    controller.dispose();

    return result;
  }

  void _showMessage(String message) {
    if (!mounted) return;

    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(message),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: _pageBg,
      appBar: AppBar(
        backgroundColor: Colors.white,
        surfaceTintColor: Colors.white,
        elevation: 0,
        scrolledUnderElevation: 1,
        shadowColor: Colors.black12,
        title: const Text(
          'Approvals',
          style: TextStyle(fontWeight: FontWeight.bold, color: Colors.black87),
        ),
        actions: [
          IconButton(
            onPressed: loading ? null : loadApprovals,
            icon: const Icon(Icons.refresh, color: Colors.black54),
          ),
        ],
        bottom: TabBar(
          controller: tabController,
          labelColor: _brandGreen,
          unselectedLabelColor: Colors.black45,
          indicatorColor: _brandGreen,
          indicatorWeight: 3,
          tabs: const [
            Tab(
              text: 'Login',
              icon: Icon(Icons.location_on_outlined),
            ),
            Tab(
              text: 'Leaves',
              icon: Icon(Icons.event_note),
            ),
            Tab(
              text: 'Attendance',
              icon: Icon(Icons.access_time),
            ),
          ],
        ),
      ),
      body: loading
          ? const Center(
              child: CircularProgressIndicator(color: _brandGreen),
            )
          : error != null
              ? _buildError()
              : TabBarView(
                  controller: tabController,
                  children: [
                    _buildLoginApprovals(),
                    _buildLeaveApprovals(),
                    _buildAttendanceApprovals(),
                  ],
                ),
    );
  }

  Widget _buildError() {
    return RefreshIndicator(
      color: _brandGreen,
      onRefresh: loadApprovals,
      child: ListView(
        physics: const AlwaysScrollableScrollPhysics(),
        padding: const EdgeInsets.all(20),
        children: [
          const SizedBox(height: 80),
          Container(
            padding: const EdgeInsets.all(20),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(16),
              border: Border.all(color: Colors.red.shade100),
            ),
            child: Column(
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
              onPressed: loadApprovals,
              child: const Text('Retry'),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildLoginApprovals() {
    if (loginApprovals.isEmpty) {
      return _emptyView('No pending login approvals');
    }

    return _approvalList(
      loginApprovals,
      'LOGIN',
      Icons.location_on_outlined,
      const Color(0xFF2563EB),
      const Color(0xFFEAF1FE),
    );
  }

  Widget _buildLeaveApprovals() {
    if (leaveApprovals.isEmpty) {
      return _emptyView('No pending leave approvals');
    }

    return _approvalList(
      leaveApprovals,
      'LEAVE',
      Icons.event_note_outlined,
      const Color(0xFF9333EA),
      const Color(0xFFF3E9FD),
    );
  }

  Widget _buildAttendanceApprovals() {
    if (attendanceApprovals.isEmpty) {
      return _emptyView(
        'No pending attendance corrections',
      );
    }

    return _approvalList(
      attendanceApprovals,
      'ATTENDANCE',
      Icons.access_time,
      const Color(0xFF0D9488),
      const Color(0xFFE6F6F4),
    );
  }

  Widget _approvalList(
    List<Map<String, dynamic>> approvals,
    String type,
    IconData icon,
    Color accentColor,
    Color backgroundColor,
  ) {
    return RefreshIndicator(
      color: _brandGreen,
      onRefresh: loadApprovals,
      child: ListView.builder(
        physics: const AlwaysScrollableScrollPhysics(),
        padding: const EdgeInsets.all(16),
        itemCount: approvals.length,
        itemBuilder: (context, index) {
          final approval = approvals[index];

          return _ApprovalCard(
            title: _employeeName(approval),
            requestType: _requestType(
              approval,
              type,
            ),
            details: _detailsForApproval(
              approval,
              type,
            ),
            status: _status(approval),
            icon: icon,
            accentColor: accentColor,
            backgroundColor: backgroundColor,
            onApprove: () => approveApproval(
              approval,
              type,
            ),
            onReject: () => rejectApproval(
              approval,
              type,
            ),
          );
        },
      ),
    );
  }

  Widget _emptyView(String message) {
    return RefreshIndicator(
      color: _brandGreen,
      onRefresh: loadApprovals,
      child: ListView(
        physics: const AlwaysScrollableScrollPhysics(),
        children: [
          const SizedBox(height: 130),
          Center(
            child: Container(
              width: 64,
              height: 64,
              decoration: BoxDecoration(
                color: _brandGreen.withOpacity(0.1),
                shape: BoxShape.circle,
              ),
              alignment: Alignment.center,
              child: const Icon(
                Icons.check_circle_outline,
                size: 30,
                color: _brandGreen,
              ),
            ),
          ),
          const SizedBox(height: 16),
          Center(
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 32),
              child: Text(
                message,
                textAlign: TextAlign.center,
                style: const TextStyle(
                  fontSize: 16,
                  fontWeight: FontWeight.w600,
                  color: Colors.black87,
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  String _employeeName(Map<String, dynamic> item) {
    final actor = item['actor'];

    if (actor is Map) {
      return actor['fullName']?.toString() ??
          actor['name']?.toString() ??
          'Employee';
    }

    final employee = item['employee'];

    if (employee is Map) {
      return employee['fullName']?.toString() ??
          employee['name']?.toString() ??
          'Employee';
    }

    return item['employeeName']?.toString() ??
        item['fullName']?.toString() ??
        item['name']?.toString() ??
        'Employee';
  }

  String _requestType(
    Map<String, dynamic> item,
    String fallbackType,
  ) {
    final type = item['type']?.toString();

    if (type == 'LOCATION_BASED_LOGIN') {
      return 'Location Login';
    }

    if (type == 'ATTENDANCE_CORRECTION') {
      return 'Attendance Correction';
    }

    if (type == 'LEAVE') {
      return 'Leave';
    }

    if (fallbackType == 'LOGIN') {
      return 'Location Login';
    }

    if (fallbackType == 'ATTENDANCE') {
      return 'Attendance Correction';
    }

    return 'Leave';
  }

  String _status(Map<String, dynamic> item) {
    return item['status']?.toString() ?? 'PENDING';
  }

  List<MapEntry<String, String>> _detailsForApproval(
    Map<String, dynamic> item,
    String type,
  ) {
    final details = item['details'];

    if (details is! Map) {
      return [];
    }

    final result = <MapEntry<String, String>>[];

    if (type == 'LOGIN') {
      _addDetail(
        result,
        'Date',
        details['date'],
      );

      _addDetail(
        result,
        'Latitude',
        details['latitude'],
      );

      _addDetail(
        result,
        'Longitude',
        details['longitude'],
      );

      _addDetail(
        result,
        'GPS Accuracy',
        details['gpsAccuracy'],
      );

      _addDetail(
        result,
        'Distance from Office',
        details['distanceFromOffice'],
      );

      _addDetail(
        result,
        'Allowed Radius',
        details['allowedRadius'],
      );

      _addDetail(
        result,
        'Location Mode',
        details['locationMode'],
      );

      _addDetail(
        result,
        'Approval Required',
        details['approvalRequired'],
      );
    } else if (type == 'LEAVE') {
      _addDetail(
        result,
        'Leave Type',
        details['leaveTypeName'] ??
            details['leaveType'] ??
            details['leaveTypeId'],
      );

      _addDetail(
        result,
        'From Date',
        details['fromDate'] ??
            details['date'],
      );

      _addDetail(
        result,
        'To Date',
        details['toDate'] ??
            details['date'],
      );

      _addDetail(
        result,
        'Reason',
        details['reason'],
      );

      _addDetail(
        result,
        'Leave Type ID',
        details['leaveTypeId'],
      );
    } else {
      _addDetail(
        result,
        'Date',
        details['date'],
      );

      _addDetail(
        result,
        'Time In',
        details['timeIn'] ??
            details['checkInTime'],
      );

      _addDetail(
        result,
        'Time Out',
        details['timeOut'] ??
            details['checkOutTime'],
      );

      _addDetail(
        result,
        'Status',
        details['status'] ??
            details['attendanceStatus'],
      );

      _addDetail(
        result,
        'Reason',
        details['reason'],
      );
    }

    return result;
  }

  void _addDetail(
    List<MapEntry<String, String>> list,
    String label,
    dynamic value,
  ) {
    if (value == null) return;

    final text = value.toString().trim();

    if (text.isEmpty) return;

    list.add(
      MapEntry(label, text),
    );
  }
}

class _ApprovalCard extends StatelessWidget {
  final String title;
  final String requestType;
  final List<MapEntry<String, String>> details;
  final String status;
  final IconData icon;
  final Color accentColor;
  final Color backgroundColor;
  final VoidCallback onApprove;
  final VoidCallback onReject;

  const _ApprovalCard({
    required this.title,
    required this.requestType,
    required this.details,
    required this.status,
    required this.icon,
    required this.accentColor,
    required this.backgroundColor,
    required this.onApprove,
    required this.onReject,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(
        bottom: 12,
      ),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: Colors.grey.shade200),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment:
                CrossAxisAlignment.start,
            children: [
              Container(
                width: 42,
                height: 42,
                decoration: BoxDecoration(
                  color: backgroundColor,
                  borderRadius: BorderRadius.circular(12),
                ),
                alignment: Alignment.center,
                child: Icon(icon, color: accentColor, size: 21),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment:
                      CrossAxisAlignment.start,
                  children: [
                    Text(
                      title,
                      style: const TextStyle(
                        fontSize: 16,
                        fontWeight: FontWeight.bold,
                        color: Colors.black87,
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      requestType,
                      style: TextStyle(
                        fontWeight: FontWeight.w600,
                        color: accentColor,
                        fontSize: 13,
                      ),
                    ),
                  ],
                ),
              ),
              _StatusChip(
                status: status,
              ),
            ],
          ),
          if (details.isNotEmpty) ...[
            const SizedBox(height: 14),
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: const Color(0xFFF7F8FB),
                borderRadius: BorderRadius.circular(12),
              ),
              child: Column(
                children: details
                    .map(
                      (detail) => Padding(
                        padding: const EdgeInsets.only(
                          bottom: 8,
                        ),
                        child: Row(
                          crossAxisAlignment:
                              CrossAxisAlignment.start,
                          children: [
                            SizedBox(
                              width: 125,
                              child: Text(
                                detail.key,
                                style: const TextStyle(
                                  fontWeight: FontWeight.w600,
                                  fontSize: 13,
                                  color: Colors.black87,
                                ),
                              ),
                            ),
                            Expanded(
                              child: Text(
                                detail.value,
                                style: TextStyle(
                                  color: Colors.grey.shade700,
                                  fontSize: 13,
                                ),
                              ),
                            ),
                          ],
                        ),
                      ),
                    )
                    .toList(),
              ),
            ),
          ],
          const SizedBox(height: 14),
          Row(
            children: [
              Expanded(
                child: OutlinedButton(
                  style: OutlinedButton.styleFrom(
                    foregroundColor: const Color(0xFFDC2626),
                    side: const BorderSide(color: Color(0xFFDC2626)),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(12),
                    ),
                  ),
                  onPressed: onReject,
                  child: const Text('Reject'),
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: ElevatedButton(
                  style: ElevatedButton.styleFrom(
                    backgroundColor: const Color(0xFF16A34A),
                    foregroundColor: Colors.white,
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(12),
                    ),
                  ),
                  onPressed: onApprove,
                  child: const Text('Approve'),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _StatusChip extends StatelessWidget {
  final String status;

  const _StatusChip({
    required this.status,
  });

  Color _colorFor(String status) {
    final normalized = status.toUpperCase();

    if (normalized.contains('APPROV')) {
      return const Color(0xFF16A34A);
    }

    if (normalized.contains('REJECT')) {
      return const Color(0xFFDC2626);
    }

    return const Color(0xFFD97706);
  }

  @override
  Widget build(BuildContext context) {
    final color = _colorFor(status);

    return Container(
      padding: const EdgeInsets.symmetric(
        horizontal: 10,
        vertical: 5,
      ),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(20),
        color: color.withValues(
          alpha: 0.12,
        ),
      ),
      child: Text(
        status,
        style: TextStyle(
          fontSize: 12,
          fontWeight: FontWeight.bold,
          color: color,
        ),
      ),
    );
  }
}