class EventOrganizer {
  final String id;
  final String nickname;
  final String? avatarUrl;
  final bool isPremium;
  final String? bio;

  const EventOrganizer({
    required this.id,
    required this.nickname,
    this.avatarUrl,
    this.isPremium = false,
    this.bio,
  });

  factory EventOrganizer.fromJson(Map<String, dynamic> j) => EventOrganizer(
        id: (j['_id'] ?? j['id'] ?? '') as String,
        nickname: (j['nickname'] ?? '') as String,
        avatarUrl: j['avatarUrl'] as String?,
        isPremium: true, // VIP disabled — see user.dart
        bio: j['bio'] as String?,
      );
}

class EventAttendee {
  final String? avatarUrl;
  final String nickname;

  const EventAttendee({required this.nickname, this.avatarUrl});

  factory EventAttendee.fromJson(Map<String, dynamic> j) {
    final user = j['user'];
    if (user is Map<String, dynamic>) {
      return EventAttendee(
        nickname: (user['nickname'] ?? '') as String,
        avatarUrl: user['avatarUrl'] as String?,
      );
    }
    return const EventAttendee(nickname: '');
  }
}

class AppEvent {
  final String id;
  final EventOrganizer organizer;
  final String title;
  final String description;
  final String? coverImage;
  final String venue;
  final String address;
  final DateTime date;
  final DateTime? endDate;
  final int maxAttendees;
  final int currentAttendees;
  final double price;
  final String currency;
  final String category;
  final List<String> tags;
  final List<EventAttendee> attendees;
  final bool isAttending;
  final String? myStatus; // going / interested / cancelled / null

  const AppEvent({
    required this.id,
    required this.organizer,
    required this.title,
    required this.description,
    this.coverImage,
    required this.venue,
    required this.address,
    required this.date,
    this.endDate,
    required this.maxAttendees,
    required this.currentAttendees,
    required this.price,
    required this.currency,
    required this.category,
    required this.tags,
    this.attendees = const [],
    this.isAttending = false,
    this.myStatus,
  });

  bool get isFree => price == 0;
  bool get isFull => currentAttendees >= maxAttendees;

  factory AppEvent.fromJson(Map<String, dynamic> j) => AppEvent(
        id: (j['_id'] ?? j['id'] ?? '') as String,
        organizer: j['organizer'] is Map<String, dynamic>
            ? EventOrganizer.fromJson(j['organizer'] as Map<String, dynamic>)
            : EventOrganizer(id: '', nickname: ''),
        title: (j['title'] ?? '') as String,
        description: (j['description'] ?? '') as String,
        coverImage: j['coverImage'] as String?,
        venue: (j['venue'] ?? '') as String,
        address: (j['address'] ?? '') as String,
        date: DateTime.tryParse(j['date'] as String? ?? '') ?? DateTime.now(),
        endDate: j['endDate'] != null
            ? DateTime.tryParse(j['endDate'] as String)
            : null,
        maxAttendees: (j['maxAttendees'] as num?)?.toInt() ?? 50,
        currentAttendees: (j['currentAttendees'] as num?)?.toInt() ?? 0,
        price: (j['price'] as num?)?.toDouble() ?? 0,
        currency: (j['currency'] ?? 'MYR') as String,
        category: (j['category'] ?? 'hangout') as String,
        tags: ((j['tags'] as List?) ?? []).cast<String>(),
        attendees: ((j['attendees'] as List?) ?? [])
            .map((a) => EventAttendee.fromJson(a as Map<String, dynamic>))
            .toList(),
        isAttending: (j['isAttending'] as bool?) ?? false,
        myStatus: j['myStatus'] as String?,
      );

  AppEvent copyWith({
    bool? isAttending,
    String? myStatus,
    int? currentAttendees,
  }) =>
      AppEvent(
        id: id,
        organizer: organizer,
        title: title,
        description: description,
        coverImage: coverImage,
        venue: venue,
        address: address,
        date: date,
        endDate: endDate,
        maxAttendees: maxAttendees,
        currentAttendees: currentAttendees ?? this.currentAttendees,
        price: price,
        currency: currency,
        category: category,
        tags: tags,
        attendees: attendees,
        isAttending: isAttending ?? this.isAttending,
        myStatus: myStatus ?? this.myStatus,
      );
}
