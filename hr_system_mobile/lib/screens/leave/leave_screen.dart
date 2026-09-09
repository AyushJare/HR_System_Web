import 'package:flutter/material.dart';
import '../../services/leave_service.dart';

class LeaveScreen extends StatefulWidget {
  final bool openAttendanceCorrection;

  const LeaveScreen({super.key, this.openAttendanceCorrection = false});

  @override
  State<LeaveScreen> createState() => _LeaveScreenState();
}

class _LeaveScreenState extends State<LeaveScreen> {
  // Leave functionality intentionally disabled but preserved below.
  final correctionReasonController = TextEditingController();

  String correctionStatus = 'PRESENT';

  DateTime? correctionDate;
  TimeOfDay? correctionTimeIn;
  TimeOfDay? correctionTimeOut;

  bool isAttendanceCorrection = false;
  bool submitting = false;

  static const Color _brandGreen = Color(0xFF16A34A);
  static const Color _pageBg = Color(0xFFF4F6FB);

  @override
  void initState() {
    super.initState();
    isAttendanceCorrection = widget.openAttendanceCorrection;
  }

  @override
  void dispose() {
    correctionReasonController.dispose();
    super.dispose();
  }

  // ============================================================
  // ATTENDANCE QUERY DATE / TIME PICKERS
  // ============================================================

  Future<void> selectCorrectionDate() async {
    final now = DateTime.now();

    final selected = await showDatePicker(
      context: context,
      firstDate: now.subtract(const Duration(days: 365)),
      lastDate: now,
      initialDate: correctionDate ?? now,
    );

    if (selected == null || !mounted) return;

    setState(() {
      correctionDate = selected;
    });
  }

  Future<void> selectCorrectionTimeIn() async {
    final selected = await showTimePicker(
      context: context,
      initialTime: correctionTimeIn ?? TimeOfDay.now(),
    );

    if (selected == null || !mounted) return;

    setState(() {
      correctionTimeIn = selected;
    });
  }

  Future<void> selectCorrectionTimeOut() async {
    final selected = await showTimePicker(
      context: context,
      initialTime: correctionTimeOut ?? TimeOfDay.now(),
    );

    if (selected == null || !mounted) return;

    setState(() {
      correctionTimeOut = selected;
    });
  }

  String _formatTime(TimeOfDay? time) {
    if (time == null) return 'Select time';
    return time.format(context);
  }

  String _formatDate(DateTime? date) {
    if (date == null) {
      return 'Select date';
    }

    return '${date.day.toString().padLeft(2, '0')}/'
        '${date.month.toString().padLeft(2, '0')}/'
        '${date.year}';
  }

