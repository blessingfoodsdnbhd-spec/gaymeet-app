import 'dart:io';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../api/api_client.dart';
import '../api/verification_service.dart';

enum VerificationStatus { none, pending, approved, rejected }

class VerificationState {
  final VerificationStatus status;
  final String? currentPose;
  final bool isLoading;
  final String? error;

  const VerificationState({
    this.status = VerificationStatus.none,
    this.currentPose,
    this.isLoading = false,
    this.error,
  });

  VerificationState copyWith({
    VerificationStatus? status,
    String? currentPose,
    bool? isLoading,
    String? error,
  }) =>
      VerificationState(
        status: status ?? this.status,
        currentPose: currentPose ?? this.currentPose,
        isLoading: isLoading ?? this.isLoading,
        error: error ?? this.error,
      );
}

class VerificationNotifier extends StateNotifier<VerificationState> {
  final VerificationService _service;

  VerificationNotifier(this._service) : super(const VerificationState()) {
    _loadStatus();
  }

  Future<void> _loadStatus() async {
    try {
      final data = await _service.getStatus();
      final statusStr = data['status'] as String? ?? 'none';
      state = state.copyWith(
        status: _parseStatus(statusStr),
        currentPose: data['pose'] as String?,
      );
    } catch (_) {}
  }

  Future<String> fetchPose() async {
    final pose = await _service.getPose();
    state = state.copyWith(currentPose: pose);
    return pose;
  }

  Future<bool> submit(File selfie) async {
    if (state.currentPose == null) return false;
    state = state.copyWith(isLoading: true, error: null);
    try {
      await _service.submit(selfie: selfie, pose: state.currentPose!);
      state = state.copyWith(
        isLoading: false,
        status: VerificationStatus.pending,
      );
      return true;
    } catch (e) {
      state = state.copyWith(isLoading: false, error: e.toString());
      return false;
    }
  }

  VerificationStatus _parseStatus(String s) {
    switch (s) {
      case 'pending':
        return VerificationStatus.pending;
      case 'approved':
        return VerificationStatus.approved;
      case 'rejected':
        return VerificationStatus.rejected;
      default:
        return VerificationStatus.none;
    }
  }
}

final _verificationServiceProvider = Provider<VerificationService>(
  (ref) => VerificationService(ref.watch(apiClientProvider)),
);

final verificationProvider =
    StateNotifierProvider<VerificationNotifier, VerificationState>(
  (ref) => VerificationNotifier(ref.watch(_verificationServiceProvider)),
);
