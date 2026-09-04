import 'package:flutter/material.dart';

import '../../services/leave_service.dart';

class LeaveScreen extends StatefulWidget {
  const LeaveScreen({super.key});

  @override
  State<LeaveScreen> createState() => _LeaveScreenState();
}

class _LeaveScreenState extends State<LeaveScreen> {
  final reasonController = TextEditingController();

  String leaveType = 'Casual Leave';

  DateTime? startDate;
  DateTime? endDate;

  // Backend now returns a LIST of leave balances.
  List<Map<String, dynamic>> balances = [];

  List<Map<String, dynamic>> requests = [];

  bool loading = true;
  bool submitting = false;
  String? error;

  @override
  void initState() {
    super.initState();
    loadLeaveData();
  }

  @override
  void dispose() {
    reasonController.dispose();
    super.dispose();
  }

  // ============================================================
  // LOAD LEAVE DATA
  // ============================================================

  Future<void> loadLeaveData() async {
    setState(() {
      loading = true;
      error = null;
    });

    try {
      final balancesData = await LeaveService.getMyBalances();
      final requestsData = await LeaveService.getMyRequests();

      if (!mounted) return;

      setState(() {
        balances = balancesData;
        requests = requestsData;
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

  // ============================================================
  // DATE PICKERS
  // ============================================================

  Future<void> selectStartDate() async {
    final now = DateTime.now();

    final selected = await showDatePicker(
      context: context,
      firstDate: now,
      lastDate: now.add(
        const Duration(days: 365),
      ),
      initialDate: startDate ?? now,
    );

    if (selected == null || !mounted) return;

    setState(() {
      startDate = selected;

      if (endDate != null &&
          endDate!.isBefore(selected)) {
        endDate = null;
      }
    });
  }

  Future<void> selectEndDate() async {
    final now = DateTime.now();
    final firstDate = startDate ?? now;

    final selected = await showDatePicker(
      context: context,
      firstDate: firstDate,
      lastDate: now.add(
        const Duration(days: 365),
      ),
      initialDate: endDate ?? firstDate,
    );

    if (selected == null || !mounted) return;

    setState(() {
      endDate = selected;
    });
  }
  String? _getSelectedLeaveTypeId() {
  for (final balance in balances) {
    final name = balance['name']?.toString().toLowerCase();

    if (name == leaveType.toLowerCase()) {
      return balance['leaveTypeId']?.toString();
    }
  }

  return null;
}
  // ============================================================
  // SUBMIT LEAVE
  // ============================================================

  Future<void> submitLeave() async {
    FocusScope.of(context).unfocus();

    if (startDate == null) {
      _showError('Please select a start date.');
      return;
    }

    if (endDate == null) {
      _showError('Please select an end date.');
      return;
    }

    if (endDate!.isBefore(startDate!)) {
      _showError(
        'End date cannot be before start date.',
      );
      return;
    }

    if (reasonController.text.trim().isEmpty) {
      _showError('Please enter a reason.');
      return;
    }

    if (submitting) return;

    setState(() {
      submitting = true;
    });

    try {
      final leaveTypeId = _getSelectedLeaveTypeId();

      if (leaveTypeId == null) {
        setState(() {
          submitting = false;
        });

        _showError('Selected leave type is not available.');
        return;
      }

      await LeaveService.submitLeave(
        type: leaveType,
        leaveTypeId: leaveTypeId,
        fromDate: startDate!,
        toDate: endDate!,
        reason: reasonController.text,
      );

      if (!mounted) return;

      reasonController.clear();

      setState(() {
        startDate = null;
        endDate = null;
        submitting = false;
      });

      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text(
            'Leave application submitted successfully.',
          ),
        ),
      );

      await loadLeaveData();
    } catch (e) {
      if (!mounted) return;

      setState(() {
        submitting = false;
      });

      _showError(
        e.toString().replaceFirst(
              'Exception: ',
              '',
            ),
      );
    }
  }

  // ============================================================
  // ERROR
  // ============================================================

  void _showError(String message) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(message),
        backgroundColor: Colors.red,
      ),
    );
  }

  // ============================================================
  // DATE FORMAT
  // ============================================================

  String _formatDate(DateTime? date) {
    if (date == null) {
      return 'Select date';
    }

    return '${date.day.toString().padLeft(2, '0')}/'
        '${date.month.toString().padLeft(2, '0')}/'
        '${date.year}';
  }

  // ============================================================
  // FIND BALANCE BY LEAVE TYPE CODE
  // ============================================================

  String _balanceValue(
    String code,
    String fallback,
  ) {
    for (final balance in balances) {
      final balanceCode =
          balance['code']?.toString().toLowerCase();

      if (balanceCode == code.toLowerCase()) {
        return balance['remaining']?.toString() ??
            fallback;
      }
    }

    return fallback;
  }

  // ============================================================
  // BUILD
  // ============================================================

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Leave'),
        actions: [
          IconButton(
            onPressed: loading ? null : loadLeaveData,
            icon: const Icon(Icons.refresh),
          ),
        ],
      ),
      body: RefreshIndicator(
        onRefresh: loadLeaveData,
        child: loading
            ? _loadingView()
            : error != null
                ? _errorView()
                : _contentView(),
      ),
    );
  }

  // ============================================================
  // LOADING VIEW
  // ============================================================

  Widget _loadingView() {
    return ListView(
      physics: const AlwaysScrollableScrollPhysics(),
      children: const [
        SizedBox(
          height: 350,
          child: Center(
            child: CircularProgressIndicator(),
          ),
        ),
      ],
    );
  }

  // ============================================================
  // ERROR VIEW
  // ============================================================

  Widget _errorView() {
    return ListView(
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
          onPressed: loadLeaveData,
          child: const Text('Retry'),
        ),
      ],
    );
  }

  // ============================================================
  // CONTENT
  // ============================================================

  Widget _contentView() {
    return ListView(
      physics: const AlwaysScrollableScrollPhysics(),
      padding: const EdgeInsets.all(20),
      children: [
        const Text(
          'Leave Balance',
          style: TextStyle(
            fontSize: 24,
            fontWeight: FontWeight.bold,
          ),
        ),

        const SizedBox(height: 14),

        _buildBalanceCards(),

        const SizedBox(height: 30),

        const Text(
          'Apply for Leave',
          style: TextStyle(
            fontSize: 24,
            fontWeight: FontWeight.bold,
          ),
        ),

        const SizedBox(height: 8),

        Text(
          'Submit a leave request to your administrator.',
          style: TextStyle(
            color: Colors.grey.shade600,
          ),
        ),

        const SizedBox(height: 20),

        // ======================================================
        // LEAVE TYPE
        // ======================================================

        DropdownButtonFormField<String>(
          initialValue: leaveType,
          decoration: const InputDecoration(
            labelText: 'Leave Type',
            border: OutlineInputBorder(),
          ),
          items: balances
              .map(
                (balance) => DropdownMenuItem(
                  value: balance['name']?.toString() ?? '',
                  child: Text(
                    balance['name']?.toString() ?? '',
                  ),
                ),
              )
              .toList(),
          onChanged: submitting
              ? null
              : (value) {
                  if (value == null) return;

                  setState(() {
                    leaveType = value;
                  });
                },
        ),

        const SizedBox(height: 16),

        // ======================================================
        // START DATE
        // ======================================================

        InkWell(
          onTap: submitting ? null : selectStartDate,
          child: InputDecorator(
            decoration: const InputDecoration(
              labelText: 'Start Date',
              border: OutlineInputBorder(),
              suffixIcon: Icon(
                Icons.calendar_today,
              ),
            ),
            child: Text(
              _formatDate(startDate),
            ),
          ),
        ),

        const SizedBox(height: 16),

        // ======================================================
        // END DATE
        // ======================================================

        InkWell(
          onTap: submitting ? null : selectEndDate,
          child: InputDecorator(
            decoration: const InputDecoration(
              labelText: 'End Date',
              border: OutlineInputBorder(),
              suffixIcon: Icon(
                Icons.calendar_today,
              ),
            ),
            child: Text(
              _formatDate(endDate),
            ),
          ),
        ),

        const SizedBox(height: 16),

        // ======================================================
        // REASON
        // ======================================================

        TextField(
          controller: reasonController,
          enabled: !submitting,
          maxLines: 4,
          decoration: const InputDecoration(
            labelText: 'Reason',
            alignLabelWithHint: true,
            border: OutlineInputBorder(),
          ),
        ),

        const SizedBox(height: 20),

        // ======================================================
        // SUBMIT
        // ======================================================

        SizedBox(
          height: 52,
          child: ElevatedButton(
            onPressed: submitting ? null : submitLeave,
            child: submitting
                ? const SizedBox(
                    height: 24,
                    width: 24,
                    child: CircularProgressIndicator(
                      strokeWidth: 2,
                    ),
                  )
                : const Text(
                    'Submit Leave',
                    style: TextStyle(
                      fontSize: 16,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
          ),
        ),

        const SizedBox(height: 32),

        // ======================================================
        // REQUESTS
        // ======================================================

        const Text(
          'My Leave Requests',
          style: TextStyle(
            fontSize: 24,
            fontWeight: FontWeight.bold,
          ),
        ),

        const SizedBox(height: 14),

        if (requests.isEmpty)
          _emptyRequests()
        else
          ...requests.map(
            (request) => _LeaveRequestCard(
              request: request,
            ),
          ),
      ],
    );
  }

  // ============================================================
  // BALANCE CARDS
  // ============================================================

  Widget _buildBalanceCards() {
    String balanceFor(String code) {
      return _balanceValue(code, '-');
    }

    int totalRemaining = 0;

    for (final balance in balances) {
      final remaining = int.tryParse(
            balance['remaining']?.toString() ?? '0',
          ) ??
          0;

      totalRemaining += remaining;
    }

    return Column(
      children: [
        Row(
          children: [
            Expanded(
              child: _BalanceCard(
                title: 'Casual',
                value: balanceFor('CL'),
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: _BalanceCard(
                title: 'Sick',
                value: balanceFor('SL'),
              ),
            ),
          ],
        ),

        const SizedBox(height: 12),

        Row(
          children: [
            Expanded(
              child: _BalanceCard(
                title: 'Earned',
                value: balanceFor('EL'),
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: _BalanceCard(
                title: 'Total',
                value: totalRemaining.toString(),
              ),
            ),
          ],
        ),
      ],
    );
  }

  // ============================================================
  // EMPTY REQUESTS
  // ============================================================

  Widget _emptyRequests() {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          children: [
            const Icon(
              Icons.event_note_outlined,
              size: 50,
            ),
            const SizedBox(height: 12),
            const Text(
              'No leave requests',
              style: TextStyle(
                fontSize: 18,
                fontWeight: FontWeight.bold,
              ),
            ),
            const SizedBox(height: 6),
            Text(
              'Your submitted leave requests will appear here.',
              textAlign: TextAlign.center,
              style: TextStyle(
                color: Colors.grey.shade600,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

// ================================================================
// BALANCE CARD
// ================================================================

class _BalanceCard extends StatelessWidget {
  final String title;
  final String value;

  const _BalanceCard({
    required this.title,
    required this.value,
  });

  @override
  Widget build(BuildContext context) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment:
              CrossAxisAlignment.start,
          children: [
            Text(
              title,
              style: TextStyle(
                color: Colors.grey.shade600,
              ),
            ),
            const SizedBox(height: 8),
            Text(
              value,
              style: const TextStyle(
                fontSize: 24,
                fontWeight: FontWeight.bold,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

// ================================================================
// LEAVE REQUEST CARD
// ================================================================

class _LeaveRequestCard extends StatelessWidget {
  final Map<String, dynamic> request;

  const _LeaveRequestCard({
    required this.request,
  });

  @override
  Widget build(BuildContext context) {
    final type =
        request['type']?.toString() ??
        request['leaveType']?.toString() ??
        'Leave';

    final status =
        request['status']?.toString() ??
        'Pending';

    final reason =
        request['reason']?.toString() ??
        '';

    final fromDate =
        request['fromDate']?.toString() ??
        request['startDate']?.toString() ??
        '-';

    final toDate =
        request['toDate']?.toString() ??
        request['endDate']?.toString() ??
        '-';

    return Card(
      margin: const EdgeInsets.only(bottom: 12),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment:
              CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                const Icon(
                  Icons.event_note,
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: Text(
                    type,
                    style: const TextStyle(
                      fontSize: 17,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                ),
                _StatusBadge(
                  status: status,
                ),
              ],
            ),

            const Divider(height: 24),

            Text(
              'From: $fromDate',
              style: const TextStyle(
                fontWeight: FontWeight.w500,
              ),
            ),

            const SizedBox(height: 5),

            Text(
              'To: $toDate',
              style: const TextStyle(
                fontWeight: FontWeight.w500,
              ),
            ),

            if (reason.isNotEmpty) ...[
              const SizedBox(height: 10),
              Text(
                'Reason: $reason',
              ),
            ],
          ],
        ),
      ),
    );
  }
}

// ================================================================
// STATUS BADGE
// ================================================================

class _StatusBadge extends StatelessWidget {
  final String status;

  const _StatusBadge({
    required this.status,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(
        horizontal: 10,
        vertical: 6,
      ),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(20),
        color: Colors.grey.shade200,
      ),
      child: Text(
        status,
        style: const TextStyle(
          fontWeight: FontWeight.w600,
        ),
      ),
    );
  }
}