class User {
  final String id;
  final String fullName;
  final String email;
  final String role; // 'ADMIN' or 'EMPLOYEE'
  final String? mobile;
  final String? department;
  final String? designation;
  final String? userType;

  User({
    required this.id,
    required this.fullName,
    required this.email,
    required this.role,
    this.mobile,
    this.department,
    this.designation,
    this.userType,
  });

  factory User.fromJson(Map<String, dynamic> json) {
    return User(
      id: json['id'] ?? '',
      fullName: json['fullName'] ?? '',
      email: json['email'] ?? '',
      role: json['role'] ?? 'EMPLOYEE',
      mobile: json['mobile'],
      department: json['department']?['name'],
      designation: json['designation']?['name'],
      userType: json['userType']?['name'],
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'fullName': fullName,
      'email': email,
      'role': role,
      'mobile': mobile,
      'department': department,
      'designation': designation,
      'userType': userType,
    };
  }
}