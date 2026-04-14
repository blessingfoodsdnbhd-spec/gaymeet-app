import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:image_picker/image_picker.dart';
import 'api_client.dart';
import '../providers/auth_provider.dart';

/// Service for private/locked photo operations.
class PrivatePhotosService {
  final ApiClient _api;
  final _picker = ImagePicker();

  PrivatePhotosService(this._api);

  /// Upload a private photo. Returns the CDN URL.
  Future<String> uploadPrivatePhoto(XFile file) async {
    final bytes = await file.readAsBytes();
    final ext = file.name.split('.').last.toLowerCase();
    final mediaSubtype = ext == 'jpg' ? 'jpeg' : ext;

    final formData = FormData.fromMap({
      'photo': MultipartFile.fromBytes(
        bytes,
        filename: file.name.isNotEmpty ? file.name : 'photo.$ext',
        contentType: DioMediaType('image', mediaSubtype),
      ),
    });

    final res = await _api.dio.post('/users/private-photos', data: formData);
    return res.data['data']['url'] as String;
  }

  /// Delete a private photo by URL.
  Future<void> deletePrivatePhoto(String url) async {
    await _api.dio.delete('/users/private-photos', data: {'url': url});
  }

  /// Send a request to unlock another user's private photos.
  Future<Map<String, dynamic>> requestPhotos(String userId) async {
    final res = await _api.dio.post('/users/$userId/request-photos');
    return res.data['data'] as Map<String, dynamic>;
  }

  /// Fetch incoming unlock requests (pending only).
  Future<List<dynamic>> fetchInbox() async {
    final res = await _api.dio.get('/photo-requests/inbox');
    return res.data['data']['requests'] as List;
  }

  /// Respond to a request (approve/reject).
  Future<void> respond(String requestId, String status) async {
    await _api.dio.post('/photo-requests/$requestId/respond', data: {'status': status});
  }

  /// Get private photos for a user (returns photos + access status).
  Future<Map<String, dynamic>> getPrivatePhotos(String userId) async {
    final res = await _api.dio.get('/users/$userId/private-photos');
    return res.data['data'] as Map<String, dynamic>;
  }

  /// My sent requests + statuses.
  Future<List<dynamic>> fetchSentRequests() async {
    final res = await _api.dio.get('/photo-requests/sent');
    return res.data['data']['requests'] as List;
  }

  /// Pick an image from gallery.
  Future<XFile?> pickImage() {
    return _picker.pickImage(
      source: ImageSource.gallery,
      maxWidth: 1080,
      maxHeight: 1080,
      imageQuality: 85,
    );
  }
}

final privatePhotosServiceProvider = Provider<PrivatePhotosService>((ref) {
  return PrivatePhotosService(ref.watch(apiClientProvider));
});
