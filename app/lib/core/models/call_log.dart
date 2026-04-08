class CallLog {
  final String id;
  final CallUser caller;
  final CallUser receiver;
  final String type; // 'voice' | 'video'
  final String status; // 'missed' | 'answered' | 'declined' | 'ended'
  final int duration; // seconds
  final bool isOutgoing;
  final CallUser otherUser;
  final DateTime createdAt;

  const CallLog({
    required this.id,
    required this.caller,
    required this.receiver,
    required this.type,
    required this.status,
    required this.duration,
    required this.isOutgoing,
    required this.otherUser,
    required this.createdAt,
  });

  bool get isMissed => status == 'missed' || status == 'declined';
  bool get isVideo => type == 'video';

  String get durationLabel {
    if (duration == 0) return '';
    final m = duration ~/ 60;
    final s = duration % 60;
    return '${m.toString().padLeft(2, '0')}:${s.toString().padLeft(2, '0')}';
  }

  factory CallLog.fromJson(Map<String, dynamic> json) {
    final callerData = json['caller'] as Map<String, dynamic>? ?? {};
    final receiverData = json['receiver'] as Map<String, dynamic>? ?? {};
    final otherData = json['otherUser'] as Map<String, dynamic>? ?? callerData;

    return CallLog(
      id: json['_id'] ?? json['id'] ?? '',
      caller: CallUser.fromJson(callerData),
      receiver: CallUser.fromJson(receiverData),
      type: json['type'] ?? 'voice',
      status: json['status'] ?? 'missed',
      duration: json['duration'] ?? 0,
      isOutgoing: json['isOutgoing'] ?? false,
      otherUser: CallUser.fromJson(otherData),
      createdAt: json['createdAt'] != null
          ? DateTime.tryParse(json['createdAt']) ?? DateTime.now()
          : DateTime.now(),
    );
  }
}

class CallUser {
  final String id;
  final String nickname;
  final String? avatarUrl;

  const CallUser({
    required this.id,
    required this.nickname,
    this.avatarUrl,
  });

  factory CallUser.fromJson(Map<String, dynamic> json) => CallUser(
        id: json['_id'] ?? json['id'] ?? '',
        nickname: json['nickname'] ?? '',
        avatarUrl: json['avatarUrl'],
      );
}
