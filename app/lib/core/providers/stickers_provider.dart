import 'package:gaymeet/core/providers/auth_provider.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../api/stickers_service.dart';
import '../models/sticker.dart';

class StickersState {
  final List<StickerPack> allPacks;
  final List<StickerPack> ownedPacks;
  final bool isLoading;
  final String? error;

  const StickersState({
    this.allPacks = const [],
    this.ownedPacks = const [],
    this.isLoading = false,
    this.error,
  });

  StickersState copyWith({
    List<StickerPack>? allPacks,
    List<StickerPack>? ownedPacks,
    bool? isLoading,
    String? error,
  }) =>
      StickersState(
        allPacks: allPacks ?? this.allPacks,
        ownedPacks: ownedPacks ?? this.ownedPacks,
        isLoading: isLoading ?? this.isLoading,
        error: error ?? this.error,
      );
}

class StickersNotifier extends StateNotifier<StickersState> {
  final StickersService _service;

  StickersNotifier(this._service) : super(const StickersState()) {
    fetchAll();
  }

  Future<void> fetchAll() async {
    state = state.copyWith(isLoading: true);
    try {
      final all = await _service.getAllPacks();
      final owned = all.where((p) => p.isOwned).toList();
      state = state.copyWith(allPacks: all, ownedPacks: owned, isLoading: false);
    } catch (e) {
      state = state.copyWith(isLoading: false, error: e.toString());
    }
  }

  Future<bool> purchase(String packId) async {
    final ok = await _service.purchase(packId);
    if (ok) {
      final updated = state.allPacks.map((p) {
        if (p.id == packId) return p.copyWith(isOwned: true);
        return p;
      }).toList();
      final owned = updated.where((p) => p.isOwned).toList();
      state = state.copyWith(allPacks: updated, ownedPacks: owned);
    }
    return ok;
  }
}

final _stickersServiceProvider = Provider<StickersService>(
  (ref) => StickersService(ref.watch(apiClientProvider)),
);

final stickersProvider = StateNotifierProvider<StickersNotifier, StickersState>(
  (ref) => StickersNotifier(ref.watch(_stickersServiceProvider)),
);
