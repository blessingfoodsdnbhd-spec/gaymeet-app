import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../api/api_client.dart';
import '../api/socket_service.dart';
import '../api/push_notification_service.dart';
import '../models/user.dart';

final apiClientProvider = Provider<ApiClient>((ref) => ApiClient());
final socketServiceProvider = Provider<SocketService>((ref) => SocketService());
final pushServiceProvider = Provider<PushNotificationService>((ref) {
  return PushNotificationService(ref.watch(apiClientProvider));
});

final authStateProvider =
    StateNotifierProvider<AuthNotifier, AuthState>((ref) {
  return AuthNotifier(
    ref.watch(apiClientProvider),
    ref.watch(socketServiceProvider),
    ref.watch(pushServiceProvider),
  );
});

class AuthState {
  final bool isLoading;
  final bool isLoggedIn;
  final UserModel? user;
  final String? error;

  const AuthState({
    this.isLoading = false,
    this.isLoggedIn = false,
    this.user,
    this.error,
  });

  AuthState copyWith({
    bool? isLoading,
    bool? isLoggedIn,
    UserModel? user,
    String? error,
  }) {
    return AuthState(
      isLoading: isLoading ?? this.isLoading,
      isLoggedIn: isLoggedIn ?? this.isLoggedIn,
      user: user ?? this.user,
      error: error,
    );
  }
}

class AuthNotifier extends StateNotifier<AuthState> {
  final ApiClient _api;
  final SocketService _socket;
  final PushNotificationService _push;

  AuthNotifier(this._api, this._socket, this._push) : super(const AuthState());

  Future<void> checkAuth() async {
    final token = await _api.getAccessToken();
    if (token != null) {
      try {
        final response = await _api.dio.get('/users/me');
        final user = UserModel.fromJson(response.data['data']);
        _socket.connect(token);
        _push.initialize(); // Register FCM token with backend
        state = AuthState(isLoggedIn: true, user: user);
      } catch (_) {
        await _api.clearTokens();
        state = const AuthState(isLoggedIn: false);
      }
    }
  }

  Future<bool> register(String email, String password, String nickname,
      {String? referralCode}) async {
    state = state.copyWith(isLoading: true, error: null);
    try {
      final response = await _api.dio.post('/auth/register', data: {
        'email': email,
        'password': password,
        'nickname': nickname,
        if (referralCode != null && referralCode.isNotEmpty)
          'referralCode': referralCode,
      });
      final data = response.data['data'];
      await _api.saveTokens(data['accessToken'], data['refreshToken']);
      final user = UserModel.fromJson(data['user']);
      _socket.connect(data['accessToken']);
      _push.initialize();
      state = AuthState(isLoggedIn: true, user: user);
      return true;
    } catch (e) {
      state = state.copyWith(isLoading: false, error: _parseError(e));
      return false;
    }
  }

  // ── Social / OTP login helper ─────────────────────────────────────────────
  Future<bool> _socialLogin(String path, Map<String, dynamic> data) async {
    state = state.copyWith(isLoading: true, error: null);
    try {
      final response = await _api.dio.post(path, data: data);
      final d = response.data['data'];
      await _api.saveTokens(d['accessToken'], d['refreshToken']);
      final user = UserModel.fromJson(d['user']);
      _socket.connect(d['accessToken']);
      _push.initialize();
      state = AuthState(isLoggedIn: true, user: user);
      return true;
    } catch (e) {
      state = state.copyWith(isLoading: false, error: _parseError(e));
      return false;
    }
  }

  Future<bool> loginWithGoogle(String idToken) =>
      _socialLogin('/auth/google', {'idToken': idToken});

  Future<bool> loginWithApple(String identityToken, {String? name}) =>
      _socialLogin('/auth/apple', {
        'identityToken': identityToken,
        if (name != null && name.isNotEmpty) 'name': name,
      });

  Future<bool> loginWithOtp(String email, String code) =>
      _socialLogin('/auth/verify-otp', {'email': email, 'code': code});

  Future<bool> login(String email, String password) async {
    state = state.copyWith(isLoading: true, error: null);
    try {
      final response = await _api.dio.post('/auth/login', data: {
        'email': email,
        'password': password,
      });
      final data = response.data['data'];
      await _api.saveTokens(data['accessToken'], data['refreshToken']);
      final user = UserModel.fromJson(data['user']);
      _socket.connect(data['accessToken']);
      _push.initialize();
      state = AuthState(isLoggedIn: true, user: user);
      return true;
    } catch (e) {
      state = state.copyWith(isLoading: false, error: _parseError(e));
      return false;
    }
  }

  /// Optimistically update the local photos list without a round-trip to the
  /// server. Call after upload/delete/reorder so the UI reflects changes
  /// immediately.
  void updatePhotos(List<String> photos) {
    final user = state.user;
    if (user == null) return;
    state = state.copyWith(user: user.copyWith(photos: photos));
  }

  /// PATCH /users/me with arbitrary fields (lookingFor, etc.)
  Future<bool> updateProfile(Map<String, dynamic> updates) async {
    try {
      final res = await _api.dio.patch('/users/me', data: updates);
      final updated = UserModel.fromJson(res.data['data']);
      state = state.copyWith(user: updated);
      return true;
    } catch (_) {
      return false;
    }
  }

  Future<void> logout() async {
    await _push.unregister();
    try {
      await _api.dio.post('/auth/logout');
    } catch (_) {}
    _socket.disconnect();
    await _api.clearTokens();
    state = const AuthState(isLoggedIn: false);
  }

  String _parseError(dynamic e) {
    if (e is DioException) {
      final data = e.response?.data;
      if (data is Map) {
        final msg = data['error'] ?? data['message'];
        if (msg is String && msg.isNotEmpty) return msg;
      }
    }
    if (e is Exception) {
      return e.toString().replaceAll('Exception: ', '');
    }
    return 'Something went wrong';
  }
}
