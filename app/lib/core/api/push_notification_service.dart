import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/foundation.dart';
import '../api/api_client.dart';

/// Handles FCM token registration + incoming push notifications.
/// Gracefully no-ops if Firebase was not initialized (e.g. missing config).
class PushNotificationService {
  final ApiClient _api;
  FirebaseMessaging? _messaging;

  // Callbacks for UI
  Function(String matchId, String userName)? onMatchNotification;
  Function(String matchId, String senderId)? onMessageNotification;

  PushNotificationService(this._api) {
    try {
      _messaging = FirebaseMessaging.instance;
    } catch (_) {
      // Firebase not configured — push notifications disabled
      debugPrint('FirebaseMessaging unavailable: push notifications disabled');
    }
  }

  /// Call once after Firebase.initializeApp()
  Future<void> initialize() async {
    if (_messaging == null) return;
    try {
      // 1. Request permission (iOS shows dialog, Android auto-grants)
      final settings = await _messaging!.requestPermission(
        alert: true,
        badge: true,
        sound: true,
      );
      debugPrint('FCM permission: ${settings.authorizationStatus}');

      if (settings.authorizationStatus == AuthorizationStatus.denied) {
        debugPrint('Push notifications denied by user');
        return;
      }

      // 2. Get FCM token and register with backend
      final token = await _messaging!.getToken();
      if (token != null) {
        await _registerToken(token);
      }

      // 3. Listen for token refresh
      _messaging!.onTokenRefresh.listen(_registerToken);

      // 4. Handle foreground messages
      FirebaseMessaging.onMessage.listen(_handleForegroundMessage);

      // 5. Handle background/terminated tap (user tapped notification)
      FirebaseMessaging.onMessageOpenedApp.listen(_handleNotificationTap);

      // 6. Check if app was opened from a terminated state notification
      final initialMessage = await _messaging!.getInitialMessage();
      if (initialMessage != null) {
        _handleNotificationTap(initialMessage);
      }
    } catch (e) {
      debugPrint('FCM initialize error: $e');
    }
  }

  /// Register token with backend
  Future<void> _registerToken(String token) async {
    try {
      await _api.dio.post('/notifications/token', data: {'token': token});
      debugPrint('FCM token registered: ${token.substring(0, 20)}...');
    } catch (e) {
      debugPrint('Failed to register FCM token: $e');
    }
  }

  /// Remove token on logout
  Future<void> unregister() async {
    try {
      await _api.dio.delete('/notifications/token');
    } catch (_) {}
  }

  /// Foreground message — app is open
  void _handleForegroundMessage(RemoteMessage message) {
    debugPrint('FCM foreground: ${message.notification?.title}');
    final type = message.data['type'];
    final matchId = message.data['matchId'];
    switch (type) {
      case 'new_match':
        onMatchNotification?.call(matchId ?? '', message.notification?.body ?? '');
        break;
      case 'new_message':
        onMessageNotification?.call(matchId ?? '', message.data['senderId'] ?? '');
        break;
      case 'new_like':
        debugPrint('New like received');
        break;
    }
  }

  /// User tapped notification (from background/terminated)
  void _handleNotificationTap(RemoteMessage message) {
    debugPrint('FCM tap: ${message.data}');
    final type = message.data['type'];
    final matchId = message.data['matchId'];
    switch (type) {
      case 'new_match':
      case 'new_message':
        if (matchId != null) {
          onMessageNotification?.call(matchId, '');
        }
        break;
    }
  }
}