  void _showError(String message) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text(message), backgroundColor: Colors.red),
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

  InputDecoration _fieldDecoration({
    required String label,
    Widget? suffixIcon,
  }) {
    return InputDecoration(
      labelText: label,
      filled: true,
      fillColor: Colors.white,
      suffixIcon: suffixIcon,
      border: OutlineInputBorder(
        borderRadius: BorderRadius.circular(12),
        borderSide: BorderSide(color: Colors.grey.shade300),
      ),
      enabledBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(12),
        borderSide: BorderSide(color: Colors.grey.shade300),
      ),
      focusedBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(12),
        borderSide: const BorderSide(color: _brandGreen, width: 1.5),
      ),
    );
  }

  // ============================================================
  // SUBMIT ATTENDANCE CORRECTION / RAISE QUERY
  // ============================================================

  Future<void> submitAttendanceCorrection() async {
    FocusScope.of(context).unfocus();

    if (correctionDate == null) {
      _showError('Please select the attendance date.');
      return;
    }

    if (correctionReasonController.text.trim().isEmpty) {
      _showError('Please enter a reason for the attendance correction.');
      return;
    }

    if (submitting) return;

    setState(() {
      submitting = true;
    });

    try {
      await LeaveService.submitAttendanceCorrection(
        date: correctionDate!,
        timeIn: correctionTimeIn,
        timeOut: correctionTimeOut,
        status: correctionStatus,
        reason: correctionReasonController.text.trim(),
      );

      if (!mounted) return;

      correctionReasonController.clear();

      setState(() {
        correctionDate = null;
        correctionTimeIn = null;
        correctionTimeOut = null;
        correctionStatus = 'PRESENT';
        submitting = false;
      });

      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Attendance correction query submitted successfully.'),
        ),
      );
    } catch (e) {
      if (!mounted) return;

      setState(() {
        submitting = false;
      });

      _showError(e.toString().replaceFirst('Exception: ', ''));
    }
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
          'Raise Query',
          style: TextStyle(fontWeight: FontWeight.bold, color: Colors.black87),
        ),
      ),
      body: _contentView(),
    );
  }

  Widget _contentView() {
    return ListView(
      physics: const AlwaysScrollableScrollPhysics(),
      padding: const EdgeInsets.fromLTRB(20, 20, 20, 32),
      children: [
        _sectionLabel('RAISE ATTENDANCE QUERY'),
        const SizedBox(height: 8),
        Text(
          'Raise a query if your attendance needs to be corrected.',
          style: TextStyle(color: Colors.grey.shade600),
        ),
        const SizedBox(height: 16),
        Container(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(18),
            border: Border.all(color: Colors.grey.shade200),
          ),
          child: Column(
            children: [
              InkWell(
                borderRadius: BorderRadius.circular(12),
                onTap: submitting ? null : selectCorrectionDate,
                child: InputDecorator(
                  decoration: _fieldDecoration(
                    label: 'Attendance Date',
                    suffixIcon: const Icon(
                      Icons.calendar_today,
                      color: _brandGreen,
                      size: 20,
                    ),
                  ),
                  child: Text(_formatDate(correctionDate)),
                ),
              ),
              const SizedBox(height: 16),
              DropdownButtonFormField<String>(
                initialValue: correctionStatus,
                decoration: _fieldDecoration(label: 'Corrected Status'),
                items: const [
                  DropdownMenuItem(value: 'PRESENT', child: Text('Present')),
                  DropdownMenuItem(value: 'ABSENT', child: Text('Absent')),
                  DropdownMenuItem(value: 'HALF_DAY', child: Text('Half Day')),
                  DropdownMenuItem(value: 'ON_LEAVE', child: Text('On Leave')),
                ],
                onChanged: submitting
                    ? null
                    : (value) {
                        if (value == null) return;
                        setState(() {
                          correctionStatus = value;
                        });
                      },
              ),
              const SizedBox(height: 16),
              Row(
                children: [
                  Expanded(
                    child: InkWell(
                      borderRadius: BorderRadius.circular(12),
                      onTap: submitting ? null : selectCorrectionTimeIn,
                      child: InputDecorator(
                        decoration: _fieldDecoration(
                          label: 'Time In',
                          suffixIcon: const Icon(
                            Icons.access_time,
                            color: _brandGreen,
                            size: 20,
                          ),
                        ),
                        child: Text(_formatTime(correctionTimeIn)),
                      ),
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: InkWell(
                      borderRadius: BorderRadius.circular(12),
                      onTap: submitting ? null : selectCorrectionTimeOut,
                      child: InputDecorator(
                        decoration: _fieldDecoration(
                          label: 'Time Out',
                          suffixIcon: const Icon(
                            Icons.access_time,
                            color: _brandGreen,
                            size: 20,
                          ),
                        ),
                        child: Text(_formatTime(correctionTimeOut)),
                      ),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 16),
              TextField(
                controller: correctionReasonController,
                enabled: !submitting,
                maxLines: 4,
                decoration: _fieldDecoration(
                  label: 'Reason for Correction',
                ).copyWith(alignLabelWithHint: true),
              ),
            ],
          ),
        ),
        const SizedBox(height: 20),
        SizedBox(
          height: 52,
          child: ElevatedButton(
            style: ElevatedButton.styleFrom(
              backgroundColor: _brandGreen,
              foregroundColor: Colors.white,
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(14),
              ),
            ),
            onPressed: submitting ? null : submitAttendanceCorrection,
            child: submitting
                ? const SizedBox(
                    height: 24,
                    width: 24,
                    child: CircularProgressIndicator(
                      strokeWidth: 2,
                      color: Colors.white,
                    ),
                  )
                : const Text(
                    'Raise Attendance Query',
                    style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
                  ),
          ),
        ),
      ],
    );
  }
}

// ================================================================
// ORIGINAL CODE PRESERVED BELOW
// ================================================================
// The original file is kept intact below so no Leave functionality
// or code is deleted. Only the required Attendance Query code above
// is active.

// import 'package:flutter/material.dart';

// import '../../services/leave_service.dart';

// class LeaveScreen extends StatefulWidget {
//   final bool openAttendanceCorrection;

//   const LeaveScreen({super.key, this.openAttendanceCorrection = false});

//   @override
//   State<LeaveScreen> createState() => _LeaveScreenState();
// }

// class _LeaveScreenState extends State<LeaveScreen> {
//   final reasonController = TextEditingController();
//   final correctionReasonController = TextEditingController();

//   String leaveType = 'Casual Leave';
//   String correctionStatus = 'PRESENT';

//   DateTime? startDate;
//   DateTime? endDate;
//   DateTime? correctionDate;
//   TimeOfDay? correctionTimeIn;
//   TimeOfDay? correctionTimeOut;

//   bool isAttendanceCorrection = false;

//   // Backend now returns a LIST of leave balances.
//   List<Map<String, dynamic>> balances = [];

//   List<Map<String, dynamic>> requests = [];

//   bool loading = true;
//   bool submitting = false;
//   String? error;

//   static const Color _brandGreen = Color(0xFF16A34A);
//   static const Color _pageBg = Color(0xFFF4F6FB);

//   @override
//   void initState() {
//     super.initState();
//     isAttendanceCorrection = widget.openAttendanceCorrection;
//     loadLeaveData();
//   }

//   @override
//   void dispose() {
//     reasonController.dispose();
//     correctionReasonController.dispose();
//     super.dispose();
//   }

//   // ============================================================
//   // LOAD LEAVE DATA
//   // ============================================================

//   Future<void> loadLeaveData() async {
//     setState(() {
//       loading = true;
//       error = null;
//     });

//     try {
//       final balancesData = await LeaveService.getMyBalances();
//       final requestsData = await LeaveService.getMyRequests();

//       if (!mounted) return;

//       setState(() {
//         balances = balancesData;
//         requests = requestsData;
//         loading = false;
//       });
//     } catch (e) {
//       if (!mounted) return;

//       setState(() {
//         error = e.toString().replaceFirst('Exception: ', '');
//         loading = false;
//       });
//     }
//   }

//   // ============================================================
//   // DATE PICKERS
//   // ============================================================

//   Future<void> selectStartDate() async {
//     final now = DateTime.now();

//     final selected = await showDatePicker(
//       context: context,
//       firstDate: now,
//       lastDate: now.add(const Duration(days: 365)),
//       initialDate: startDate ?? now,
//     );

//     if (selected == null || !mounted) return;

//     setState(() {
//       startDate = selected;

//       if (endDate != null && endDate!.isBefore(selected)) {
//         endDate = null;
//       }
//     });
//   }

//   Future<void> selectEndDate() async {
//     final now = DateTime.now();
//     final firstDate = startDate ?? now;

//     final selected = await showDatePicker(
//       context: context,
//       firstDate: firstDate,
//       lastDate: now.add(const Duration(days: 365)),
//       initialDate: endDate ?? firstDate,
//     );

//     if (selected == null || !mounted) return;

//     setState(() {
//       endDate = selected;
//     });
//   }

//   Future<void> selectCorrectionDate() async {
//     final now = DateTime.now();

//     final selected = await showDatePicker(
//       context: context,
//       firstDate: now.subtract(const Duration(days: 365)),
//       lastDate: now,
//       initialDate: correctionDate ?? now,
//     );

//     if (selected == null || !mounted) return;

//     setState(() {
//       correctionDate = selected;
//     });
//   }

//   Future<void> selectCorrectionTimeIn() async {
//     final selected = await showTimePicker(
//       context: context,
//       initialTime: correctionTimeIn ?? TimeOfDay.now(),
//     );

//     if (selected == null || !mounted) return;

//     setState(() {
//       correctionTimeIn = selected;
//     });
//   }

//   Future<void> selectCorrectionTimeOut() async {
//     final selected = await showTimePicker(
//       context: context,
//       initialTime: correctionTimeOut ?? TimeOfDay.now(),
//     );

//     if (selected == null || !mounted) return;

//     setState(() {
//       correctionTimeOut = selected;
//     });
//   }

//   String _formatTime(TimeOfDay? time) {
//     if (time == null) return 'Select time';
//     return time.format(context);
//   }

//   String? _getSelectedLeaveTypeId() {
//     for (final balance in balances) {
//       final name = balance['name']?.toString().toLowerCase();

//       if (name == leaveType.toLowerCase()) {
//         return balance['leaveTypeId']?.toString();
//       }
//     }

//     return null;
//   }
//   // ============================================================
//   // SUBMIT LEAVE
//   // ============================================================

//   Future<void> submitLeave() async {
//     FocusScope.of(context).unfocus();

//     if (startDate == null) {
//       _showError('Please select a start date.');
//       return;
//     }

//     if (endDate == null) {
//       _showError('Please select an end date.');
//       return;
//     }

//     if (endDate!.isBefore(startDate!)) {
//       _showError('End date cannot be before start date.');
//       return;
//     }

//     if (reasonController.text.trim().isEmpty) {
//       _showError('Please enter a reason.');
//       return;
//     }

//     if (submitting) return;

//     setState(() {
//       submitting = true;
//     });

//     try {
//       final leaveTypeId = _getSelectedLeaveTypeId();

//       if (leaveTypeId == null) {
//         setState(() {
//           submitting = false;
//         });

//         _showError('Selected leave type is not available.');
//         return;
//       }

//       await LeaveService.submitLeave(
//         type: leaveType,
//         leaveTypeId: leaveTypeId,
//         fromDate: startDate!,
//         toDate: endDate!,
//         reason: reasonController.text,
//       );

//       if (!mounted) return;

//       reasonController.clear();

//       setState(() {
//         startDate = null;
//         endDate = null;
//         submitting = false;
//       });

//       ScaffoldMessenger.of(context).showSnackBar(
//         const SnackBar(
//           content: Text('Leave application submitted successfully.'),
//         ),
//       );

//       await loadLeaveData();
//     } catch (e) {
//       if (!mounted) return;

//       setState(() {
//         submitting = false;
//       });

//       _showError(e.toString().replaceFirst('Exception: ', ''));
//     }
//   }

//   Future<void> submitAttendanceCorrection() async {
//     FocusScope.of(context).unfocus();

//     if (correctionDate == null) {
//       _showError('Please select the attendance date.');
//       return;
//     }

//     if (correctionReasonController.text.trim().isEmpty) {
//       _showError('Please enter a reason for the attendance correction.');
//       return;
//     }

//     if (submitting) return;

//     setState(() {
//       submitting = true;
//     });

//     try {
//       await LeaveService.submitAttendanceCorrection(
//         date: correctionDate!,
//         timeIn: correctionTimeIn,
//         timeOut: correctionTimeOut,
//         status: correctionStatus,
//         reason: correctionReasonController.text.trim(),
//       );

//       if (!mounted) return;

//       correctionReasonController.clear();

//       setState(() {
//         correctionDate = null;
//         correctionTimeIn = null;
//         correctionTimeOut = null;
//         correctionStatus = 'PRESENT';
//         submitting = false;
//       });

//       ScaffoldMessenger.of(context).showSnackBar(
//         const SnackBar(
//           content: Text('Attendance correction query submitted successfully.'),
//         ),
//       );

//       await loadLeaveData();
//     } catch (e) {
//       if (!mounted) return;

//       setState(() {
//         submitting = false;
//       });

//       _showError(e.toString().replaceFirst('Exception: ', ''));
//     }
//   }

//   // ============================================================
//   // ERROR
//   // ============================================================

//   void _showError(String message) {
//     ScaffoldMessenger.of(context).showSnackBar(
//       SnackBar(content: Text(message), backgroundColor: Colors.red),
//     );
//   }

//   // ============================================================
//   // DATE FORMAT
//   // ============================================================

//   String _formatDate(DateTime? date) {
//     if (date == null) {
//       return 'Select date';
//     }

//     return '${date.day.toString().padLeft(2, '0')}/'
//         '${date.month.toString().padLeft(2, '0')}/'
//         '${date.year}';
//   }

//   // ============================================================
//   // FIND BALANCE BY LEAVE TYPE CODE
//   // ============================================================

//   String _balanceValue(String code, String fallback) {
//     for (final balance in balances) {
//       final balanceCode = balance['code']?.toString().toLowerCase();

//       if (balanceCode == code.toLowerCase()) {
//         return balance['remaining']?.toString() ?? fallback;
//       }
//     }

//     return fallback;
//   }

//   // ============================================================
//   // SECTION LABEL (matches dashboard style)
//   // ============================================================

//   Widget _sectionLabel(String text) {
//     return Row(
//       children: [
//         Container(
//           width: 4,
//           height: 18,
//           decoration: BoxDecoration(
//             color: _brandGreen,
//             borderRadius: BorderRadius.circular(2),
//           ),
//         ),
//         const SizedBox(width: 8),
//         Text(
//           text,
//           style: const TextStyle(
//             fontSize: 13,
//             fontWeight: FontWeight.bold,
//             letterSpacing: 0.8,
//             color: Colors.black87,
//           ),
//         ),
//       ],
//     );
//   }

//   InputDecoration _fieldDecoration({
//     required String label,
//     Widget? suffixIcon,
//   }) {
//     return InputDecoration(
//       labelText: label,
//       filled: true,
//       fillColor: Colors.white,
//       suffixIcon: suffixIcon,
//       border: OutlineInputBorder(
//         borderRadius: BorderRadius.circular(12),
//         borderSide: BorderSide(color: Colors.grey.shade300),
//       ),
//       enabledBorder: OutlineInputBorder(
//         borderRadius: BorderRadius.circular(12),
//         borderSide: BorderSide(color: Colors.grey.shade300),
//       ),
//       focusedBorder: OutlineInputBorder(
//         borderRadius: BorderRadius.circular(12),
//         borderSide: const BorderSide(color: _brandGreen, width: 1.5),
//       ),
//     );
//   }

//   // ============================================================
//   // BUILD
//   // ============================================================

//   @override
//   Widget build(BuildContext context) {
//     return Scaffold(
//       backgroundColor: _pageBg,
//       appBar: AppBar(
//         backgroundColor: Colors.white,
//         surfaceTintColor: Colors.white,
//         elevation: 0,
//         scrolledUnderElevation: 1,
//         shadowColor: Colors.black12,
//         title: const Text(
//           'Leave',
//           style: TextStyle(fontWeight: FontWeight.bold, color: Colors.black87),
//         ),
//         actions: [
//           IconButton(
//             onPressed: loading ? null : loadLeaveData,
//             icon: const Icon(Icons.refresh, color: Colors.black54),
//           ),
//         ],
//       ),
//       body: RefreshIndicator(
//         color: _brandGreen,
//         onRefresh: loadLeaveData,
//         child: loading
//             ? _loadingView()
//             : error != null
//             ? _errorView()
//             : _contentView(),
//       ),
//     );
//   }

//   // ============================================================
//   // LOADING VIEW
//   // ============================================================

//   Widget _loadingView() {
//     return ListView(
//       physics: const AlwaysScrollableScrollPhysics(),
//       children: const [
//         SizedBox(
//           height: 350,
//           child: Center(child: CircularProgressIndicator(color: _brandGreen)),
//         ),
//       ],
//     );
//   }

//   // ============================================================
//   // ERROR VIEW
//   // ============================================================

//   Widget _errorView() {
//     return ListView(
//       physics: const AlwaysScrollableScrollPhysics(),
//       padding: const EdgeInsets.all(20),
//       children: [
//         const SizedBox(height: 80),
//         Container(
//           padding: const EdgeInsets.all(20),
//           decoration: BoxDecoration(
//             color: Colors.white,
//             borderRadius: BorderRadius.circular(16),
//             border: Border.all(color: Colors.red.shade100),
//           ),
//           child: Column(
//             children: [
//               Icon(Icons.error_outline, color: Colors.red.shade400, size: 32),
//               const SizedBox(height: 12),
//               Text(
//                 error!,
//                 textAlign: TextAlign.center,
//                 style: TextStyle(
//                   color: Colors.red.shade600,
//                   fontSize: 15,
//                   fontWeight: FontWeight.w500,
//                 ),
//               ),
//             ],
//           ),
//         ),
//         const SizedBox(height: 20),
//         SizedBox(
//           height: 48,
//           child: ElevatedButton(
//             style: ElevatedButton.styleFrom(
//               backgroundColor: _brandGreen,
//               foregroundColor: Colors.white,
//               shape: RoundedRectangleBorder(
//                 borderRadius: BorderRadius.circular(12),
//               ),
//             ),
//             onPressed: loadLeaveData,
//             child: const Text('Retry'),
//           ),
//         ),
//       ],
//     );
//   }

//   // ============================================================
//   // CONTENT
//   // ============================================================

//   Widget _requestModeButton({
//     required String label,
//     required IconData icon,
//     required bool selected,
//     required VoidCallback? onTap,
//   }) {
//     return Material(
//       color: Colors.transparent,
//       child: InkWell(
//         borderRadius: BorderRadius.circular(11),
//         onTap: onTap,
//         child: Container(
//           padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 12),
//           decoration: BoxDecoration(
//             color: selected ? _brandGreen.withOpacity(0.1) : Colors.transparent,
//             borderRadius: BorderRadius.circular(11),
//           ),
//           child: Row(
//             mainAxisAlignment: MainAxisAlignment.center,
//             children: [
//               Icon(
//                 icon,
//                 size: 18,
//                 color: selected ? _brandGreen : Colors.grey.shade600,
//               ),
//               const SizedBox(width: 7),
//               Flexible(
//                 child: Text(
//                   label,
//                   overflow: TextOverflow.ellipsis,
//                   style: TextStyle(
//                     fontSize: 13,
//                     fontWeight: selected ? FontWeight.bold : FontWeight.w600,
//                     color: selected ? _brandGreen : Colors.grey.shade700,
//                   ),
//                 ),
//               ),
//             ],
//           ),
//         ),
//       ),
//     );
//   }

//   Widget _contentView() {
//     return ListView(
//       physics: const AlwaysScrollableScrollPhysics(),
//       padding: const EdgeInsets.fromLTRB(20, 20, 20, 32),
//       children: [
//         _sectionLabel('LEAVE BALANCE'),
//         const SizedBox(height: 14),

//         _buildBalanceCards(),

//         const SizedBox(height: 30),

//         _sectionLabel(
//           isAttendanceCorrection ? 'RAISE ATTENDANCE QUERY' : 'APPLY FOR LEAVE',
//         ),
//         const SizedBox(height: 8),

//         Text(
//           isAttendanceCorrection
//               ? 'Raise a query if your attendance needs to be corrected.'
//               : 'Submit a leave request to your administrator.',
//           style: TextStyle(color: Colors.grey.shade600),
//         ),

//         const SizedBox(height: 16),

//         Container(
//           padding: const EdgeInsets.all(4),
//           decoration: BoxDecoration(
//             color: Colors.white,
//             borderRadius: BorderRadius.circular(14),
//             border: Border.all(color: Colors.grey.shade200),
//           ),
//           child: Row(
//             children: [
//               Expanded(
//                 child: _requestModeButton(
//                   label: 'Apply Leave',
//                   icon: Icons.event_note_outlined,
//                   selected: !isAttendanceCorrection,
//                   onTap: submitting
//                       ? null
//                       : () {
//                           setState(() {
//                             isAttendanceCorrection = false;
//                           });
//                         },
//                 ),
//               ),
//               Expanded(
//                 child: _requestModeButton(
//                   label: 'Raise Query',
//                   icon: Icons.edit_note_outlined,
//                   selected: isAttendanceCorrection,
//                   onTap: submitting
//                       ? null
//                       : () {
//                           setState(() {
//                             isAttendanceCorrection = true;
//                           });
//                         },
//                 ),
//               ),
//             ],
//           ),
//         ),

//         const SizedBox(height: 20),

//         // ======================================================
//         // FORM CARD
//         // ======================================================
//         Container(
//           padding: const EdgeInsets.all(16),
//           decoration: BoxDecoration(
//             color: Colors.white,
//             borderRadius: BorderRadius.circular(18),
//             border: Border.all(color: Colors.grey.shade200),
//           ),
//           child: Column(
//             children: [
//               if (!isAttendanceCorrection) ...[
//                 // LEAVE TYPE
//                 DropdownButtonFormField<String>(
//                   initialValue: leaveType,
//                   decoration: _fieldDecoration(label: 'Leave Type'),
//                   items: balances
//                       .map(
//                         (balance) => DropdownMenuItem(
//                           value: balance['name']?.toString() ?? '',
//                           child: Text(balance['name']?.toString() ?? ''),
//                         ),
//                       )
//                       .toList(),
//                   onChanged: submitting
//                       ? null
//                       : (value) {
//                           if (value == null) return;

//                           setState(() {
//                             leaveType = value;
//                           });
//                         },
//                 ),

//                 const SizedBox(height: 16),

//                 InkWell(
//                   borderRadius: BorderRadius.circular(12),
//                   onTap: submitting ? null : selectStartDate,
//                   child: InputDecorator(
//                     decoration: _fieldDecoration(
//                       label: 'Start Date',
//                       suffixIcon: const Icon(
//                         Icons.calendar_today,
//                         color: _brandGreen,
//                         size: 20,
//                       ),
//                     ),
//                     child: Text(_formatDate(startDate)),
//                   ),
//                 ),

//                 const SizedBox(height: 16),

//                 InkWell(
//                   borderRadius: BorderRadius.circular(12),
//                   onTap: submitting ? null : selectEndDate,
//                   child: InputDecorator(
//                     decoration: _fieldDecoration(
//                       label: 'End Date',
//                       suffixIcon: const Icon(
//                         Icons.calendar_today,
//                         color: _brandGreen,
//                         size: 20,
//                       ),
//                     ),
//                     child: Text(_formatDate(endDate)),
//                   ),
//                 ),

//                 const SizedBox(height: 16),

//                 TextField(
//                   controller: reasonController,
//                   enabled: !submitting,
//                   maxLines: 4,
//                   decoration: _fieldDecoration(
//                     label: 'Reason',
//                   ).copyWith(alignLabelWithHint: true),
//                 ),
//               ] else ...[
//                 InkWell(
//                   borderRadius: BorderRadius.circular(12),
//                   onTap: submitting ? null : selectCorrectionDate,
//                   child: InputDecorator(
//                     decoration: _fieldDecoration(
//                       label: 'Attendance Date',
//                       suffixIcon: const Icon(
//                         Icons.calendar_today,
//                         color: _brandGreen,
//                         size: 20,
//                       ),
//                     ),
//                     child: Text(_formatDate(correctionDate)),
//                   ),
//                 ),

//                 const SizedBox(height: 16),

//                 DropdownButtonFormField<String>(
//                   initialValue: correctionStatus,
//                   decoration: _fieldDecoration(label: 'Corrected Status'),
//                   items: const [
//                     DropdownMenuItem(value: 'PRESENT', child: Text('Present')),
//                     DropdownMenuItem(value: 'ABSENT', child: Text('Absent')),
//                     DropdownMenuItem(
//                       value: 'HALF_DAY',
//                       child: Text('Half Day'),
//                     ),
//                     DropdownMenuItem(
//                       value: 'ON_LEAVE',
//                       child: Text('On Leave'),
//                     ),
//                   ],
//                   onChanged: submitting
//                       ? null
//                       : (value) {
//                           if (value == null) return;
//                           setState(() {
//                             correctionStatus = value;
//                           });
//                         },
//                 ),

//                 const SizedBox(height: 16),

//                 Row(
//                   children: [
//                     Expanded(
//                       child: InkWell(
//                         borderRadius: BorderRadius.circular(12),
//                         onTap: submitting ? null : selectCorrectionTimeIn,
//                         child: InputDecorator(
//                           decoration: _fieldDecoration(
//                             label: 'Time In',
//                             suffixIcon: const Icon(
//                               Icons.access_time,
//                               color: _brandGreen,
//                               size: 20,
//                             ),
//                           ),
//                           child: Text(_formatTime(correctionTimeIn)),
//                         ),
//                       ),
//                     ),
//                     const SizedBox(width: 12),
//                     Expanded(
//                       child: InkWell(
//                         borderRadius: BorderRadius.circular(12),
//                         onTap: submitting ? null : selectCorrectionTimeOut,
//                         child: InputDecorator(
//                           decoration: _fieldDecoration(
//                             label: 'Time Out',
//                             suffixIcon: const Icon(
//                               Icons.access_time,
//                               color: _brandGreen,
//                               size: 20,
//                             ),
//                           ),
//                           child: Text(_formatTime(correctionTimeOut)),
//                         ),
//                       ),
//                     ),
//                   ],
//                 ),

//                 const SizedBox(height: 16),

//                 TextField(
//                   controller: correctionReasonController,
//                   enabled: !submitting,
//                   maxLines: 4,
//                   decoration: _fieldDecoration(
//                     label: 'Reason for Correction',
//                   ).copyWith(alignLabelWithHint: true),
//                 ),
//               ],
//             ],
//           ),
//         ),

//         const SizedBox(height: 20),

//         // ======================================================
//         // SUBMIT
//         // ======================================================
//         SizedBox(
//           height: 52,
//           child: ElevatedButton(
//             style: ElevatedButton.styleFrom(
//               backgroundColor: _brandGreen,
//               foregroundColor: Colors.white,
//               shape: RoundedRectangleBorder(
//                 borderRadius: BorderRadius.circular(14),
//               ),
//             ),
//             onPressed: submitting
//                 ? null
//                 : (isAttendanceCorrection
//                       ? submitAttendanceCorrection
//                       : submitLeave),
//             child: submitting
//                 ? const SizedBox(
//                     height: 24,
//                     width: 24,
//                     child: CircularProgressIndicator(
//                       strokeWidth: 2,
//                       color: Colors.white,
//                     ),
//                   )
//                 : Text(
//                     isAttendanceCorrection
//                         ? 'Raise Attendance Query'
//                         : 'Submit Leave',
//                     style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
//                   ),
//           ),
//         ),

//         const SizedBox(height: 32),

//         // ======================================================
//         // REQUESTS
//         // ======================================================
//         _sectionLabel('MY REQUESTS'),

//         const SizedBox(height: 14),

//         if (requests.isEmpty)
//           _emptyRequests()
//         else
//           ...requests.map((request) => _LeaveRequestCard(request: request)),
//       ],
//     );
//   }

//   // ============================================================
//   // BALANCE CARDS
//   // ============================================================

//   Widget _buildBalanceCards() {
//     String balanceFor(String code) {
//       return _balanceValue(code, '-');
//     }

//     int totalRemaining = 0;

//     for (final balance in balances) {
//       final remaining =
//           int.tryParse(balance['remaining']?.toString() ?? '0') ?? 0;

//       totalRemaining += remaining;
//     }

//     return Column(
//       children: [
//         Row(
//           children: [
//             Expanded(
//               child: _BalanceCard(
//                 title: 'Casual',
//                 value: balanceFor('CL'),
//                 icon: Icons.wb_sunny_outlined,
//                 accentColor: const Color(0xFF2563EB),
//                 backgroundColor: const Color(0xFFEAF1FE),
//               ),
//             ),
//             const SizedBox(width: 12),
//             Expanded(
//               child: _BalanceCard(
//                 title: 'Sick',
//                 value: balanceFor('SL'),
//                 icon: Icons.healing_outlined,
//                 accentColor: const Color(0xFFDC2626),
//                 backgroundColor: const Color(0xFFFCEAEA),
//               ),
//             ),
//           ],
//         ),

//         const SizedBox(height: 12),

//         Row(
//           children: [
//             Expanded(
//               child: _BalanceCard(
//                 title: 'Earned',
//                 value: balanceFor('EL'),
//                 icon: Icons.savings_outlined,
//                 accentColor: const Color(0xFF16A34A),
//                 backgroundColor: const Color(0xFFE9F9EF),
//               ),
//             ),
//             const SizedBox(width: 12),
//             Expanded(
//               child: _BalanceCard(
//                 title: 'Total',
//                 value: totalRemaining.toString(),
//                 icon: Icons.event_available_outlined,
//                 accentColor: const Color(0xFF9333EA),
//                 backgroundColor: const Color(0xFFF3E9FD),
//               ),
//             ),
//           ],
//         ),
//       ],
//     );
//   }

//   // ============================================================
//   // EMPTY REQUESTS
//   // ============================================================

//   Widget _emptyRequests() {
//     return Container(
//       width: double.infinity,
//       padding: const EdgeInsets.all(24),
//       decoration: BoxDecoration(
//         color: Colors.white,
//         borderRadius: BorderRadius.circular(18),
//         border: Border.all(color: Colors.grey.shade200),
//       ),
//       child: Column(
//         children: [
//           Container(
//             width: 56,
//             height: 56,
//             decoration: BoxDecoration(
//               color: _brandGreen.withOpacity(0.1),
//               shape: BoxShape.circle,
//             ),
//             alignment: Alignment.center,
//             child: const Icon(
//               Icons.event_note_outlined,
//               size: 26,
//               color: _brandGreen,
//             ),
//           ),
//           const SizedBox(height: 14),
//           const Text(
//             'No requests',
//             style: TextStyle(
//               fontSize: 17,
//               fontWeight: FontWeight.bold,
//               color: Colors.black87,
//             ),
//           ),
//           const SizedBox(height: 6),
//           Text(
//             'Your submitted leave requests will appear here.',
//             textAlign: TextAlign.center,
//             style: TextStyle(color: Colors.grey.shade600),
//           ),
//         ],
//       ),
//     );
//   }
// }

// // ================================================================
// // BALANCE CARD
// // ================================================================

// class _BalanceCard extends StatelessWidget {
//   final String title;
//   final String value;
//   final IconData icon;
//   final Color accentColor;
//   final Color backgroundColor;

//   const _BalanceCard({
//     required this.title,
//     required this.value,
//     required this.icon,
//     required this.accentColor,
//     required this.backgroundColor,
//   });

//   @override
//   Widget build(BuildContext context) {
//     return Container(
//       padding: const EdgeInsets.all(16),
//       decoration: BoxDecoration(
//         color: backgroundColor,
//         borderRadius: BorderRadius.circular(16),
//         border: Border.all(color: accentColor.withOpacity(0.12)),
//       ),
//       child: Column(
//         crossAxisAlignment: CrossAxisAlignment.start,
//         children: [
//           Container(
//             width: 34,
//             height: 34,
//             decoration: BoxDecoration(
//               color: Colors.white,
//               borderRadius: BorderRadius.circular(10),
//               boxShadow: [
//                 BoxShadow(
//                   color: accentColor.withOpacity(0.15),
//                   blurRadius: 5,
//                   offset: const Offset(0, 3),
//                 ),
//               ],
//             ),
//             alignment: Alignment.center,
//             child: Icon(icon, size: 17, color: accentColor),
//           ),
//           const SizedBox(height: 10),
//           Text(
//             title,
//             style: TextStyle(color: Colors.grey.shade600, fontSize: 12.5),
//           ),
//           const SizedBox(height: 4),
//           Text(
//             value,
//             style: const TextStyle(
//               fontSize: 22,
//               fontWeight: FontWeight.bold,
//               color: Colors.black87,
//             ),
//           ),
//         ],
//       ),
//     );
//   }
// }

// // ================================================================
// // LEAVE REQUEST CARD
// // ================================================================

// class _LeaveRequestCard extends StatelessWidget {
//   final Map<String, dynamic> request;

//   const _LeaveRequestCard({required this.request});

//   @override
//   Widget build(BuildContext context) {
//     final isCorrection = request['type']?.toString() == 'ATTENDANCE_CORRECTION';

//     final title = isCorrection
//         ? 'Attendance Correction'
//         : (request['leaveType']?.toString() ??
//               request['type']?.toString() ??
//               'Leave');

//     final status = request['status']?.toString() ?? 'PENDING';
//     final reason = request['reason']?.toString() ?? '';

//     final date =
//         request['date']?.toString() ??
//         request['fromDate']?.toString() ??
//         request['startDate']?.toString() ??
//         '-';

//     final toDate =
//         request['toDate']?.toString() ?? request['endDate']?.toString() ?? date;

//     final timeIn = request['timeIn']?.toString();
//     final timeOut = request['timeOut']?.toString();
//     final requestedStatus = request['requestedStatus']?.toString();

//     return Container(
//       margin: const EdgeInsets.only(bottom: 12),
//       padding: const EdgeInsets.all(16),
//       decoration: BoxDecoration(
//         color: Colors.white,
//         borderRadius: BorderRadius.circular(16),
//         border: Border.all(color: Colors.grey.shade200),
//       ),
//       child: Column(
//         crossAxisAlignment: CrossAxisAlignment.start,
//         children: [
//           Row(
//             children: [
//               Container(
//                 width: 38,
//                 height: 38,
//                 decoration: BoxDecoration(
//                   color: const Color(0xFFEAF1FE),
//                   borderRadius: BorderRadius.circular(11),
//                 ),
//                 alignment: Alignment.center,
//                 child: Icon(
//                   isCorrection ? Icons.access_time : Icons.event_note,
//                   size: 19,
//                   color: const Color(0xFF2563EB),
//                 ),
//               ),
//               const SizedBox(width: 10),
//               Expanded(
//                 child: Text(
//                   title,
//                   style: const TextStyle(
//                     fontSize: 16,
//                     fontWeight: FontWeight.bold,
//                     color: Colors.black87,
//                   ),
//                 ),
//               ),
//               _StatusBadge(status: status),
//             ],
//           ),
//           const Divider(height: 24),
//           if (isCorrection) ...[
//             Text(
//               'Date: $date',
//               style: const TextStyle(fontWeight: FontWeight.w500),
//             ),
//             if (requestedStatus != null && requestedStatus.isNotEmpty) ...[
//               const SizedBox(height: 5),
//               Text(
//                 'Requested Status: $requestedStatus',
//                 style: const TextStyle(fontWeight: FontWeight.w500),
//               ),
//             ],
//             if (timeIn != null || timeOut != null) ...[
//               const SizedBox(height: 5),
//               Text(
//                 'Time: ${timeIn ?? '-'} → ${timeOut ?? '-'}',
//                 style: const TextStyle(fontWeight: FontWeight.w500),
//               ),
//             ],
//           ] else ...[
//             Text(
//               'From: $date',
//               style: const TextStyle(fontWeight: FontWeight.w500),
//             ),
//             const SizedBox(height: 5),
//             Text(
//               'To: $toDate',
//               style: const TextStyle(fontWeight: FontWeight.w500),
//             ),
//           ],
//           if (reason.isNotEmpty) ...[
//             const SizedBox(height: 10),
//             Text(
//               'Reason: $reason',
//               style: TextStyle(color: Colors.grey.shade700),
//             ),
//           ],
//         ],
//       ),
//     );
//   }
// }

// // ================================================================
// // STATUS BADGE
// // ================================================================

// class _StatusBadge extends StatelessWidget {
//   final String status;

//   const _StatusBadge({required this.status});

//   Color _colorFor(String status) {
//     final normalized = status.toUpperCase();

//     if (normalized.contains('APPROV')) {
//       return const Color(0xFF16A34A);
//     }

//     if (normalized.contains('REJECT')) {
//       return const Color(0xFFDC2626);
//     }

//     return const Color(0xFFD97706);
//   }

//   @override
//   Widget build(BuildContext context) {
//     final color = _colorFor(status);

//     return Container(
//       padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
//       decoration: BoxDecoration(
//         borderRadius: BorderRadius.circular(20),
//         color: color.withOpacity(0.12),
//       ),
//       child: Text(
//         status,
//         style: TextStyle(
//           fontWeight: FontWeight.bold,
//           fontSize: 12,
//           color: color,
//         ),
//       ),
//     );
//   }
// }
