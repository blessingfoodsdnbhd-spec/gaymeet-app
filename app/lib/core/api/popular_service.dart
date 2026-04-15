import 'api_client.dart';

class PopularService {
  final ApiClient _client;
  PopularService(this._client);

  Future<List<Map<String, dynamic>>> getTodayLeaderboard() async {
    final res = await _client.dio.get('/popular/today');
    final List data = res.data is List ? res.data : (res.data['data'] ?? []);
    return data.cast<Map<String, dynamic>>();
  }

  Future<Map<String, dynamic>> getMyTickets() async {
    final res = await _client.dio.get('/popular/my-tickets');
    final d = res.data is Map ? res.data : res.data['data'] ?? {};
    return d is Map ? Map<String, dynamic>.from(d as Map) : {};
  }

  /// Vote for [targetUserId]. Caller spends 1 ticket.
  Future<Map<String, dynamic>> useTicketFor(String targetUserId) async {
    final res = await _client.dio.post(
      '/popular/ticket/use',
      data: {'targetUserId': targetUserId},
    );
    final d = res.data['data'] ?? res.data;
    return Map<String, dynamic>.from(d as Map);
  }

  Future<Map<String, dynamic>> purchaseTicket({int amount = 5}) async {
    final res = await _client.dio.post(
      '/popular/ticket/purchase',
      data: {'amount': amount},
    );
    final d = res.data['data'] ?? res.data;
    return Map<String, dynamic>.from(d as Map);
  }
}
