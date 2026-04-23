class UserModel {
  final String id;
  final String? email;
  final String nickname;
  final String? avatarUrl;
  final List<String> photos;
  final String? bio;
  final DateTime? birthday;
  final List<String> tags;
  final bool isPremium;
  final bool isOnline;
  final bool isBoosted;
  final DateTime? lastActive;
  final double? latitude;
  final double? longitude;
  final double? distance;
  final UserPreferences? preferences;
  // ── New location-feature fields ───────────────────────────────────────────
  final int? height;       // cm
  final int? weight;       // kg
  final String? countryCode; // ISO 3166-1 alpha-2, e.g. "MY"
  // ── Verification & social ─────────────────────────────────────────────────
  final bool isVerified;
  final String? lookingFor;
  // Sexual role: 'top', 'bottom', 'versatile', or null
  final String? role;
  // Energy / level system
  final int level;
  final int currentExp;
  final int totalExpReceived;
  // Private photos (URLs, only visible to approved requesters)
  final List<String> privatePhotos;
  // Follow system
  final int followersCount;
  final int followingCount;
  // Social stats
  final int totalLikesReceived;
  final int profileViews;
  // Personality / profile fields
  final String? zodiac;
  final String? mbti;
  final String? bloodType;
  final List<String> kinks;
  // VIP tier: 0 = free, 1 = silver, 2 = gold, 3 = rainbow
  final int vipLevel;
  // Premium expiry (for VIP banner display)
  final DateTime? premiumExpiresAt;
  // Coin balance (kept in sync from auth/me responses)
  final int coins;

  UserModel({
    required this.id,
    this.email,
    required this.nickname,
    this.avatarUrl,
    this.photos = const [],
    this.bio,
    this.birthday,
    this.tags = const [],
    this.isPremium = false,
    this.isOnline = false,
    this.isBoosted = false,
    this.lastActive,
    this.latitude,
    this.longitude,
    this.distance,
    this.preferences,
    this.height,
    this.weight,
    this.countryCode,
    this.isVerified = false,
    this.lookingFor,
    this.role,
    this.level = 1,
    this.currentExp = 0,
    this.totalExpReceived = 0,
    this.privatePhotos = const [],
    this.followersCount = 0,
    this.followingCount = 0,
    this.totalLikesReceived = 0,
    this.profileViews = 0,
    this.zodiac,
    this.mbti,
    this.bloodType,
    this.kinks = const [],
    this.vipLevel = 0,
    this.premiumExpiresAt,
    this.coins = 0,
  });

  /// Computed age from birthday (null if birthday unknown)
  int? get age {
    if (birthday == null) return null;
    final now = DateTime.now();
    int years = now.year - birthday!.year;
    if (now.month < birthday!.month ||
        (now.month == birthday!.month && now.day < birthday!.day)) {
      years--;
    }
    return years;
  }

  /// Distance formatted as "Xm" or "X.Xkm"
  String? get distanceLabel {
    if (distance == null) return null;
    if (distance! < 1.0) {
      return '${(distance! * 1000).round()}m';
    }
    return '${distance!.toStringAsFixed(1)}km';
  }

  factory UserModel.fromJson(Map<String, dynamic> json) {
    final photos = json['photos'] != null
        ? List<String>.from(json['photos'] as List)
        : <String>[];
    final avatarUrl = (json['avatarUrl'] as String?) ??
        (photos.isNotEmpty ? photos[0] : null);

    return UserModel(
      id: ((json['id'] ?? json['_id']) ?? '').toString(),
      email: json['email'],
      nickname: json['nickname'] ?? '',
      avatarUrl: avatarUrl,
      photos: photos,
      bio: json['bio'],
      birthday: json['birthday'] != null
          ? DateTime.tryParse(json['birthday'])
          : null,
      tags: json['tags'] != null ? List<String>.from(json['tags']) : [],
      // VIP temporarily disabled — everyone is effectively premium so
      // previously-gated features are unlocked and the app doesn't show
      // dead-end upgrade CTAs. To re-enable VIP, restore:
      //   isPremium: json['isPremium'] ?? false,
      isPremium: true,
      isOnline: json['isOnline'] ?? false,
      isBoosted: json['isBoosted'] ?? false,
      lastActive: json['lastActive'] != null
          ? DateTime.tryParse(json['lastActive'])
          : null,
      latitude: json['latitude']?.toDouble(),
      longitude: json['longitude']?.toDouble(),
      distance: json['distanceMeters'] != null
          ? (json['distanceMeters'] as num).toDouble() / 1000.0
          : json['distance']?.toDouble(),
      preferences: json['preferences'] != null
          ? UserPreferences.fromJson(json['preferences'])
          : null,
      height: json['height'] as int?,
      weight: json['weight'] as int?,
      countryCode: json['countryCode'] as String?,
      isVerified: json['isVerified'] ?? false,
      lookingFor: json['lookingFor'] as String?,
      role: json['role'] as String?,
      level: (json['level'] as num?)?.toInt() ?? 1,
      currentExp: (json['currentExp'] as num?)?.toInt() ?? 0,
      totalExpReceived: (json['totalExpReceived'] as num?)?.toInt() ?? 0,
      privatePhotos: json['privatePhotos'] != null
          ? List<String>.from(json['privatePhotos'] as List)
          : const [],
      followersCount: (json['followersCount'] as num?)?.toInt() ?? 0,
      followingCount: (json['followingCount'] as num?)?.toInt() ?? 0,
      totalLikesReceived: (json['totalLikesReceived'] as num?)?.toInt() ?? 0,
      profileViews: (json['profileViews'] as num?)?.toInt() ?? 0,
      zodiac: json['zodiac'] as String?,
      mbti: json['mbti'] as String?,
      bloodType: json['bloodType'] as String?,
      kinks: json['kinks'] != null ? List<String>.from(json['kinks'] as List) : const [],
      vipLevel: (json['vipLevel'] as num?)?.toInt() ?? 0,
      premiumExpiresAt: json['premiumExpiresAt'] != null
          ? DateTime.tryParse(json['premiumExpiresAt'])
          : null,
      coins: (json['coins'] as num?)?.toInt() ?? 0,
    );
  }

  Map<String, dynamic> toJson() => {
        'nickname': nickname,
        'bio': bio,
        'birthday': birthday?.toIso8601String(),
        'tags': tags,
        'height': height,
        'weight': weight,
        'countryCode': countryCode,
        'role': role,
        'zodiac': zodiac,
        'mbti': mbti,
        'bloodType': bloodType,
        'kinks': kinks,
      };

  UserModel copyWith({
    String? nickname,
    String? bio,
    List<String>? tags,
    List<String>? photos,
    bool? isPremium,
    int? height,
    int? weight,
    String? countryCode,
    bool? isVerified,
    String? lookingFor,
    String? role,
    String? zodiac,
    String? mbti,
    String? bloodType,
    List<String>? kinks,
    int? level,
    int? currentExp,
    int? totalExpReceived,
    List<String>? privatePhotos,
    int? followersCount,
    int? followingCount,
    int? totalLikesReceived,
    int? profileViews,
    int? vipLevel,
    DateTime? premiumExpiresAt,
    int? coins,
  }) {
    final newPhotos = photos ?? this.photos;
    final newAvatarUrl = photos != null
        ? (newPhotos.isNotEmpty ? newPhotos[0] : null)
        : avatarUrl;

    return UserModel(
      id: id,
      email: email,
      nickname: nickname ?? this.nickname,
      avatarUrl: newAvatarUrl,
      photos: newPhotos,
      bio: bio ?? this.bio,
      birthday: birthday,
      tags: tags ?? this.tags,
      isPremium: isPremium ?? this.isPremium,
      isOnline: isOnline,
      isBoosted: isBoosted,
      lastActive: lastActive,
      latitude: latitude,
      longitude: longitude,
      distance: distance,
      preferences: preferences,
      height: height ?? this.height,
      weight: weight ?? this.weight,
      countryCode: countryCode ?? this.countryCode,
      isVerified: isVerified ?? this.isVerified,
      lookingFor: lookingFor ?? this.lookingFor,
      role: role ?? this.role,
      zodiac: zodiac ?? this.zodiac,
      mbti: mbti ?? this.mbti,
      bloodType: bloodType ?? this.bloodType,
      kinks: kinks ?? this.kinks,
      level: level ?? this.level,
      currentExp: currentExp ?? this.currentExp,
      totalExpReceived: totalExpReceived ?? this.totalExpReceived,
      privatePhotos: privatePhotos ?? this.privatePhotos,
      followersCount: followersCount ?? this.followersCount,
      followingCount: followingCount ?? this.followingCount,
      totalLikesReceived: totalLikesReceived ?? this.totalLikesReceived,
      profileViews: profileViews ?? this.profileViews,
      vipLevel: vipLevel ?? this.vipLevel,
      premiumExpiresAt: premiumExpiresAt ?? this.premiumExpiresAt,
      coins: coins ?? this.coins,
    );
  }
}

