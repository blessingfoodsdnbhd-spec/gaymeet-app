import 'dart:async';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../api/socket_service.dart';
import '../api/api_client.dart';
import '../models/call_log.dart';
import 'auth_provider.dart';

enum CallStatus { idle, outgoingRinging, incomingRinging, connecting, inCall }

class CallState {
  final CallStatus status;
  final String? callId;
  final String? remoteUserId;
  final String? remoteUserName;
  final String? remoteUserAvatar;
  final String callType; // 'voice' | 'video'
  final int durationSeconds;
  final bool isMuted;
  final bool isSpeaker;

  const CallState({
    this.status = CallStatus.idle,
    this.callId,
    this.remoteUserId,
    this.remoteUserName,
    this.remoteUserAvatar,
    this.callType = 'voice',
    this.durationSeconds = 0,
    this.isMuted = false,
    this.isSpeaker = false,
  });

  bool get isIdle => status == CallStatus.idle;

  CallState copyWith({
    CallStatus? status,
    String? callId,
    String? remoteUserId,
    String? remoteUserName,
    String? remoteUserAvatar,
    String? callType,
    int? durationSeconds,
    bool? isMuted,
    bool? isSpeaker,
  }) =>
      CallState(
        status: status ?? this.status,
        callId: callId ?? this.callId,
        remoteUserId: remoteUserId ?? this.remoteUserId,
        remoteUserName: remoteUserName ?? this.remoteUserName,
        remoteUserAvatar: remoteUserAvatar ?? this.remoteUserAvatar,
        callType: callType ?? this.callType,
        durationSeconds: durationSeconds ?? this.durationSeconds,
        isMuted: isMuted ?? this.isMuted,
        isSpeaker: isSpeaker ?? this.isSpeaker,
      );
}

class CallNotifier extends StateNotifier<CallState> {
  final SocketService _socket;
  final ApiClient _api;

  StreamSubscription? _incomingSub;
  StreamSubscription? _acceptedSub;
  StreamSubscription? _declinedSub;
  StreamSubscription? _endedSub;
  Timer? _timer;

  CallNotifier(this._socket, this._api) : super(const CallState()) {
    _listenToCallEvents();
  }

  void _listenToCallEvents() {
    _incomingSub = _socket.onIncomingCall.listen((data) {
      if (state.status != CallStatus.idle) {
        // Already in a call — server handles busy, but just in case
        return;
      }
      state = state.copyWith(
        status: CallStatus.incomingRinging,
        callId: data.callId,
        remoteUserId: data.callerId,
        remoteUserName: data.callerName,
        remoteUserAvatar: data.callerAvatar,
        callType: data.type,
      );
    });

    _acceptedSub = _socket.onCallAccepted.listen((callId) {
      if (state.callId == callId) {
        state = state.copyWith(status: CallStatus.inCall);
        _startTimer();
      }
    });

    _declinedSub = _socket.onCallDeclined.listen((callId) {
      if (state.callId == callId) {
        _reset();
      }
    });

    _endedSub = _socket.onCallEnded.listen((data) {
      if (state.callId == data['callId']) {
        _reset();
      }
    });
  }

  void initiateCall(
      String receiverId, String receiverName, String? avatar, String type) {
    state = state.copyWith(
      status: CallStatus.outgoingRinging,
      remoteUserId: receiverId,
      remoteUserName: receiverName,
      remoteUserAvatar: avatar,
      callType: type,
    );
    _socket.initiateCall(receiverId, type);
  }

  void acceptCall() {
    if (state.callId == null) return;
    _socket.acceptCall(state.callId!);
    state = state.copyWith(status: CallStatus.inCall);
    _startTimer();
  }

  void declineCall() {
    if (state.callId == null) return;
    _socket.declineCall(state.callId!);
    _reset();
  }

  void endCall() {
    if (state.callId == null) {
      _reset();
      return;
    }
    _socket.endCall(state.callId!, state.durationSeconds);
    _reset();
  }

  void toggleMute() {
    state = state.copyWith(isMuted: !state.isMuted);
  }

  void toggleSpeaker() {
    state = state.copyWith(isSpeaker: !state.isSpeaker);
  }

  void _startTimer() {
    _timer?.cancel();
    _timer = Timer.periodic(const Duration(seconds: 1), (_) {
      state = state.copyWith(durationSeconds: state.durationSeconds + 1);
    });
  }

  void _reset() {
    _timer?.cancel();
    _timer = null;
    state = const CallState();
  }

  Future<List<CallLog>> getHistory() async {
    try {
      final res = await _api.dio.get('/calls/history');
      final list = res.data['data'] as List;
      return list.map((e) => CallLog.fromJson(e as Map<String, dynamic>)).toList();
    } catch (_) {
      return [];
    }
  }

  @override
  void dispose() {
    _incomingSub?.cancel();
    _acceptedSub?.cancel();
    _declinedSub?.cancel();
    _endedSub?.cancel();
    _timer?.cancel();
    super.dispose();
  }
}

final callProvider = StateNotifierProvider<CallNotifier, CallState>((ref) {
  return CallNotifier(
    ref.watch(socketServiceProvider),
    ref.watch(apiClientProvider),
  );
});
