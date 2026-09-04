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
          title: Text(title),
          content: TextField(
            controller: controller,
            maxLines: 3,
            decoration: const InputDecoration(
              labelText: 'Reason',
              border: OutlineInputBorder(),
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
      appBar: AppBar(
        title: const Text('Approvals'),
        actions: [
          IconButton(
            onPressed: loading ? null : loadApprovals,
            icon: const Icon(Icons.refresh),
          ),
        ],
        bottom: TabBar(
          controller: tabController,
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
              child: CircularProgressIndicator(),
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
      onRefresh: loadApprovals,
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
            onPressed: loadApprovals,
            child: const Text('Retry'),
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
    );
  }

  Widget _approvalList(
    List<Map<String, dynamic>> approvals,
    String type,
    IconData icon,
  ) {
    return RefreshIndicator(
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
      onRefresh: loadApprovals,
      child: ListView(
        physics: const AlwaysScrollableScrollPhysics(),
        children: [
          const SizedBox(height: 150),
          const Icon(
            Icons.check_circle_outline,
            size: 60,
          ),
          const SizedBox(height: 16),
          Center(
            child: Text(
              message,
              textAlign: TextAlign.center,
              style: const TextStyle(
                fontSize: 18,
                fontWeight: FontWeight.w600,
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
  final VoidCallback onApprove;
  final VoidCallback onReject;

  const _ApprovalCard({
    required this.title,
    required this.requestType,
    required this.details,
    required this.status,
    required this.icon,
    required this.onApprove,
    required this.onReject,
  });

  @override
  Widget build(BuildContext context) {
    return Card(
      margin: const EdgeInsets.only(
        bottom: 12,
      ),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              crossAxisAlignment:
                  CrossAxisAlignment.start,
              children: [
                CircleAvatar(
                  child: Icon(icon),
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
                          fontSize: 17,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                      const SizedBox(height: 4),
                      Text(
                        requestType,
                        style: const TextStyle(
                          fontWeight: FontWeight.w600,
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
              const SizedBox(height: 16),
              const Divider(),
              const SizedBox(height: 8),
              ...details.map(
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
                          ),
                        ),
                      ),
                      Expanded(
                        child: Text(
                          detail.value,
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ],
            const SizedBox(height: 8),
            const Divider(),
            const SizedBox(height: 8),
            Row(
              children: [
                Expanded(
                  child: OutlinedButton(
                    onPressed: onReject,
                    child: const Text('Reject'),
                  ),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: ElevatedButton(
                    onPressed: onApprove,
                    child: const Text('Approve'),
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

class _StatusChip extends StatelessWidget {
  final String status;

  const _StatusChip({
    required this.status,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(
        horizontal: 10,
        vertical: 5,
      ),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(20),
        color: Colors.orange.withValues(
          alpha: 0.15,
        ),
      ),
      child: Text(
        status,
        style: const TextStyle(
          fontSize: 12,
          fontWeight: FontWeight.bold,
        ),
      ),
    );
  }
}