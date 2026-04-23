class GroupMember {
  final String userId;
  final String nickname;
  final String? avatarUrl;
  final bool isOnline;
  final int level;
  final String role; // 'admin' | 'member'

  const GroupMember({
    required this.userId,
    required this.nickname,
    this.avatarUrl,
    this.isOnline = false,
    this.level = 1,
    this.role = 'member',
  });

  factory GroupMember.fromJson(Map<String, dynamic> json) {
    final user = (json['user'] is Map)
        ? json['user'] as Map<String, dynamic>
        : <String, dynamic>{};
    final rawId = user['_id'] ?? user['id'] ?? json['user']?.toString() ?? '';
    return GroupMember(
      userId: rawId.toString(),
      nickname: user['nickname'] as String? ?? '',
      avatarUrl: user['avatarUrl'] as String?,
      isOnline: user['isOnline'] as bool? ?? false,
      level: (user['level'] as num?)?.toInt() ?? 1,
      role: json['role'] as String? ?? 'member',
    );
  }
}

class GroupChat {
  final String id;
  final String name;
  final String description;
  final String? avatar;
  final int memberCount;
  final bool isMember;
  final bool isAdmin;
  final bool isPublic;
  final List<String> tags;
  final String lastMessage;
  final DateTime? lastMessageAt;
  final DateTime createdAt;

  const GroupChat({
    required this.id,
    required this.name,
    required this.description,
    this.avatar,
    this.memberCount = 0,
    this.isMember = false,
    this.isAdmin = false,
    this.isPublic = true,
    this.tags = const [],
    this.lastMessage = '',
    this.lastMessageAt,
    required this.createdAt,
  });

  factory GroupChat.fromJson(Map<String, dynamic> json) {
    final rawId = json['_id'] ?? json['id'] ?? '';
    return GroupChat(
      id: rawId.toString(),
      name: json['name'] as String? ?? '',
      description: json['description'] as String? ?? '',
      avatar: json['avatar'] as String?,
      memberCount: (json['memberCount'] as num?)?.toInt() ?? 0,
      isMember: json['isMember'] as bool? ?? false,
      isAdmin: json['isAdmin'] as bool? ?? false,
      isPublic: json['isPublic'] as bool? ?? true,
      tags: json['tags'] != null
          ? List<String>.from(json['tags'] as List)
          : const [],
      lastMessage: json['lastMessage'] as String? ?? '',
      lastMessageAt: json['lastMessageAt'] != null
          ? DateTime.tryParse(json['lastMessageAt'])
          : null,
      createdAt: json['createdAt'] != null
          ? DateTime.parse(json['createdAt'])
          : DateTime.now(),
    );
  }

  GroupChat copyWith({bool? isMember, bool? isAdmin, int? memberCount}) =>
      GroupChat(
        id: id,
        name: name,
        description: description,
        avatar: avatar,
        memberCount: memberCount ?? this.memberCount,
        isMember: isMember ?? this.isMember,
        isAdmin: isAdmin ?? this.isAdmin,
        isPublic: isPublic,
        tags: tags,
        lastMessage: lastMessage,
        lastMessageAt: lastMessageAt,
        createdAt: createdAt,
      );
}

class GroupMessageSender {
  final String id;
  final String nickname;
  final String? avatarUrl;
  final int level;
  final bool isPremium;

  const GroupMessageSender({
    required this.id,
    required this.nickname,
    this.avatarUrl,
    this.level = 1,
    this.isPremium = false,
  });

  factory GroupMessageSender.fromJson(Map<String, dynamic> json) {
    final rawId = json['_id'] ?? json['id'] ?? '';
    return GroupMessageSender(
      id: rawId.toString(),
      nickname: json['nickname'] as String? ?? '',
      avatarUrl: json['avatarUrl'] as String?,
      level: (json['level'] as num?)?.toInt() ?? 1,
      isPremium: true, // VIP disabled — see user.dart
    );
  }
}

class GroupMessage {
  final String id;
  final String groupId;
  final GroupMessageSender sender;
  final String content;
  final String type; // 'text'|'sticker'|'image'|'system'
  final DateTime createdAt;

  const GroupMessage({
    required this.id,
    required this.groupId,
    required this.sender,
    required this.content,
    required this.type,
    required this.createdAt,
  });

  factory GroupMessage.fromJson(Map<String, dynamic> json) {
    final rawId = json['_id'] ?? json['id'] ?? '';
    final rawGroupId = json['group']?.toString() ?? '';
    final senderJson = json['sender'];
    final sender = senderJson is Map
        ? GroupMessageSender.fromJson(senderJson as Map<String, dynamic>)
        : GroupMessageSender(id: senderJson?.toString() ?? '', nickname: '?');

    return GroupMessage(
      id: rawId.toString(),
      groupId: rawGroupId,
      sender: sender,
      content: json['content'] as String? ?? '',
      type: json['type'] as String? ?? 'text',
      createdAt: json['createdAt'] != null
          ? DateTime.parse(json['createdAt'])
          : DateTime.now(),
    );
  }
}
