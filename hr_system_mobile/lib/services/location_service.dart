import 'package:geolocator/geolocator.dart';
import 'dart:math';

class LocationService {
  static const double officeLatitude = 19.0760;
  static const double officeLongitude = 72.8777;
  static const double allowedRadiusMeters = 100;

  // REQUEST LOCATION PERMISSION
  static Future<bool> requestLocationPermission() async {
    final permission = await Geolocator.requestPermission();
    
    switch (permission) {
      case LocationPermission.always:
      case LocationPermission.whileInUse:
        return true;
      case LocationPermission.denied:
      case LocationPermission.deniedForever:
      case LocationPermission.unableToDetermine:
        return false;
    }
  }

  // CALCULATE DISTANCE (Haversine formula)
  static double calculateDistance(
    double lat1,
    double lon1,
    double lat2,
    double lon2,
  ) {
    const double R = 6371000; // Earth radius in meters

    final double dLat = _toRadians(lat2 - lat1);
    final double dLon = _toRadians(lon2 - lon1);

    final double a = sin(dLat / 2) * sin(dLat / 2) +
        cos(_toRadians(lat1)) *
            cos(_toRadians(lat2)) *
            sin(dLon / 2) *
            sin(dLon / 2);

    final double c = 2 * atan2(sqrt(a), sqrt(1 - a));
    final double distance = R * c;

    return distance;
  }

  static double _toRadians(double degrees) {
    return degrees * pi / 180;
  }

  // DETECT MOCK LOCATION
  static Future<bool> isMockLocation(Map<String, dynamic> location) async {
    // Check 1: Accuracy too good (< 1 meter)
    if (location['accuracy'] != null && location['accuracy'] < 1) {
      return true;
    }

    // Check 2: Accuracy too bad (> 10km)
    if (location['accuracy'] != null && location['accuracy'] > 10000) {
      return true;
    }

    // Check 3: Null Island (0, 0)
    if (location['latitude'] == 0.0 && location['longitude'] == 0.0) {
      return true;
    }

    return false;
  }
}