import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../api/api_client.dart';
import '../api/popular_service.dart';
import '../dummy/dummy_data.dart';
import '../models/user.dart';

// ── Provider ──────────────────────────────────────────────────────────────────

final _popularApiClientProvider = Provider((ref) => ApiClient());

final popularServiceProvider = Provider(
  (ref) => PopularService(ref.read(_popularApiClientProvider)),
);

// ── State ─────────────────────────────────────────────────────────────────────

class PopularEntry {
  final int rank;
  final String source; // 'system' | 'ticket'
  final int ticketCount;
  final UserModel user;

  const PopularEntry({
    required this.rank,
    required this.source,
    required this.user,
    this.ticketCount = 0,
  });

  factory PopularEntry.fromJson(Map<String, dynamic> json) {
    return PopularEntry(
      rank: (json['rank'] as num?)?.toInt() ?? 0,
      source: json['source'] as String? ?? 'system',
      ticketCount: (json['ticketCount'] as num?)?.toInt() ?? 0,
      user: UserModel.fromJson(json['user'] as Map<String, dynamic>),
    );
  }
}

class PopularState {
  final List<PopularEntry> entries;
  final bool isLoading;
  final String? error;
  final bool ticketPurchaseSuccess;
  final int myTickets;
  final int maxTickets;

  const PopularState({
    this.entries = const [],
    this.isLoading = false,
    this.error,
    this.ticketPurchaseSuccess = false,
    this.myTickets = 5,
    this.maxTickets = 5,
  });

  PopularState copyWith({
    List<PopularEntry>? entries,
    bool? isLoading,
    String? error,
    bool? ticketPurchaseSuccess,
    int? myTickets,
    int? maxTickets,
  }) =>
      PopularState(
        entries: entries ?? this.entries,
        isLoading: isLoading ?? this.isLoading,
        error: error,
        ticketPurchaseSuccess:
            ticketPurchaseSuccess ?? this.ticketPurchaseSuccess,
        myTickets: myTickets ?? this.myTickets,
        maxTickets: maxTickets ?? this.maxTickets,
      );
}

// ── Notifier ──────────────────────────────────────────────────────────────────

class PopularNotifier extends StateNotifier<PopularState> {
  final PopularService _service;

  PopularNotifier(this._service) : super(const PopularState()) {
    fetchPopular();
    _fetchMyTickets();
  }

  Future<void> _fetchMyTickets() async {
    try {
      final data = await _service.getMyTickets();
      state = state.copyWith(
        myTickets: (data['remaining'] as num?)?.toInt() ?? 5,
        maxTickets: (data['max'] as num?)?.toInt() ?? 5,
      );
    } catch (_) {}
  }

  Future<void> fetchPopular({String countryCode = 'MY'}) async {
    state = state.copyWith(isLoading: true);
    try {
      if (kUseDummyData) {
        await Future.delayed(const Duration(milliseconds: 400));
        final entries = DummyData.popularUsers.asMap().entries.map((e) {
          return PopularEntry(
            rank: e.key + 1,
            source: e.key < 10 ? 'system' : 'ticket',
            user: e.value,
          );
        }).toList();
        state = state.copyWith(entries: entries, isLoading: false);
        return;
      }
      final raw = await _service.getTodayLeaderboard();
      final entries = raw.map(PopularEntry.fromJson).toList();
      state = state.copyWith(entries: entries, isLoading: false);
    } catch (e) {
      state = state.copyWith(isLoading: false, error: e.toString());
    }
  }

  Future<void> purchaseTicket() async {
    if (kUseDummyData) {
      state = state.copyWith(ticketPurchaseSuccess: true);
      return;
    }
    await _service.purchaseTicket();
    state = state.copyWith(ticketPurchaseSuccess: true);
  }

  Future<bool> useTicketFor(String targetUserId) async {
    if (kUseDummyData) {
      state = state.copyWith(myTickets: (state.myTickets - 1).clamp(0, state.maxTickets));
      return true;
    }
    try {
      final result = await _service.useTicketFor(targetUserId);
      final remaining = (result['remaining'] as num?)?.toInt();
      if (remaining != null) state = state.copyWith(myTickets: remaining);
      await fetchPopular();
      return true;
    } catch (_) {
      return false;
    }
  }
}

final popularProvider = StateNotifierProvider<PopularNotifier, PopularState>(
  (ref) => PopularNotifier(ref.read(popularServiceProvider)),
);
