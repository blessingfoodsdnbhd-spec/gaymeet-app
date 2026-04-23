class DirectMessage {
  final String id;
  final DmUser sender;
  final DmUser receiver;
  final String content;
  final int cost;
  final bool isRead;
  final bool isAccepted;
  final bool blurred;
  final DateTime createdAt;
  final List<DmReply> replies;

  const DirectMessage({
    required this.id,
    required this.sender,
    required this.receiver,
    required this.content,
    required this.cost,
    required this.isRead,
    required this.isAccepted,
    required this.blurred,
    required this.createdAt,
    this.replies = const [],
  });

  factory DirectMessage.fromJson(Map<String, dynamic> json) {
    return DirectMessage(
      id: json['_id'] ?? json['id'] ?? '',
      sender: DmUser.fromJson(json['sender'] as Map<String, dynamic>),
      receiver: DmUser.fromJson(json['receiver'] as Map<String, dynamic>),
      content: json['content'] ?? '',
      cost: json['cost'] ?? 20,
      isRead: json['isRead'] ?? false,
      isAccepted: json['isAccepted'] ?? false,
      blurred: json['blurred'] ?? false,
      createdAt: json['createdAt'] != null
          ? DateTime.tryParse(json['createdAt']) ?? DateTime.now()
          : DateTime.now(),
      replies: json['replies'] != null
          ? (json['replies'] as List)
              .map((r) => DmReply.fromJson(r as Map<String, dynamic>))
              .toList()
          : [],
    );
  }

  DirectMessage copyWith({bool? isAccepted, bool? blurred, String? content}) =>
      DirectMessage(
        id: id,
        sender: sender,
        receiver: receiver,
        content: content ?? this.content,
        cost: cost,
        isRead: isRead,
        isAccepted: isAccepted ?? this.isAccepted,
        blurred: blurred ?? this.blurred,
        createdAt: createdAt,
        replies: replies,
      );
}

class DmUser {
  final String id;
  final String nickname;
  final String? avatarUrl;
  final bool isVerified;
  final bool isPremium;

  const DmUser({
    required this.id,
    required this.nickname,
    this.avatarUrl,
    this.isVerified = false,
    this.isPremium = false,
  });

  factory DmUser.fromJson(Map<String, dynamic> json) => DmUser(
        id: json['_id'] ?? json['id'] ?? '',
        nickname: json['nickname'] ?? '',
        avatarUrl: json['avatarUrl'],
        isVerified: json['isVerified'] ?? false,
        isPremium: true, // VIP disabled — see user.dart
      );
}

class DmReply {
  final String senderId;
  final String content;
  final DateTime createdAt;

  const DmReply({
    required this.senderId,
    required this.content,
    required this.createdAt,
  });

  factory DmReply.fromJson(Map<String, dynamic> json) => DmReply(
        senderId: json['sender'] ?? '',
        content: json['content'] ?? '',
        createdAt: json['createdAt'] != null
            ? DateTime.tryParse(json['createdAt']) ?? DateTime.now()
            : DateTime.now(),
      );
}
