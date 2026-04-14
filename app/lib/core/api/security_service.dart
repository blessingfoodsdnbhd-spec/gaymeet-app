import 'api_client.dart';

class SecurityService {
  final ApiClient _client;
  SecurityService(this._client);

  Future<bool> getTwoFactorStatus() async {
    final res = await _client.dio.get('/2fa/status');
    final data = res.data['data'] as Map<String, dynamic>? ?? res.data as Map<String, dynamic>;
    return data['isEnabled'] as bool? ?? false;
  }

  Future<Map<String, dynamic>> setup2FA() async {
    final res = await _client.dio.post('/2fa/setup');
    final data = res.data['data'] as Map<String, dynamic>? ?? res.data as Map<String, dynamic>;
    return data;
  }

  Future<List<String>> verify2FA(String code) async {
    final res = await _client.dio.post('/2fa/verify', data: {'code': code});
    final data = res.data['data'] as Map<String, dynamic>? ?? res.data as Map<String, dynamic>;
    final codes = data['backupCodes'] as List<dynamic>? ?? [];
    return codes.map((c) => c.toString()).toList();
  }

  Future<void> disable2FA(String password) async {
    await _client.dio.post('/2fa/disable', data: {'password': password});
  }

  Future<List<Map<String, dynamic>>> getDevices() async {
    final res = await _client.dio.get('/auth/devices');
    final data = res.data['data'] as Map<String, dynamic>? ?? res.data as Map<String, dynamic>;
    final devices = data['devices'] as List<dynamic>? ?? [];
    return devices.map((d) => d as Map<String, dynamic>).toList();
  }

  Future<void> removeDevice(String deviceId) async {
    await _client.dio.delete('/auth/devices/$deviceId');
  }

  Future<void> exportData() async {
    await _client.dio.get('/account/export');
  }

  Future<void> deleteAccount(String password) async {
    await _client.dio.delete('/account/delete', data: {'password': password});
  }
}