class UserPreferences {
  final int ageMin;
  final int ageMax;
  final int distanceMaxKm;
  final List<String> tagsPreference;
  final bool showOnlineOnly;
  final bool hideDistance;
  final bool hideOnlineStatus;
  final bool hideFromNearby;
  // ── Location feature prefs ────────────────────────────────────────────────
  final bool stealthMode;
  final double? virtualLat;
  final double? virtualLng;
  final String? virtualLocationLabel;

  UserPreferences({
    this.ageMin = 18,
    this.ageMax = 99,
    this.distanceMaxKm = 50,
    this.tagsPreference = const [],
    this.showOnlineOnly = false,
    this.hideDistance = false,
    this.hideOnlineStatus = false,
    this.hideFromNearby = false,
    this.stealthMode = false,
    this.virtualLat,
    this.virtualLng,
    this.virtualLocationLabel,
  });

  bool get hasVirtualLocation => virtualLat != null && virtualLng != null;

  factory UserPreferences.fromJson(Map<String, dynamic> json) {
    return UserPreferences(
      ageMin: json['ageMin'] ?? 18,
      ageMax: json['ageMax'] ?? 99,
      distanceMaxKm: json['distanceMaxKm'] ?? 50,
      tagsPreference: json['tagsPreference'] != null
          ? List<String>.from(json['tagsPreference'])
          : [],
      showOnlineOnly: json['showOnlineOnly'] ?? false,
      hideDistance: json['hideDistance'] ?? false,
      hideOnlineStatus: json['hideOnlineStatus'] ?? false,
      hideFromNearby: json['hideFromNearby'] ?? false,
      stealthMode: json['stealthMode'] ?? false,
      virtualLat: json['virtualLat']?.toDouble(),
      virtualLng: json['virtualLng']?.toDouble(),
      virtualLocationLabel: json['virtualLocationLabel'],
    );
  }
}
