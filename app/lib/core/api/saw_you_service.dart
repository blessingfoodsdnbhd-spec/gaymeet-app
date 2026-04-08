import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'api_client.dart';
import '../providers/auth_provider.dart';

// ── Models ────────────────────────────────────────────────────────────────────

class PlateInfo {
  final bool exists;
  final bool isClaimed;
  final int messageCount;

  const PlateInfo({
    required this.exists,
    required this.isClaimed,
    required this.messageCount,
  });

  factory PlateInfo.fromJson(Map<String, dynamic> j) => PlateInfo(
        exists: j['exists'] as bool? ?? false,
        isClaimed: j['isClaimed'] as bool? ?? false,
        messageCount: j['messageCount'] as int? ?? 0,
      );
}

class PlateMessage {
  final String id;
  final String content;
  final bool isFullContent;
  final bool isRead;
  final bool isReported;
  final DateTime createdAt;

  const PlateMessage({
    required this.id,
    required this.content,
    required this.isFullContent,
    required this.isRead,
    required this.isReported,
    required this.createdAt,
  });

  factory PlateMessage.fromJson(Map<String, dynamic> j) => PlateMessage(
        id: j['id'] as String,
        content: j['content'] as String,
        isFullContent: j['isFullContent'] as bool? ?? true,
        isRead: j['isRead'] as bool? ?? false,
        isReported: j['isReported'] as bool? ?? false,
        createdAt: DateTime.parse(j['createdAt'] as String),
      );
}

class PlateInbox {
  final String? plateNumber;
  final String? carImageUrl;
  final List<PlateMessage> messages;

  const PlateInbox({
    this.plateNumber,
    this.carImageUrl,
    this.messages = const [],
  });

  factory PlateInbox.fromJson(Map<String, dynamic> j) => PlateInbox(
        plateNumber: j['plateNumber'] as String?,
        carImageUrl: j['carImageUrl'] as String?,
        messages: (j['messages'] as List? ?? [])
            .map((m) => PlateMessage.fromJson(m as Map<String, dynamic>))
            .toList(),
      );
}

// ── Service ───────────────────────────────────────────────────────────────────

class SawYouService {
  final ApiClient _client;
  SawYouService(this._client);

  Future<Map<String, dynamic>> claimPlate(
    String plateNumber, {
    String? carImageUrl,
  }) async {
    final res = await _client.dio.post('/plates/claim', data: {
      'plateNumber': plateNumber,
      if (carImageUrl != null) 'carImageUrl': carImageUrl,
    });
    return res.data as Map<String, dynamic>;
  }

  Future<Map<String, dynamic>> sendMessage(
    String plateNumber,
    String content,
  ) async {
    final res = await _client.dio.post('/plates/message', data: {
      'plateNumber': plateNumber,
      'content': content,
    });
    return res.data as Map<String, dynamic>;
  }

  Future<PlateInbox> getMessages() async {
    final res = await _client.dio.get('/plates/messages');
    return PlateInbox.fromJson(res.data as Map<String, dynamic>);
  }

  Future<PlateInfo> checkPlate(String plate) async {
    final normalised = plate.toUpperCase().replaceAll(RegExp(r'\s+'), '');
    final res = await _client.dio.get('/plates/check/$normalised');
    return PlateInfo.fromJson(res.data as Map<String, dynamic>);
  }

  Future<void> reportMessage(String messageId, String reason) async {
    await _client.dio.post(
      '/plates/messages/$messageId/report',
      data: {'reason': reason},
    );
  }

  Future<void> blockSender(String messageId) async {
    await _client.dio.post('/plates/messages/$messageId/block');
  }
}

// ── Provider ──────────────────────────────────────────────────────────────────

final sawYouServiceProvider = Provider<SawYouService>((ref) {
  return SawYouService(ref.watch(apiClientProvider));
});
