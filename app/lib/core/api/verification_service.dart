import 'dart:io';
import 'package:dio/dio.dart';
import 'api_client.dart';

class VerificationService {
  final ApiClient _client;
  VerificationService(this._client);

  Future<String> getPose() async {
    final res = await _client.dio.get('/verification/pose');
    return res.data['data']['pose'] as String;
  }

  Future<String> getPhrase() async {
    final res = await _client.dio.get('/verification/phrase');
    return res.data['data']['phrase'] as String;
  }

  Future<Map<String, dynamic>> getStatus() async {
    final res = await _client.dio.get('/verification/status');
    return res.data['data'] as Map<String, dynamic>;
  }

  Future<void> submit({required File selfie, required String pose}) async {
    final formData = FormData.fromMap({
      'pose': pose,
      'selfie': await MultipartFile.fromFile(
        selfie.path,
        filename: 'selfie.jpg',
      ),
    });
    await _client.dio.post('/verification/submit', data: formData);
  }

  Future<void> submitVideo({required File video, required String pose}) async {
    final formData = FormData.fromMap({
      'pose': pose,
      'video': await MultipartFile.fromFile(
        video.path,
        filename: 'verification.mp4',
      ),
    });
    await _client.dio.post('/verification/submit-video', data: formData);
  }
}
