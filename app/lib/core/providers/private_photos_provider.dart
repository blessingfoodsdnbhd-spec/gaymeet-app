import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../api/private_photos_service.dart';

// ── Models ────────────────────────────────────────────────────────────────────

class PhotoRequest {
  final String id;
  final String requesterNickname;
  final String? requesterAvatarUrl;
  final int requesterLevel;
  final String status; // pending | approved | rejected | expired
  final DateTime createdAt;

  const PhotoRequest({
    required this.id,
    required this.requesterNickname,
    this.requesterAvatarUrl,
    required this.requesterLevel,
    required this.status,
    required this.createdAt,
  });

  factory PhotoRequest.fromJson(Map<String, dynamic> json, {bool fromInbox = true}) {
    final person = fromInbox
        ? (json['requester'] as Map<String, dynamic>? ?? {})
        : (json['owner'] as Map<String, dynamic>? ?? {});
    return PhotoRequest(
      id: json['_id'] ?? '',
      requesterNickname: person['nickname'] as String? ?? '?',
      requesterAvatarUrl: person['avatarUrl'] as String?,
      requesterLevel: (person['level'] as num?)?.toInt() ?? 1,
      status: json['status'] as String? ?? 'pending',
      createdAt: json['createdAt'] != null
          ? DateTime.tryParse(json['createdAt']) ?? DateTime.now()
          : DateTime.now(),
    );
  }
}

// ── State for a specific user's private photo access ─────────────────────────

class PrivatePhotoAccess {
  final String status; // 'none' | 'pending' | 'approved' | 'owner'
  final List<String> photos;
  final bool isLoading;

  const PrivatePhotoAccess({
    this.status = 'none',
    this.photos = const [],
    this.isLoading = false,
  });

  PrivatePhotoAccess copyWith({
    String? status,
    List<String>? photos,
    bool? isLoading,
  }) =>
      PrivatePhotoAccess(
        status: status ?? this.status,
        photos: photos ?? this.photos,
        isLoading: isLoading ?? this.isLoading,
      );
}

// ── State for inbox (incoming requests) ──────────────────────────────────────

class PhotoRequestsState {
  final List<PhotoRequest> inbox;
  final List<PhotoRequest> sent;
  final bool isLoading;

  const PhotoRequestsState({
    this.inbox = const [],
    this.sent = const [],
    this.isLoading = false,
  });

  PhotoRequestsState copyWith({
    List<PhotoRequest>? inbox,
    List<PhotoRequest>? sent,
    bool? isLoading,
  }) =>
      PhotoRequestsState(
        inbox: inbox ?? this.inbox,
        sent: sent ?? this.sent,
        isLoading: isLoading ?? this.isLoading,
      );
}

class PhotoRequestsNotifier extends StateNotifier<PhotoRequestsState> {
  final PrivatePhotosService _service;

  PhotoRequestsNotifier(this._service) : super(const PhotoRequestsState());

  Future<void> fetchInbox() async {
    state = state.copyWith(isLoading: true);
    try {
      final raw = await _service.fetchInbox();
      final requests = raw
          .map((r) => PhotoRequest.fromJson(r as Map<String, dynamic>, fromInbox: true))
          .toList();
      state = state.copyWith(inbox: requests, isLoading: false);
    } catch (_) {
      state = state.copyWith(isLoading: false);
    }
  }

  Future<void> fetchSent() async {
    try {
      final raw = await _service.fetchSentRequests();
      final requests = raw
          .map((r) => PhotoRequest.fromJson(r as Map<String, dynamic>, fromInbox: false))
          .toList();
      state = state.copyWith(sent: requests);
    } catch (_) {}
  }

  Future<bool> respond(String requestId, String status) async {
    try {
      await _service.respond(requestId, status);
      // Remove from inbox
      state = state.copyWith(
        inbox: state.inbox.where((r) => r.id != requestId).toList(),
      );
      return true;
    } catch (_) {
      return false;
    }
  }
}

// ── Provider for per-user private photo access ────────────────────────────────

class PrivatePhotoAccessNotifier
    extends StateNotifier<Map<String, PrivatePhotoAccess>> {
  final PrivatePhotosService _service;

  PrivatePhotoAccessNotifier(this._service) : super({});

  Future<void> load(String userId) async {
    state = {
      ...state,
      userId: (state[userId] ?? const PrivatePhotoAccess()).copyWith(isLoading: true),
    };
    try {
      final data = await _service.getPrivatePhotos(userId);
      final photos = (data['photos'] as List).cast<String>();
      final accessStatus = data['status'] as String? ?? 'none';
      state = {
        ...state,
        userId: PrivatePhotoAccess(
          status: accessStatus,
          photos: photos,
          isLoading: false,
        ),
      };
    } catch (_) {
      state = {
        ...state,
        userId: (state[userId] ?? const PrivatePhotoAccess())
            .copyWith(isLoading: false),
      };
    }
  }

  Future<bool> request(String userId) async {
    try {
      await _service.requestPhotos(userId);
      state = {
        ...state,
        userId: const PrivatePhotoAccess(status: 'pending'),
      };
      return true;
    } catch (_) {
      return false;
    }
  }
}

// ── Providers ─────────────────────────────────────────────────────────────────

final _privatePhotosServiceProvider = Provider<PrivatePhotosService>((ref) {
  return ref.watch(privatePhotosServiceProvider);
});

final photoRequestsProvider =
    StateNotifierProvider<PhotoRequestsNotifier, PhotoRequestsState>((ref) {
  return PhotoRequestsNotifier(ref.watch(_privatePhotosServiceProvider));
});

final privatePhotoAccessProvider = StateNotifierProvider<PrivatePhotoAccessNotifier,
    Map<String, PrivatePhotoAccess>>((ref) {
  return PrivatePhotoAccessNotifier(ref.watch(_privatePhotosServiceProvider));
});
