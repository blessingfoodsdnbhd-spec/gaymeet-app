import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'api_client.dart';
import '../providers/auth_provider.dart';

/// Service for moderation actions: blocking and reporting users.
///
/// Backend API contract:
///
/// POST /users/:id/block
///   → { "data": {} }
///   Blocks the user. Backend should also remove any mutual match and
///   prevent the blocked user from appearing in discovery/nearby.
///
/// POST /users/:id/report
///   Body: { "reason": "harassment" }
///   → { "data": {} }
///   Valid reasons: inappropriate_photos, harassment, spam, fake_profile,
///                 underage, other
class BlockReportService {
  final ApiClient _api;

  BlockReportService(this._api);

  /// Block [userId]. Throws on network or server error.
  Future<void> block(String userId) async {
    await _api.dio.post('/users/$userId/block');
  }

  /// Report [userId] with a [reason] slug. Throws on network or server error.
  Future<void> report(String userId, String reason) async {
    await _api.dio.post('/users/$userId/report', data: {'reason': reason});
  }
}

final blockReportServiceProvider = Provider<BlockReportService>((ref) {
  return BlockReportService(ref.watch(apiClientProvider));
});
