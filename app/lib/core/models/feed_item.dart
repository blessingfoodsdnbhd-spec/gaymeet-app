import 'moment.dart' show MomentUser;

/// A single item in the unified feed. Backed by different underlying models
/// depending on [type]:
///   - 'moment' — a text/image post with no known place
///   - 'place'  — same, but tagged with a resolved Place (see [placeName])
///   - 'event'  — an upcoming Event (see [eventTitle], [eventDate], [venue])
class FeedItem {
  final String id;
  final String type; // 'moment' | 'place' | 'event'
  final MomentUser user;
  final String content;
  final List<String> media;
  final bool hasLocation;
  final List<double>? coordinates; // [lng, lat]
  final DateTime createdAt;
  final int likeCount;
  final bool isLiked;
  final int commentsCount;
  final String visibility;
  final Map<String, dynamic> meta;

  const FeedItem({
    required this.id,
    required this.type,
    required this.user,
    required this.content,
    required this.media,
    required this.hasLocation,
    this.coordinates,
    required this.createdAt,
    required this.likeCount,
    required this.isLiked,
    required this.commentsCount,
    required this.visibility,
    required this.meta,
  });

  // ── Type-specific getters (safe even when meta lacks the field) ─────────────
  String? get placeName => meta['placeName'] as String?;
  String? get eventTitle => meta['eventTitle'] as String?;
  String? get venue => meta['venue'] as String?;
  DateTime? get eventDate {
    final v = meta['eventDate'];
    if (v is String) return DateTime.tryParse(v);
    return null;
  }

  int get attendeeCount => (meta['attendeeCount'] as int?) ?? 0;
  int? get maxAttendees => meta['maxAttendees'] as int?;
  num get price => (meta['price'] as num?) ?? 0;
  String get currency => (meta['currency'] as String?) ?? 'MYR';
  String? get category => meta['category'] as String?;

  factory FeedItem.fromJson(Map<String, dynamic> j) {
    final loc = j['location'] as Map<String, dynamic>?;
    final coords = loc?['coordinates'] as List?;
    return FeedItem(
      id: (j['_id'] ?? j['id'] ?? '') as String,
      type: (j['type'] as String?) ?? 'moment',
      user: MomentUser.fromJson(
          (j['user'] as Map<String, dynamic>? ?? const {})),
      content: (j['content'] ?? '') as String,
      media: ((j['media'] as List?) ?? const []).cast<String>(),
      hasLocation: coords != null && coords.length >= 2,
      coordinates: coords != null && coords.length >= 2
          ? [(coords[0] as num).toDouble(), (coords[1] as num).toDouble()]
          : null,
      createdAt: DateTime.tryParse(j['createdAt'] as String? ?? '') ??
          DateTime.now(),
      likeCount: (j['likeCount'] as int?) ?? 0,
      isLiked: (j['isLiked'] as bool?) ?? false,
      commentsCount: (j['commentsCount'] as int?) ?? 0,
      visibility: (j['visibility'] as String?) ?? 'public',
      meta: (j['meta'] as Map<String, dynamic>?) ?? const {},
    );
  }

  FeedItem copyWith({
    int? likeCount,
    bool? isLiked,
    int? commentsCount,
  }) =>
      FeedItem(
        id: id,
        type: type,
        user: user,
        content: content,
        media: media,
        hasLocation: hasLocation,
        coordinates: coordinates,
        createdAt: createdAt,
        likeCount: likeCount ?? this.likeCount,
        isLiked: isLiked ?? this.isLiked,
        commentsCount: commentsCount ?? this.commentsCount,
        visibility: visibility,
        meta: meta,
      );
}
