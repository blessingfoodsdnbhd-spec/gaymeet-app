import '../models/gift.dart';
import 'api_client.dart';

class GiftsService {
  final ApiClient _client;
  GiftsService(this._client);

  Future<List<Gift>> getGifts() async {
    final res = await _client.dio.get('/gifts');
    final data = res.data['data'] as Map<String, dynamic>;
    final list = (data['gifts'] ?? []) as List;
    return list.map((j) => Gift.fromJson(j as Map<String, dynamic>)).toList();
  }

  Future<Map<String, dynamic>> sendGift({
    required String receiverId,
    required String giftId,
    String? message,
  }) async {
    final res = await _client.dio.post('/gifts/send', data: {
      'receiverId': receiverId,
      'giftId': giftId,
      if (message != null) 'message': message,
    });
    return res.data['data'] as Map<String, dynamic>;
  }

  Future<List<GiftTransaction>> getReceived() async {
    final res = await _client.dio.get('/gifts/received');
    final list = (res.data['data'] ?? res.data) as List;
    return list
        .map((j) => GiftTransaction.fromJson(j as Map<String, dynamic>))
        .toList();
  }

  Future<List<GiftTransaction>> getSent() async {
    final res = await _client.dio.get('/gifts/sent');
    final list = (res.data['data'] ?? res.data) as List;
    return list
        .map((j) => GiftTransaction.fromJson(j as Map<String, dynamic>))
        .toList();
  }

  Future<int> getCoinBalance() async {
    final res = await _client.dio.get('/gifts/coins/balance');
    return (res.data['data']['balance'] as num).toInt();
  }

  Future<Map<String, dynamic>> purchaseCoins(String packageId) async {
    final res = await _client.dio
        .post('/gifts/coins/purchase', data: {'package': packageId});
    return res.data['data'] as Map<String, dynamic>;
  }

  Future<List<CoinPackage>> getCoinPackages() async {
    final res = await _client.dio.get('/gifts/coins/packages');
    final list = (res.data['data'] ?? res.data) as List;
    return list
        .map((j) => CoinPackage.fromJson(j as Map<String, dynamic>))
        .toList();
  }
}
