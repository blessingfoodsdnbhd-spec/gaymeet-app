import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../api/business_service.dart';
import 'auth_provider.dart';
import '../models/business_profile.dart';

final businessServiceProvider = Provider<BusinessService>(
  (ref) => BusinessService(ref.watch(apiClientProvider)),
);

// ── State ─────────────────────────────────────────────────────────────────────

class BusinessState {
  final BusinessProfile? profile;
  final List<BusinessProfile> promoted;
  final bool isLoading;
  final String? error;

  const BusinessState({
    this.profile,
    this.promoted = const [],
    this.isLoading = false,
    this.error,
  });

  BusinessState copyWith({
    BusinessProfile? profile,
    List<BusinessProfile>? promoted,
    bool? isLoading,
    String? error,
  }) =>
      BusinessState(
        profile: profile ?? this.profile,
        promoted: promoted ?? this.promoted,
        isLoading: isLoading ?? this.isLoading,
        error: error,
      );
}

// ── Notifier ──────────────────────────────────────────────────────────────────

class BusinessNotifier extends StateNotifier<BusinessState> {
  final BusinessService _service;

  BusinessNotifier(this._service) : super(const BusinessState()) {
    _init();
  }

  Future<void> _init() async {
    loadPromoted();
    try {
      final profile = await _service.getProfile();
      state = state.copyWith(profile: profile);
    } catch (_) {}
  }

  Future<void> loadPromoted() async {
    try {
      final list = await _service.getPromoted();
      state = state.copyWith(promoted: list);
    } catch (_) {}
  }

  Future<String?> register(Map<String, dynamic> data) async {
    state = state.copyWith(isLoading: true);
    try {
      final profile = await _service.register(data);
      state = state.copyWith(profile: profile, isLoading: false);
      return null;
    } catch (e) {
      final msg = e.toString().replaceAll('Exception: ', '');
      state = state.copyWith(isLoading: false, error: msg);
      return msg;
    }
  }

  Future<String?> update(Map<String, dynamic> data) async {
    state = state.copyWith(isLoading: true);
    try {
      final profile = await _service.updateProfile(data);
      state = state.copyWith(profile: profile, isLoading: false);
      return null;
    } catch (e) {
      final msg = e.toString().replaceAll('Exception: ', '');
      state = state.copyWith(isLoading: false, error: msg);
      return msg;
    }
  }

  Future<String?> promote(String plan) async {
    state = state.copyWith(isLoading: true);
    try {
      await _service.promote(plan);
      final profile = await _service.getProfile();
      state = state.copyWith(profile: profile, isLoading: false);
      return null;
    } catch (e) {
      final msg = e.toString().replaceAll('Exception: ', '');
      state = state.copyWith(isLoading: false, error: msg);
      return msg;
    }
  }

  Future<Map<String, dynamic>?> getDashboard() async {
    try {
      return await _service.getDashboard();
    } catch (_) {
      return null;
    }
  }
}

final businessProvider = StateNotifierProvider<BusinessNotifier, BusinessState>(
  (ref) => BusinessNotifier(ref.watch(businessServiceProvider)),
);
