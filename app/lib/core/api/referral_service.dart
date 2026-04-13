import 'api_client.dart';

class ReferralStats {
  final int referralCount;
  final int activeReferrals;
  final double totalEarned;
  final double walletBalance;
  final double totalWithdrawn;
  final double pendingCommission;

  const ReferralStats({
    this.referralCount = 0,
    this.activeReferrals = 0,
    this.totalEarned = 0,
    this.walletBalance = 0,
    this.totalWithdrawn = 0,
    this.pendingCommission = 0,
  });

  factory ReferralStats.fromJson(Map<String, dynamic> j) => ReferralStats(
        referralCount: j['referralCount'] ?? 0,
        activeReferrals: j['activeReferrals'] ?? 0,
        totalEarned: (j['totalEarned'] ?? 0).toDouble(),
        walletBalance: (j['walletBalance'] ?? 0).toDouble(),
        totalWithdrawn: (j['totalWithdrawn'] ?? 0).toDouble(),
        pendingCommission: (j['pendingCommission'] ?? 0).toDouble(),
      );
}

class ReferralEntry {
  final String userId;
  final String nickname;
  final String? avatarUrl;
  final DateTime joinDate;
  final String status;
  final double totalCommission;

  const ReferralEntry({
    required this.userId,
    required this.nickname,
    this.avatarUrl,
    required this.joinDate,
    required this.status,
    required this.totalCommission,
  });

  factory ReferralEntry.fromJson(Map<String, dynamic> j) => ReferralEntry(
        userId: j['userId'] ?? '',
        nickname: j['nickname'] ?? 'Unknown',
        avatarUrl: j['avatarUrl'],
        joinDate: DateTime.tryParse(j['joinDate'] ?? '') ?? DateTime.now(),
        status: j['status'] ?? 'pending',
        totalCommission: (j['totalCommission'] ?? 0).toDouble(),
      );
}

class WalletTransaction {
  final String type; // 'commission' | 'withdrawal'
  final double amount;
  final String currency;
  final String status;
  final String? fromUserNickname;
  final String? fromUserAvatar;
  final String? method;
  final DateTime createdAt;

  const WalletTransaction({
    required this.type,
    required this.amount,
    required this.currency,
    required this.status,
    this.fromUserNickname,
    this.fromUserAvatar,
    this.method,
    required this.createdAt,
  });

  factory WalletTransaction.fromJson(Map<String, dynamic> j) => WalletTransaction(
        type: j['type'] ?? 'commission',
        amount: (j['amount'] ?? 0).toDouble(),
        currency: j['currency'] ?? 'MYR',
        status: j['status'] ?? 'pending',
        fromUserNickname: j['fromUser']?['nickname'],
        fromUserAvatar: j['fromUser']?['avatarUrl'],
        method: j['method'],
        createdAt: DateTime.tryParse(j['createdAt'] ?? '') ?? DateTime.now(),
      );
}

class WithdrawalRecord {
  final String id;
  final double amount;
  final String method;
  final String accountDetails;
  final String status;
  final DateTime? processedAt;
  final DateTime createdAt;

  const WithdrawalRecord({
    required this.id,
    required this.amount,
    required this.method,
    required this.accountDetails,
    required this.status,
    this.processedAt,
    required this.createdAt,
  });

  factory WithdrawalRecord.fromJson(Map<String, dynamic> j) => WithdrawalRecord(
        id: j['_id'] ?? '',
        amount: (j['amount'] ?? 0).toDouble(),
        method: j['method'] ?? 'bank_transfer',
        accountDetails: j['accountDetails'] ?? '',
        status: j['status'] ?? 'pending',
        processedAt: j['processedAt'] != null ? DateTime.tryParse(j['processedAt']) : null,
        createdAt: DateTime.tryParse(j['createdAt'] ?? '') ?? DateTime.now(),
      );
}

class ReferralService {
  final ApiClient _api;
  ReferralService(this._api);

  Future<Map<String, dynamic>> getCode() async {
    final res = await _api.dio.get('/referrals/code');
    return res.data['data'] as Map<String, dynamic>;
  }

  Future<ReferralStats> getStats() async {
    final res = await _api.dio.get('/referrals/stats');
    return ReferralStats.fromJson(res.data['data']);
  }

  Future<List<ReferralEntry>> getList() async {
    final res = await _api.dio.get('/referrals/list');
    final list = res.data['data']['referrals'] as List<dynamic>;
    return list.map((e) => ReferralEntry.fromJson(e as Map<String, dynamic>)).toList();
  }

  Future<bool> applyCode(String code, {String? deviceFingerprint}) async {
    final res = await _api.dio.post('/referrals/apply', data: {
      'referralCode': code,
      if (deviceFingerprint != null) 'deviceFingerprint': deviceFingerprint,
    });
    return res.data['data']?['success'] == true;
  }

  Future<Map<String, dynamic>> getWallet() async {
    final res = await _api.dio.get('/referrals/wallet');
    return res.data['data'] as Map<String, dynamic>;
  }

  Future<Map<String, dynamic>> requestWithdrawal({
    required double amount,
    required String method,
    required String accountDetails,
  }) async {
    final res = await _api.dio.post('/referrals/withdraw', data: {
      'amount': amount,
      'method': method,
      'accountDetails': accountDetails,
    });
    return res.data['data'] as Map<String, dynamic>;
  }

  Future<List<WithdrawalRecord>> getWithdrawals() async {
    final res = await _api.dio.get('/referrals/withdrawals');
    final list = res.data['data']['withdrawals'] as List<dynamic>;
    return list.map((e) => WithdrawalRecord.fromJson(e as Map<String, dynamic>)).toList();
  }
}
