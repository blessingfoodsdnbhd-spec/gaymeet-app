import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../api/events_service.dart';
import '../models/event.dart';
import 'auth_provider.dart';

// ── Dummy events ───────────────────────────────────────────────────────────────

final _dummyOrganizer = EventOrganizer(
  id: 'org1',
  nickname: 'Hafiz',
  isPremium: true,
);

final _dummyEvents = [
  AppEvent(
    id: 'e1',
    organizer: _dummyOrganizer,
    title: 'Rainbow Makan Night 🌈',
    description: '同志聚餐之夜！欢迎所有人加入，我们将在KL市中心一家精致餐厅享用美食。价格包含3道菜套餐。',
    venue: 'Nobu KL',
    address: 'Level 56, Menara 3 Petronas, KLCC, KL',
    date: DateTime.now().add(const Duration(days: 7)),
    maxAttendees: 20,
    currentAttendees: 8,
    price: 30,
    currency: 'MYR',
    category: 'makan',
    tags: ['dinner', 'socialise'],
  ),
  AppEvent(
    id: 'e2',
    organizer: _dummyOrganizer,
    title: 'Gym Buddies Meetup 💪',
    description: '一起训练，共同进步！适合所有健身程度。训练后一起吃蛋白早餐。',
    venue: 'Fitness First Bukit Jalil',
    address: 'Pavilion Bukit Jalil, KL',
    date: DateTime.now().add(const Duration(days: 3)),
    maxAttendees: 10,
    currentAttendees: 5,
    price: 0,
    currency: 'MYR',
    category: 'sports',
    tags: ['gym', 'free'],
  ),
  AppEvent(
    id: 'e3',
    organizer: _dummyOrganizer,
    title: 'Movie Night 🎬',
    description: '一起去看最新大片！Pavilion KL的IMAX厅。看完电影可以逛街或吃饭。',
    venue: 'GSC IMAX Pavilion KL',
    address: '168 Jalan Bukit Bintang, KL',
    date: DateTime.now().add(const Duration(days: 5)),
    maxAttendees: 15,
    currentAttendees: 6,
    price: 15,
    currency: 'MYR',
    category: 'hangout',
    tags: ['movie', 'imax'],
  ),
];

// ── State ─────────────────────────────────────────────────────────────────────

class EventsState {
  final List<AppEvent> events;
  final bool isLoading;
  final bool isLoadingMore;
  final bool hasMore;
  final int page;
  final String selectedCategory;

  const EventsState({
    this.events = const [],
    this.isLoading = false,
    this.isLoadingMore = false,
    this.hasMore = true,
    this.page = 1,
    this.selectedCategory = 'all',
  });

  EventsState copyWith({
    List<AppEvent>? events,
    bool? isLoading,
    bool? isLoadingMore,
    bool? hasMore,
    int? page,
    String? selectedCategory,
  }) =>
      EventsState(
        events: events ?? this.events,
        isLoading: isLoading ?? this.isLoading,
        isLoadingMore: isLoadingMore ?? this.isLoadingMore,
        hasMore: hasMore ?? this.hasMore,
        page: page ?? this.page,
        selectedCategory: selectedCategory ?? this.selectedCategory,
      );
}

// ── Notifier ──────────────────────────────────────────────────────────────────

class EventsNotifier extends StateNotifier<EventsState> {
  final EventsService _service;

  EventsNotifier(this._service) : super(const EventsState()) {
    fetchEvents();
  }

  Future<void> fetchEvents({String? category}) async {
    final cat = category ?? state.selectedCategory;
    state = state.copyWith(isLoading: true, page: 1, selectedCategory: cat);
    try {
      final events = await _service.getEvents(
        category: cat == 'all' ? null : cat,
        page: 1,
      );
      state = state.copyWith(
        events: events,
        isLoading: false,
        page: 2,
        hasMore: events.length >= 20,
      );
    } catch (_) {
      final filtered = cat == 'all'
          ? _dummyEvents
          : _dummyEvents.where((e) => e.category == cat).toList();
      state = state.copyWith(
        events: filtered,
        isLoading: false,
        hasMore: false,
      );
    }
  }

  Future<void> loadMore() async {
    if (state.isLoadingMore || !state.hasMore) return;
    state = state.copyWith(isLoadingMore: true);
    try {
      final more = await _service.getEvents(
        category: state.selectedCategory == 'all'
            ? null
            : state.selectedCategory,
        page: state.page,
      );
      state = state.copyWith(
        events: [...state.events, ...more],
        isLoadingMore: false,
        page: state.page + 1,
        hasMore: more.length >= 20,
      );
    } catch (_) {
      state = state.copyWith(isLoadingMore: false, hasMore: false);
    }
  }

  Future<bool> joinEvent(String id, {String status = 'going'}) async {
    try {
      await _service.joinEvent(id, status: status);
      _updateEvent(id, isAttending: true, myStatus: status);
      return true;
    } catch (_) {
      return false;
    }
  }

  Future<void> leaveEvent(String id) async {
    try {
      await _service.leaveEvent(id);
      _updateEvent(id, isAttending: false, myStatus: 'cancelled');
    } catch (_) {}
  }

  Future<AppEvent?> createEvent(Map<String, dynamic> body) async {
    try {
      final event = await _service.createEvent(body);
      state = state.copyWith(events: [event, ...state.events]);
      return event;
    } catch (_) {
      return null;
    }
  }

  void _updateEvent(String id,
      {required bool isAttending, required String myStatus}) {
    final idx = state.events.indexWhere((e) => e.id == id);
    if (idx == -1) return;
    final e = state.events[idx];
    final delta = isAttending ? 1 : -1;
    final newList = [...state.events];
    newList[idx] = e.copyWith(
      isAttending: isAttending,
      myStatus: myStatus,
      currentAttendees: (e.currentAttendees + delta).clamp(0, e.maxAttendees),
    );
    state = state.copyWith(events: newList);
  }
}

// ── Provider ──────────────────────────────────────────────────────────────────

final _eventsServiceProvider = Provider<EventsService>(
  (ref) => EventsService(ref.watch(apiClientProvider)),
);

final eventsProvider =
    StateNotifierProvider<EventsNotifier, EventsState>((ref) {
  return EventsNotifier(ref.watch(_eventsServiceProvider));
});
