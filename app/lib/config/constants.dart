class AppConstants {
  static const String appName = 'GayMeet';

  // ── API base URL ─────────────────────────────────────────────────────────────
  // To switch between environments use --dart-define when running:
  //   Local dev (default):  flutter run
  //   Production:           flutter run --dart-define=API_URL=https://gaymeet-backend.onrender.com
  //
  // For a release build pointing at production:
  //   flutter build apk --dart-define=API_URL=https://gaymeet-backend.onrender.com
  static const String _apiUrl = String.fromEnvironment(
    'API_URL',
    defaultValue: 'http://localhost:3000',
  );

  static const String apiBaseUrl = '$_apiUrl/api';
  static const String wsUrl = '$_apiUrl';

  // Storage keys
  static const String accessTokenKey = 'access_token';
  static const String refreshTokenKey = 'refresh_token';

  // Defaults
  static const double defaultSearchRadius = 10.0; // km
  static const int nearbyPageSize = 20;
  static const int chatPageSize = 50;
}
