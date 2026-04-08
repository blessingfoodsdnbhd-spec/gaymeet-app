import 'api_client.dart';
import '../models/sticker.dart';

class StickersService {
  final ApiClient _client;
  StickersService(this._client);

  Future<List<StickerPack>> getAllPacks() async {
    final res = await _client.dio.get('/stickers');
    final list = res.data['data'] as List;
    return list.map((e) => StickerPack.fromJson(e as Map<String, dynamic>)).toList();
  }

  Future<List<StickerPack>> getOwnedPacks() async {
    final res = await _client.dio.get('/stickers/owned');
    final list = res.data['data'] as List;
    return list.map((e) => StickerPack.fromJson(e as Map<String, dynamic>)).toList();
  }

  Future<bool> purchase(String packId) async {
    try {
      await _client.dio.post('/stickers/$packId/purchase');
      return true;
    } catch (_) {
      return false;
    }
  }
}
