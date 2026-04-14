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
  final UserModel user;

  const PopularEntry({
    required this.rank,
    required this.source,
    required this.user,
  });

  factory PopularEntry.fromJson(Map<String, dynamic> json) {
    return PopularEntry(
      rank: json['rank'] as int,
      source: json['source'] as String? ?? 'system',
      user: UserModel.fromJson(json['user'] as Map<String, dynamic>),
    );
  }
}

class PopularState {
  final List<PopularEntry> entries;
  final bool isLoading;
  final String? error;
  final bool ticketPurchaseSuccess;

  const PopularState({
    this.entries = const [],
    this.isLoading = false,
    this.error,
    this.ticketPurchaseSuccess = false,
  });

  PopularState copyWith({
    List<PopularEntry>? entries,
    bool? isLoading,
    String? error,
    bool? ticketPurchaseSuccess,
  }) =>
      PopularState(
        entries: entries ?? this.entries,
        isLoading: isLoading ?? this.isLoading,
        error: error,
        ticketPurchaseSuccess:
            ticketPurchaseSuccess ?? this.ticketPurchaseSuccess,
      );
}

// ── Notifier ──────────────────────────────────────────────────────────────────

class PopularNotifier extends StateNotifier<PopularState> {
  final PopularService _service;

  PopularNotifier(this._service) : super(const PopularState()) {
    fetchPopular();
  }

  Future<void> fetchPopular({String countryCode = 'MY'}) async {
    state = state.copyWith(isLoading: true);
    try {
      if (kUseDummyData) {
        await Future.delayed(const Duration(milliseconds: 400));
        // Build dummy entries from popularUsers
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
      final raw = await _service.getPopular(countryCode);
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

  Future<void> useTicket({String countryCode = 'MY'}) async {
    if (kUseDummyData) return;
    await _service.useTicket(countryCode);
    await fetchPopular(countryCode: countryCode);
  }
}

final popularProvider = StateNotifierProvider<PopularNotifier, PopularState>(
  (ref) => PopularNotifier(ref.read(popularServiceProvider)),
);
