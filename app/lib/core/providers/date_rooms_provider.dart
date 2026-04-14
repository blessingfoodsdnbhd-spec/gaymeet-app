import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../api/date_rooms_service.dart';
import 'auth_provider.dart';
import '../models/date_room.dart';

final dateRoomsServiceProvider = Provider<DateRoomsService>(
  (ref) => DateRoomsService(ref.watch(apiClientProvider)),
);

// ── State ─────────────────────────────────────────────────────────────────────

class DateRoomState {
  final DateRoom? activeRoom;
  final List<DateRoom> history;
  final bool isLoading;
  final String? error;

  const DateRoomState({
    this.activeRoom,
    this.history = const [],
    this.isLoading = false,
    this.error,
  });

  DateRoomState copyWith({
    DateRoom? activeRoom,
    bool clearActive = false,
    List<DateRoom>? history,
    bool? isLoading,
    String? error,
  }) =>
      DateRoomState(
        activeRoom: clearActive ? null : (activeRoom ?? this.activeRoom),
        history: history ?? this.history,
        isLoading: isLoading ?? this.isLoading,
        error: error,
      );
}

// ── Notifier ──────────────────────────────────────────────────────────────────

class DateRoomNotifier extends StateNotifier<DateRoomState> {
  final DateRoomsService _service;

  DateRoomNotifier(this._service) : super(const DateRoomState()) {
    loadActive();
  }

  Future<void> loadActive() async {
    try {
      final room = await _service.getActive();
      state = state.copyWith(activeRoom: room, clearActive: room == null);
    } catch (_) {}
  }

  Future<DateRoom?> createRoom(int durationMinutes) async {
    state = state.copyWith(isLoading: true);
    try {
      final room = await _service.create(durationMinutes);
      state = state.copyWith(activeRoom: room, isLoading: false);
      return room;
    } catch (e) {
      state = state.copyWith(isLoading: false, error: e.toString());
      return null;
    }
  }

  Future<DateRoom?> joinRoom(String roomId) async {
    state = state.copyWith(isLoading: true);
    try {
      final room = await _service.join(roomId);
      state = state.copyWith(activeRoom: room, isLoading: false);
      return room;
    } catch (e) {
      state = state.copyWith(isLoading: false, error: e.toString());
      return null;
    }
  }

  Future<void> endRoom(String roomId) async {
    try {
      await _service.end(roomId);
      state = state.copyWith(clearActive: true);
      loadHistory();
    } catch (e) {
      state = state.copyWith(error: e.toString());
    }
  }

  Future<void> loadHistory() async {
    try {
      final rooms = await _service.getHistory();
      state = state.copyWith(history: rooms);
    } catch (_) {}
  }

  Future<DateRoom?> findByCode(String code) async {
    return _service.findByCode(code);
  }
}

final dateRoomProvider = StateNotifierProvider<DateRoomNotifier, DateRoomState>(
  (ref) => DateRoomNotifier(ref.watch(dateRoomsServiceProvider)),
);
