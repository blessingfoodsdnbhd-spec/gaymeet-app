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
      return '${(distance! * 1000).round()} m';
    }
    return '${distance!.toStringAsFixed(1)} km';
  }

  factory UserModel.fromJson(Map<String, dynamic> json) {
    final photos = json['photos'] != null
        ? List<String>.from(json['photos'] as List)
        : <String>[];
    final avatarUrl = (json['avatarUrl'] as String?) ??
        (photos.isNotEmpty ? photos[0] : null);

    return UserModel(
      id: json['id'] ?? '',
      email: json['email'],
      nickname: json['nickname'] ?? '',
      avatarUrl: avatarUrl,
      photos: photos,
      bio: json['bio'],
      birthday: json['birthday'] != null
          ? DateTime.tryParse(json['birthday'])
          : null,
      tags: json['tags'] != null ? List<String>.from(json['tags']) : [],
      isPremium: json['isPremium'] ?? false,
      isOnline: json['isOnline'] ?? false,
      isBoosted: json['isBoosted'] ?? false,
      lastActive: json['lastActive'] != null
          ? DateTime.tryParse(json['lastActive'])
          : null,
      latitude: json['latitude']?.toDouble(),
      longitude: json['longitude']?.toDouble(),
      distance: json['distance']?.toDouble(),
      preferences: json['preferences'] != null
          ? UserPreferences.fromJson(json['preferences'])
          : null,
      height: json['height'] as int?,
      weight: json['weight'] as int?,
      countryCode: json['countryCode'] as String?,
      isVerified: json['isVerified'] ?? false,
      lookingFor: json['lookingFor'] as String?,
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
