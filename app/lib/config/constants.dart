class AppConstants {
  static const String appName = 'Meetup Nearby';

  // ── API base URL ─────────────────────────────────────────────────────────────
  // To switch between environments use --dart-define when running:
  //   Local dev:   flutter run --dart-define=API_URL=http://localhost:3000
  //   Production (default): https://gaymeet-api.onrender.com
  //
  // For a release build:
  //   flutter build apk --release
  static const String _apiUrl = String.fromEnvironment(
    'API_URL',
    defaultValue: 'https://gaymeet-api.onrender.com',
  );

  static const String apiBaseUrl = '$_apiUrl/api';
  static const String wsUrl = _apiUrl;

  // Storage keys
  static const String accessTokenKey = 'access_token';
  static const String refreshTokenKey = 'refresh_token';

  // ── Social auth ──────────────────────────────────────────────────────────────
  // Set GOOGLE_CLIENT_ID via --dart-define when building, or leave empty to
  // disable Google Sign-In (button shows error snackbar if unconfigured).
  static const String googleClientId = String.fromEnvironment(
    'GOOGLE_CLIENT_ID',
    defaultValue: '',
  );

  // Defaults
  static const double defaultSearchRadius = 10.0; // km
  static const int nearbyPageSize = 20;
  static const int chatPageSize = 50;
}
