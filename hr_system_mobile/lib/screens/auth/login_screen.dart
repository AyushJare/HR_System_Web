import 'package:flutter/material.dart';
import '../../services/auth_service.dart';
import 'package:package_info_plus/package_info_plus.dart';

class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key});

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final emailController = TextEditingController();
  final passwordController = TextEditingController();

  bool loading = false;
  String? error;
  String appVersion = '';

  // ============================================================
  // FORGOT PASSWORD
  // ============================================================

  bool showForgotPassword = false;

  final forgotFirstNameController = TextEditingController();
  final forgotEmployeeCodeController = TextEditingController();
  final forgotMobileController = TextEditingController();
  final forgotNewPasswordController = TextEditingController();
  final forgotConfirmPasswordController = TextEditingController();

  bool forgotLoading = false;
  String? forgotError;
  String? forgotSuccess;

  @override
  void initState() {
    super.initState();
    _loadAppVersion();
  }

  Future<void> _loadAppVersion() async {
    final info = await PackageInfo.fromPlatform();

    if (!mounted) return;

    setState(() {
      appVersion = info.version;
    });
  }

  Future<void> handleLogin() async {
    FocusScope.of(context).unfocus();

    final email = emailController.text.trim();
    final password = passwordController.text;

    if (email.isEmpty) {
      setState(() {
        error = 'Please enter your email.';
      });
      return;
    }

    if (password.isEmpty) {
      setState(() {
        error = 'Please enter your password.';
      });
      return;
    }

    setState(() {
      loading = true;
      error = null;
    });

    try {
      final result = await AuthService.login(email, password);

      if (!mounted) return;

      Navigator.pushReplacementNamed(context, '/dashboard');
    } catch (e) {
      if (!mounted) return;

      setState(() {
        error = e.toString().replaceFirst('Exception: ', '');
      });
    } finally {
      if (mounted) {
        setState(() {
          loading = false;
        });
      }
    }
  }

  // ============================================================
  // FORGOT PASSWORD
  // ============================================================

  Future<void> handleForgotPassword() async {
    FocusScope.of(context).unfocus();

    final firstName = forgotFirstNameController.text.trim();
    final employeeCode = forgotEmployeeCodeController.text.trim();
    final mobile = forgotMobileController.text.trim();
    final newPassword = forgotNewPasswordController.text;
    final confirmPassword = forgotConfirmPasswordController.text;

    if (firstName.isEmpty) {
      setState(() {
        forgotError = 'Please enter your first name.';
        forgotSuccess = null;
      });
      return;
    }

    if (employeeCode.isEmpty) {
      setState(() {
        forgotError = 'Please enter your employee code.';
        forgotSuccess = null;
      });
      return;
    }

    if (mobile.isEmpty) {
      setState(() {
        forgotError = 'Please enter your mobile number.';
        forgotSuccess = null;
      });
      return;
    }

    if (newPassword.isEmpty) {
      setState(() {
        forgotError = 'Please enter your new password.';
        forgotSuccess = null;
      });
      return;
    }

    if (confirmPassword.isEmpty) {
      setState(() {
        forgotError = 'Please confirm your new password.';
        forgotSuccess = null;
      });
      return;
    }

    if (newPassword != confirmPassword) {
      setState(() {
        forgotError = 'New password and confirm password do not match.';
        forgotSuccess = null;
      });
      return;
    }

    setState(() {
      forgotLoading = true;
      forgotError = null;
      forgotSuccess = null;
    });

    try {
      final result = await AuthService.forgotPassword(
        firstName: firstName,
        employeeCode: employeeCode,
        mobile: mobile,
        newPassword: newPassword,
      );

      if (!mounted) return;

      setState(() {
        forgotSuccess =
            result['message']?.toString() ?? 'Password changed successfully.';
      });

      forgotFirstNameController.clear();
      forgotEmployeeCodeController.clear();
      forgotMobileController.clear();
      forgotNewPasswordController.clear();
      forgotConfirmPasswordController.clear();
    } catch (e) {
      if (!mounted) return;

      setState(() {
        forgotError = e.toString().replaceFirst('Exception: ', '');
      });
    } finally {
      if (mounted) {
        setState(() {
          forgotLoading = false;
        });
      }
    }
  }

  // ============================================================
  // OPEN FORGOT PASSWORD
  // ============================================================

  void openForgotPassword() {
    setState(() {
      showForgotPassword = true;
      error = null;
      forgotError = null;
      forgotSuccess = null;
    });
  }

  // ============================================================
  // BACK TO LOGIN
  // ============================================================

  void backToLogin() {
    setState(() {
      showForgotPassword = false;
      forgotError = null;
      forgotSuccess = null;
    });

    forgotFirstNameController.clear();
    forgotEmployeeCodeController.clear();
    forgotMobileController.clear();
    forgotNewPasswordController.clear();
    forgotConfirmPasswordController.clear();
  }

  @override
  void dispose() {
    emailController.dispose();
    passwordController.dispose();

    forgotFirstNameController.dispose();
    forgotEmployeeCodeController.dispose();
    forgotMobileController.dispose();
    forgotNewPasswordController.dispose();
    forgotConfirmPasswordController.dispose();

    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.white,
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(24),
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 420),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.center,
                children: [
                  Image.asset(
                    'assets/images/vmc-logo.png',
                    height: 80,
                    width: 80,
                    errorBuilder: (context, error, stackTrace) {
                      // Fallback to text if image not found
                      return Container(
                        width: 80,
                        height: 80,
                        alignment: Alignment.center,
                        decoration: BoxDecoration(
                          color: Colors.white,
                          border: Border.all(
                            color: Colors.green.shade600,
                            width: 2,
                          ),
                          borderRadius: BorderRadius.circular(16),
                        ),
                        child: Text(
                          'VMC',
                          style: TextStyle(
                            color: Colors.green.shade600,
                            fontSize: 26,
                            fontWeight: FontWeight.bold,
                            letterSpacing: 1,
                          ),
                        ),
                      );
                    },
                  ),

                  const SizedBox(height: 24),

                  const Text(
                    'VMC',
                    textAlign: TextAlign.center,
                    style: TextStyle(
                      fontSize: 32,
                      fontWeight: FontWeight.bold,
                      letterSpacing: 2,
                    ),
                  ),

                  if (appVersion.isNotEmpty)
                    Text(
                      'v$appVersion',
                      textAlign: TextAlign.center,
                      style: const TextStyle(
                        fontSize: 9,
                        color: Colors.grey,
                        fontWeight: FontWeight.w400,
                        letterSpacing: 0.5,
                      ),
                    ),

                  const SizedBox(height: 8),

                  Text(
                    showForgotPassword
                        ? 'Reset your password'
                        : 'Sign in to your account',
                    textAlign: TextAlign.center,
                    style: const TextStyle(color: Colors.grey, fontSize: 14),
                  ),

                  const SizedBox(height: 32),

                  if (showForgotPassword) ...[
                    // ==================================================
                    // FIRST NAME
                    // ==================================================
                    TextField(
                      controller: forgotFirstNameController,
                      textInputAction: TextInputAction.next,
                      decoration: const InputDecoration(
                        labelText: 'First Name',
                        border: OutlineInputBorder(),
                      ),
                    ),

                    const SizedBox(height: 16),

                    // ==================================================
                    // EMPLOYEE CODE
                    // ==================================================
                    TextField(
                      controller: forgotEmployeeCodeController,
                      keyboardType: TextInputType.text,
                      textInputAction: TextInputAction.next,
                      decoration: const InputDecoration(
                        labelText: 'Employee Code',
                        border: OutlineInputBorder(),
                      ),
                    ),

                    const SizedBox(height: 16),

                    // ==================================================
                    // MOBILE NUMBER
                    // ==================================================
                    TextField(
                      controller: forgotMobileController,
                      keyboardType: TextInputType.phone,
                      textInputAction: TextInputAction.next,
                      decoration: const InputDecoration(
                        labelText: 'Mobile Number',
                        border: OutlineInputBorder(),
                      ),
                    ),

                    const SizedBox(height: 16),

                    // ==================================================
                    // NEW PASSWORD
                    // ==================================================
                    TextField(
                      controller: forgotNewPasswordController,
                      obscureText: true,
                      textInputAction: TextInputAction.next,
                      decoration: const InputDecoration(
                        labelText: 'New Password',
                        border: OutlineInputBorder(),
                      ),
                    ),

                    const SizedBox(height: 16),

                    // ==================================================
                    // CONFIRM PASSWORD
                    // ==================================================
                    TextField(
                      controller: forgotConfirmPasswordController,
                      obscureText: true,
                      textInputAction: TextInputAction.done,
                      onSubmitted: (_) {
                        if (!forgotLoading) {
                          handleForgotPassword();
                        }
                      },
                      decoration: const InputDecoration(
                        labelText: 'Confirm New Password',
                        border: OutlineInputBorder(),
                      ),
                    ),

                    if (forgotError != null) ...[
                      const SizedBox(height: 16),
                      Text(
                        forgotError!,
                        textAlign: TextAlign.center,
                        style: const TextStyle(color: Colors.red, fontSize: 14),
                      ),
                    ],

                    if (forgotSuccess != null) ...[
                      const SizedBox(height: 16),
                      Text(
                        forgotSuccess!,
                        textAlign: TextAlign.center,
                        style: const TextStyle(
                          color: Colors.green,
                          fontSize: 14,
                        ),
                      ),
                    ],

                    const SizedBox(height: 24),

                    // ==================================================
                    // CHANGE PASSWORD BUTTON
                    // ==================================================
                    SizedBox(
                      height: 52,
                      child: ElevatedButton(
                        onPressed: forgotLoading ? null : handleForgotPassword,
                        child: forgotLoading
                            ? const SizedBox(
                                width: 22,
                                height: 22,
                                child: CircularProgressIndicator(
                                  strokeWidth: 2,
                                ),
                              )
                            : const Text(
                                'Change Password',
                                style: TextStyle(
                                  fontSize: 16,
                                  fontWeight: FontWeight.bold,
                                ),
                              ),
                      ),
                    ),

                    const SizedBox(height: 8),

                    // ==================================================
                    // BACK TO LOGIN
                    // ==================================================
                    TextButton(
                      onPressed: forgotLoading ? null : backToLogin,
                      child: const Text(
                        '← Back to Login',
                        style: TextStyle(
                          fontSize: 14,
                          fontWeight: FontWeight.w500,
                        ),
                      ),
                    ),
                  ] else ...[
                    // ==================================================
                    // EMAIL
                    // ==================================================
                    TextField(
                      controller: emailController,
                      keyboardType: TextInputType.emailAddress,
                      decoration: const InputDecoration(
                        labelText: 'Email',
                        border: OutlineInputBorder(),
                      ),
                    ),

                    const SizedBox(height: 16),

                    // ==================================================
                    // PASSWORD
                    // ==================================================
                    TextField(
                      controller: passwordController,
                      obscureText: true,
                      decoration: const InputDecoration(
                        labelText: 'Password',
                        border: OutlineInputBorder(),
                      ),
                    ),

                    // ==================================================
                    // FORGOT PASSWORD
                    // ==================================================
                    Align(
                      alignment: Alignment.centerRight,
                      child: TextButton(
                        onPressed: loading ? null : openForgotPassword,
                        child: const Text(
                          'Forgot Password?',
                          style: TextStyle(
                            fontSize: 14,
                            fontWeight: FontWeight.w500,
                          ),
                        ),
                      ),
                    ),

                    if (error != null) ...[
                      const SizedBox(height: 8),
                      Text(
                        error!,
                        textAlign: TextAlign.center,
                        style: const TextStyle(color: Colors.red, fontSize: 14),
                      ),
                    ],

                    const SizedBox(height: 16),

                    // ==================================================
                    // SIGN IN BUTTON
                    // ==================================================
                    SizedBox(
                      height: 52,
                      child: ElevatedButton(
                        onPressed: loading ? null : handleLogin,
                        child: loading
                            ? const SizedBox(
                                width: 22,
                                height: 22,
                                child: CircularProgressIndicator(
                                  strokeWidth: 2,
                                ),
                              )
                            : const Text(
                                'Sign In',
                                style: TextStyle(
                                  fontSize: 16,
                                  fontWeight: FontWeight.bold,
                                ),
                              ),
                      ),
                    ),
                  ],
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}
