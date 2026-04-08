import 'api_client.dart';

class SecretCodeService {
  final ApiClient _client;
  SecretCodeService(this._client);

  Future<Map<String, dynamic>> setCode(String code) async {
    final res = await _client.dio.post('/codes/set', data: {'code': code});
    return res.data['data'] as Map<String, dynamic>;
  }

  Future<Map<String, dynamic>?> getActiveCode() async {
    final res = await _client.dio.get('/codes/active');
    final data = res.data['data'];
    if (data == null) return null;
    return data as Map<String, dynamic>;
  }

  Future<void> cancelActiveCode() async {
    await _client.dio.delete('/codes/active');
  }

  Future<List<Map<String, dynamic>>> getHistory() async {
    final res = await _client.dio.get('/codes/history');
    final list = res.data['data'] as List;
    return list.cast<Map<String, dynamic>>();
  }
}
