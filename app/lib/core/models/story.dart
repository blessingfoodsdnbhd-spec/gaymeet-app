class StoryItem {
  final String id;
  final String mediaUrl;
  final String mediaType; // 'image' | 'video'
  final String caption;
  final String visibility; // 'public' | 'followers' | 'private'
  final bool hasLocation;
  final int viewCount;
  final bool isViewed;
  final DateTime createdAt;
  final DateTime expiresAt;

  const StoryItem({
    required this.id,
    required this.mediaUrl,
    required this.mediaType,
    required this.caption,
    this.visibility = 'followers',
    this.hasLocation = false,
    required this.viewCount,
    required this.isViewed,
    required this.createdAt,
    required this.expiresAt,
  });

  factory StoryItem.fromJson(Map<String, dynamic> json) {
    final rawId = json['_id'] ?? json['id'] ?? '';
    return StoryItem(
      id: rawId.toString(),
      mediaUrl: json['mediaUrl'] as String? ?? '',
      mediaType: json['mediaType'] as String? ?? 'image',
      caption: json['caption'] as String? ?? '',
      visibility: json['visibility'] as String? ?? 'followers',
      hasLocation: json['hasLocation'] as bool? ?? false,
      viewCount: (json['viewCount'] as num?)?.toInt() ?? 0,
      isViewed: json['isViewed'] as bool? ?? false,
      createdAt: json['createdAt'] != null
          ? DateTime.parse(json['createdAt'])
          : DateTime.now(),
      expiresAt: json['expiresAt'] != null
          ? DateTime.parse(json['expiresAt'])
          : DateTime.now().add(const Duration(hours: 24)),
    );
  }
}

class StoryAuthor {
  final String id;
  final String nickname;
  final String? avatarUrl;

  const StoryAuthor({
    required this.id,
    required this.nickname,
    this.avatarUrl,
  });

  factory StoryAuthor.fromJson(Map<String, dynamic> json) {
    final rawId = json['_id'] ?? json['id'] ?? '';
    return StoryAuthor(
      id: rawId.toString(),
      nickname: json['nickname'] as String? ?? '',
      avatarUrl: json['avatarUrl'] as String?,
    );
  }
}

/// A group of stories from a single user
class StoryGroup {
  final StoryAuthor user;
  final List<StoryItem> stories;
  final bool hasUnviewed;

  const StoryGroup({
    required this.user,
    required this.stories,
    required this.hasUnviewed,
  });

  factory StoryGroup.fromJson(Map<String, dynamic> json) {
    final userJson = json['user'] as Map<String, dynamic>? ?? {};
    final storiesJson = (json['stories'] as List?) ?? [];
    return StoryGroup(
      user: StoryAuthor.fromJson(userJson),
      stories: storiesJson
          .map((s) => StoryItem.fromJson(s as Map<String, dynamic>))
          .toList(),
      hasUnviewed: json['hasUnviewed'] as bool? ?? false,
    );
  }
}
