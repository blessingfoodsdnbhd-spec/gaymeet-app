import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:image_picker/image_picker.dart';
import 'api_client.dart';
import '../providers/auth_provider.dart';

/// Service for all photo-related operations.
///
/// Backend API contract:
///
/// POST   /users/photos            multipart/form-data, field: "photo" (file)
///   → { "data": { "url": "https://..." } }
///
/// DELETE /users/photos            JSON body: { "url": "https://..." }
///   → { "data": {} }
///
/// PATCH  /users/photos/reorder    JSON body: { "photos": ["url1", "url2", ...] }
///   → { "data": { "photos": [...], "avatarUrl": "url1" } }
///   First URL becomes the primary avatar.
class PhotoService {
  final ApiClient _api;
  final _picker = ImagePicker();

  PhotoService(this._api);

  /// Show the system image picker. Pass [fromCamera] to open the camera.
  /// Returns null if the user cancels.
  Future<XFile?> pickImage({bool fromCamera = false}) {
    return _picker.pickImage(
      source: fromCamera ? ImageSource.camera : ImageSource.gallery,
      maxWidth: 1080,
      maxHeight: 1080,
      imageQuality: 85,
    );
  }

  /// Upload [file] and return the resulting CDN URL.
  Future<String> uploadPhoto(XFile file) async {
    final bytes = await file.readAsBytes();
    final nameParts = file.name.split('.');
    final ext = nameParts.length > 1 ? nameParts.last.toLowerCase() : 'jpeg';
    final mediaSubtype = ext == 'jpg' ? 'jpeg' : ext;

    final formData = FormData.fromMap({
      'photo': MultipartFile.fromBytes(
        bytes,
        filename: file.name.isNotEmpty ? file.name : 'photo.$ext',
        contentType: DioMediaType('image', mediaSubtype),
      ),
    });

    final response = await _api.dio.post('/users/photos', data: formData);
    return response.data['data']['url'] as String;
  }

  /// Permanently remove a photo by its URL.
  Future<void> deletePhoto(String photoUrl) async {
    await _api.dio.delete('/users/photos', data: {'url': photoUrl});
  }

  /// Persist a new photo order. The first URL becomes the primary avatar.
  Future<void> reorderPhotos(List<String> orderedUrls) async {
    await _api.dio.patch('/users/photos/reorder', data: {'photos': orderedUrls});
  }
}

final photoServiceProvider = Provider<PhotoService>((ref) {
  return PhotoService(ref.watch(apiClientProvider));
});
