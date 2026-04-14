import 'api_client.dart';
import '../models/business_profile.dart';

class BusinessService {
  final ApiClient _client;
  BusinessService(this._client);

  Future<BusinessProfile> register(Map<String, dynamic> data) async {
    final res = await _client.dio.post('/business/register', data: data);
    return BusinessProfile.fromJson(res.data['data']['profile'] as Map<String, dynamic>);
  }

  Future<BusinessProfile> getProfile() async {
    final res = await _client.dio.get('/business/profile');
    return BusinessProfile.fromJson(res.data['data']['profile'] as Map<String, dynamic>);
  }

  Future<BusinessProfile> updateProfile(Map<String, dynamic> data) async {
    final res = await _client.dio.patch('/business/profile', data: data);
    return BusinessProfile.fromJson(res.data['data']['profile'] as Map<String, dynamic>);
  }

  Future<Map<String, dynamic>> promote(String plan) async {
    final res = await _client.dio.post('/business/promote', data: {'plan': plan});
    return res.data['data'] as Map<String, dynamic>;
  }

  Future<Map<String, dynamic>> getDashboard() async {
    final res = await _client.dio.get('/business/dashboard');
    return res.data['data'] as Map<String, dynamic>;
  }

  Future<List<BusinessProfile>> getPromoted() async {
    final res = await _client.dio.get('/business/promoted');
    final list = res.data['data']['businesses'] as List<dynamic>;
    return list.map((b) => BusinessProfile.fromJson(b as Map<String, dynamic>)).toList();
  }
}
