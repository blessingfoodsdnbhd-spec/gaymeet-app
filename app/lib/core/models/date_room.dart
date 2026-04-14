class DateRoomUser {
  final String id;
  final String nickname;
  final String? avatarUrl;
  final bool isVerified;

  const DateRoomUser({
    required this.id,
    required this.nickname,
    this.avatarUrl,
    this.isVerified = false,
  });

  factory DateRoomUser.fromJson(Map<String, dynamic> j) => DateRoomUser(
        id: j['_id'] ?? '',
        nickname: j['nickname'] ?? '',
        avatarUrl: j['avatarUrl'],
        isVerified: j['isVerified'] ?? false,
      );
}

class DateRoom {
  final String id;
  final DateRoomUser host;
  final DateRoomUser? guest;
  final String status; // waiting | active | ended
  final int durationMinutes;
  final int coinCost;
  final DateTime? startedAt;
  final DateTime? endedAt;
  final String? inviteCode;
  final DateTime createdAt;

  const DateRoom({
    required this.id,
    required this.host,
    this.guest,
    required this.status,
    required this.durationMinutes,
    required this.coinCost,
    this.startedAt,
    this.endedAt,
    this.inviteCode,
    required this.createdAt,
  });

  factory DateRoom.fromJson(Map<String, dynamic> j) => DateRoom(
        id: j['_id'] ?? '',
        host: DateRoomUser.fromJson(j['host'] as Map<String, dynamic>),
        guest: j['guest'] is Map
            ? DateRoomUser.fromJson(j['guest'] as Map<String, dynamic>)
            : null,
        status: j['status'] ?? 'waiting',
        durationMinutes: (j['durationMinutes'] as num).toInt(),
        coinCost: (j['coinCost'] as num).toInt(),
        startedAt: j['startedAt'] != null ? DateTime.tryParse(j['startedAt']) : null,
        endedAt: j['endedAt'] != null ? DateTime.tryParse(j['endedAt']) : null,
        inviteCode: j['inviteCode'],
        createdAt: DateTime.tryParse(j['createdAt'] ?? '') ?? DateTime.now(),
      );

  Duration get remainingDuration {
    if (startedAt == null) return Duration(minutes: durationMinutes);
    final elapsed = DateTime.now().difference(startedAt!);
    final total = Duration(minutes: durationMinutes);
    return total - elapsed;
  }

  bool get isActive => status == 'active';
  bool get isWaiting => status == 'waiting';
  bool get isEnded => status == 'ended';
}

const Map<int, int> kDateRoomCosts = {15: 50, 30: 80, 60: 120};
