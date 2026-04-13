class PlaceAuthor {
  final String id;
  final String nickname;
  final String? avatarUrl;
  final bool isVerified;

  const PlaceAuthor({
    required this.id,
    required this.nickname,
    this.avatarUrl,
    this.isVerified = false,
  });

  factory PlaceAuthor.fromJson(Map<String, dynamic> j) => PlaceAuthor(
        id: j['_id'] ?? '',
        nickname: j['nickname'] ?? '',
        avatarUrl: j['avatarUrl'],
        isVerified: j['isVerified'] ?? false,
      );
}

class PlaceRating {
  final String userId;
  final String userNickname;
  final String? userAvatar;
  final int score;
  final String review;
  final DateTime createdAt;

  const PlaceRating({
    required this.userId,
    required this.userNickname,
    this.userAvatar,
    required this.score,
    required this.review,
    required this.createdAt,
  });

  factory PlaceRating.fromJson(Map<String, dynamic> j) {
    final user = j['user'];
    return PlaceRating(
      userId: user is Map ? (user['_id'] ?? '') : (user?.toString() ?? ''),
      userNickname: user is Map ? (user['nickname'] ?? '') : '',
      userAvatar: user is Map ? user['avatarUrl'] : null,
      score: j['score'] ?? 0,
      review: j['review'] ?? '',
      createdAt: DateTime.tryParse(j['createdAt'] ?? '') ?? DateTime.now(),
    );
  }
}

class PlaceEvent {
  final String id;
  final String title;
  final String description;
  final DateTime date;
  final DateTime? endDate;
  final double price;
  final String currency;
  final String? coverImage;

  const PlaceEvent({
    required this.id,
    required this.title,
    required this.description,
    required this.date,
    this.endDate,
    required this.price,
    this.currency = 'MYR',
    this.coverImage,
  });

  factory PlaceEvent.fromJson(Map<String, dynamic> j) => PlaceEvent(
        id: j['_id'] ?? '',
        title: j['title'] ?? '',
        description: j['description'] ?? '',
        date: DateTime.tryParse(j['date'] ?? '') ?? DateTime.now(),
        endDate: j['endDate'] != null ? DateTime.tryParse(j['endDate']) : null,
        price: (j['price'] ?? 0).toDouble(),
        currency: j['currency'] ?? 'MYR',
        coverImage: j['coverImage'],
      );

  bool get isFree => price == 0;
}

class Place {
  final String id;
  final PlaceAuthor? author;
  final String name;
  final String description;
  final String category;
  final String address;
  final String city;
  final String country;
  final String? phone;
  final String? website;
  final String? openingHours;
  final List<String> photos;
  final List<String> tags;
  final String priceRange;
  final bool isVerified;
  final List<PlaceRating> ratings;
  final double averageRating;
  final int totalReviews;
  final int likesCount;
  final bool isLiked;
  final double? lat;
  final double? lng;
  final DateTime createdAt;

  const Place({
    required this.id,
    this.author,
    required this.name,
    this.description = '',
    required this.category,
    this.address = '',
    this.city = '',
    this.country = 'MY',
    this.phone,
    this.website,
    this.openingHours,
    this.photos = const [],
    this.tags = const [],
    this.priceRange = '$$',
    this.isVerified = false,
    this.ratings = const [],
    this.averageRating = 0,
    this.totalReviews = 0,
    this.likesCount = 0,
    this.isLiked = false,
    this.lat,
    this.lng,
    required this.createdAt,
  });

  factory Place.fromJson(Map<String, dynamic> j, {String? myUserId}) {
    final loc = j['location'];
    double? lat, lng;
    if (loc != null && loc['coordinates'] is List) {
      final coords = loc['coordinates'] as List;
      if (coords.length >= 2) {
        lng = (coords[0] as num).toDouble();
        lat = (coords[1] as num).toDouble();
      }
    }

    final likes = j['likes'] as List<dynamic>? ?? [];
    final isLiked = myUserId != null && likes.any((l) {
      if (l is Map) return l['_id'] == myUserId;
      return l.toString() == myUserId;
    });

    return Place(
      id: j['_id'] ?? '',
      author: j['user'] is Map ? PlaceAuthor.fromJson(j['user'] as Map<String, dynamic>) : null,
      name: j['name'] ?? '',
      description: j['description'] ?? '',
      category: j['category'] ?? 'other',
      address: j['address'] ?? '',
      city: j['city'] ?? '',
      country: j['country'] ?? 'MY',
      phone: j['phone'],
      website: j['website'],
      openingHours: j['openingHours'],
      photos: List<String>.from(j['photos'] ?? []),
      tags: List<String>.from(j['tags'] ?? []),
      priceRange: j['priceRange'] ?? '$$',
      isVerified: j['isVerified'] ?? false,
      ratings: (j['ratings'] as List<dynamic>? ?? [])
          .map((r) => PlaceRating.fromJson(r as Map<String, dynamic>))
          .toList(),
      averageRating: (j['averageRating'] ?? 0).toDouble(),
      totalReviews: j['totalReviews'] ?? 0,
      likesCount: likes.length,
      isLiked: isLiked,
      lat: lat,
      lng: lng,
      createdAt: DateTime.tryParse(j['createdAt'] ?? '') ?? DateTime.now(),
    );
  }

  /// Category display helpers
  static String categoryEmoji(String cat) {
    switch (cat) {
      case 'bar': return '🍺';
      case 'club': return '🎵';
      case 'restaurant': return '🍜';
      case 'cafe': return '☕';
      case 'sauna': return '🧖';
      case 'hotel': return '🏨';
      case 'event_venue': return '🎪';
      case 'park': return '🌳';
      case 'gym': return '💪';
      default: return '📍';
    }
  }

  static String categoryLabel(String cat) {
    switch (cat) {
      case 'bar': return '酒吧';
      case 'club': return '夜店';
      case 'restaurant': return '餐厅';
      case 'cafe': return '咖啡馆';
      case 'sauna': return '桑拿';
      case 'hotel': return '酒店';
      case 'event_venue': return '活动场地';
      case 'park': return '公园';
      case 'gym': return '健身房';
      default: return '其他';
    }
  }
}
