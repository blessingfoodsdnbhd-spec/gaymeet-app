class MomentUser {
  final String id;
  final String nickname;
  final String? avatarUrl;
  final bool isPremium;
  final String? countryCode;

  const MomentUser({
    required this.id,
    required this.nickname,
    this.avatarUrl,
    this.isPremium = false,
    this.countryCode,
  });

  factory MomentUser.fromJson(Map<String, dynamic> j) => MomentUser(
        id: (j['_id'] ?? j['id'] ?? '') as String,
        nickname: (j['nickname'] ?? '') as String,
        avatarUrl: j['avatarUrl'] as String?,
        isPremium: (j['isPremium'] as bool?) ?? false,
        countryCode: j['countryCode'] as String?,
      );
}

class MomentComment {
  final String id;
  final MomentUser user;
  final String content;
  final int likeCount;
  final bool isLiked;
  final String? parentCommentId;
  final DateTime createdAt;

  const MomentComment({
    required this.id,
    required this.user,
    required this.content,
    required this.likeCount,
    required this.isLiked,
    this.parentCommentId,
    required this.createdAt,
  });

  factory MomentComment.fromJson(Map<String, dynamic> j) => MomentComment(
        id: (j['_id'] ?? j['id'] ?? '') as String,
        user: MomentUser.fromJson(j['user'] as Map<String, dynamic>),
        content: (j['content'] ?? '') as String,
        likeCount: (j['likeCount'] as int?) ?? 0,
        isLiked: (j['isLiked'] as bool?) ?? false,
        parentCommentId: j['parentComment'] as String?,
        createdAt: DateTime.tryParse(j['createdAt'] as String? ?? '') ??
            DateTime.now(),
      );
}

class Moment {
  final String id;
  final MomentUser user;
  final String content;
  final List<String> images;
  final int likeCount;
  final bool isLiked;
  final int commentsCount;
  final List<MomentComment> comments;
  final bool hasLocation;
  final String visibility;
  final DateTime createdAt;

  const Moment({
    required this.id,
    required this.user,
    required this.content,
    required this.images,
    required this.likeCount,
    required this.isLiked,
    required this.commentsCount,
    this.comments = const [],
    this.hasLocation = false,
    this.visibility = 'public',
    required this.createdAt,
  });

  factory Moment.fromJson(Map<String, dynamic> j) => Moment(
        id: (j['_id'] ?? j['id'] ?? '') as String,
        user: MomentUser.fromJson(j['user'] as Map<String, dynamic>),
        content: (j['content'] ?? '') as String,
        images: ((j['images'] as List?) ?? []).cast<String>(),
        likeCount: (j['likeCount'] as int?) ?? 0,
        isLiked: (j['isLiked'] as bool?) ?? false,
        commentsCount: (j['commentsCount'] as int?) ?? 0,
        comments: ((j['comments'] as List?) ?? [])
            .map((c) => MomentComment.fromJson(c as Map<String, dynamic>))
            .toList(),
        hasLocation: (j['hasLocation'] as bool?) ?? false,
        visibility: (j['visibility'] as String?) ?? 'public',
        createdAt: DateTime.tryParse(j['createdAt'] as String? ?? '') ??
            DateTime.now(),
      );

  Moment copyWith({
    int? likeCount,
    bool? isLiked,
    int? commentsCount,
    List<MomentComment>? comments,
  }) =>
      Moment(
        id: id,
        user: user,
        content: content,
        images: images,
        likeCount: likeCount ?? this.likeCount,
        isLiked: isLiked ?? this.isLiked,
        commentsCount: commentsCount ?? this.commentsCount,
        comments: comments ?? this.comments,
        hasLocation: hasLocation,
        visibility: visibility,
        createdAt: createdAt,
      );
}
