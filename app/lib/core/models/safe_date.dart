class SafeDateContact {
  final String userId;
  final String nickname;

  const SafeDateContact({required this.userId, required this.nickname});

  factory SafeDateContact.fromJson(Map<String, dynamic> json) {
    return SafeDateContact(
      userId: (json['userId'] ?? '').toString(),
      nickname: json['nickname'] as String? ?? '',
    );
  }

  Map<String, dynamic> toJson() => {'userId': userId, 'nickname': nickname};
}

class SafeDate {
  final String id;
  final bool isActive;
  final DateTime startedAt;
  final DateTime? endedAt;
  final List<SafeDateContact> trustedContacts;
  final String meetingWith;
  final String venue;
  final DateTime? expectedEndTime;
  final bool panicTriggered;
  final DateTime? panicAt;
  final DateTime? lastCheckinAt;
  final double? lat;
  final double? lng;

  const SafeDate({
    required this.id,
    required this.isActive,
    required this.startedAt,
    this.endedAt,
    this.trustedContacts = const [],
    this.meetingWith = '',
    this.venue = '',
    this.expectedEndTime,
    this.panicTriggered = false,
    this.panicAt,
    this.lastCheckinAt,
    this.lat,
    this.lng,
  });

  factory SafeDate.fromJson(Map<String, dynamic> json) {
    final rawId = json['_id'] ?? json['id'] ?? '';
    final contacts = (json['trustedContacts'] as List? ?? [])
        .map((c) => SafeDateContact.fromJson(c as Map<String, dynamic>))
        .toList();

    // coordinates: [lng, lat] in GeoJSON
    double? lat, lng;
    final loc = json['location'];
    if (loc is Map) {
      final coords = loc['coordinates'] as List?;
      if (coords != null && coords.length >= 2) {
        lng = (coords[0] as num).toDouble();
        lat = (coords[1] as num).toDouble();
      }
    }

    return SafeDate(
      id: rawId.toString(),
      isActive: json['isActive'] as bool? ?? false,
      startedAt: json['startedAt'] != null
          ? DateTime.parse(json['startedAt'])
          : DateTime.now(),
      endedAt: json['endedAt'] != null
          ? DateTime.tryParse(json['endedAt'])
          : null,
      trustedContacts: contacts,
      meetingWith: json['meetingWith'] as String? ?? '',
      venue: json['venue'] as String? ?? '',
      expectedEndTime: json['expectedEndTime'] != null
          ? DateTime.tryParse(json['expectedEndTime'])
          : null,
      panicTriggered: json['panicTriggered'] as bool? ?? false,
      panicAt: json['panicAt'] != null
          ? DateTime.tryParse(json['panicAt'])
          : null,
      lastCheckinAt: json['lastCheckinAt'] != null
          ? DateTime.tryParse(json['lastCheckinAt'])
          : null,
      lat: lat,
      lng: lng,
    );
  }
}
