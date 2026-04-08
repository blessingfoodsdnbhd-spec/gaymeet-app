import 'dart:async';
import 'package:socket_io_client/socket_io_client.dart' as io;
import '../../config/constants.dart';
import '../models/message.dart';

class IncomingCallData {
  final String callId;
  final String callerId;
  final String callerName;
  final String? callerAvatar;
  final String type; // 'voice' | 'video'

  const IncomingCallData({
    required this.callId,
    required this.callerId,
    required this.callerName,
    this.callerAvatar,
    required this.type,
  });
}

class SocketService {
  io.Socket? _socket;
  final _messageController = StreamController<MessageModel>.broadcast();
  final _readController = StreamController<Map<String, dynamic>>.broadcast();
  final _onlineController = StreamController<Map<String, dynamic>>.broadcast();
  // ── Call streams ────────────────────────────────────────────────────────────
  final _incomingCallController = StreamController<IncomingCallData>.broadcast();
  final _callAcceptedController = StreamController<String>.broadcast(); // callId
  final _callDeclinedController = StreamController<String>.broadcast(); // callId
  final _callEndedController = StreamController<Map<String, dynamic>>.broadcast();
  final _callBusyController = StreamController<String>.broadcast(); // receiverId

  Stream<MessageModel> get onMessage => _messageController.stream;
  Stream<Map<String, dynamic>> get onRead => _readController.stream;
  Stream<Map<String, dynamic>> get onPresence => _onlineController.stream;
  Stream<IncomingCallData> get onIncomingCall => _incomingCallController.stream;
  Stream<String> get onCallAccepted => _callAcceptedController.stream;
  Stream<String> get onCallDeclined => _callDeclinedController.stream;
  Stream<Map<String, dynamic>> get onCallEnded => _callEndedController.stream;
  Stream<String> get onCallBusy => _callBusyController.stream;

  bool get isConnected => _socket?.connected ?? false;

  void connect(String token) {
    _socket = io.io(
      AppConstants.wsUrl,
      io.OptionBuilder()
          .setTransports(['websocket'])
          .setAuth({'token': token})
          .disableAutoConnect()
          .build(),
    );

    _socket!.onConnect((_) {
      print('Socket connected');
    });

    _socket!.onDisconnect((_) {
      print('Socket disconnected');
    });

    _socket!.on('chat:receive', (data) {
      final message = MessageModel.fromJson(Map<String, dynamic>.from(data));
      _messageController.add(message);
    });

    _socket!.on('chat:read', (data) {
      _readController.add(Map<String, dynamic>.from(data));
    });

    _socket!.on('user:online', (data) {
      _onlineController.add({'userId': data['userId'], 'online': true});
    });

    _socket!.on('user:offline', (data) {
      _onlineController.add({'userId': data['userId'], 'online': false});
    });

    // ── Call events ──────────────────────────────────────────────────────────
    _socket!.on('call:incoming', (data) {
      final d = Map<String, dynamic>.from(data);
      _incomingCallController.add(IncomingCallData(
        callId: d['callId'] ?? '',
        callerId: d['callerId'] ?? '',
        callerName: d['callerName'] ?? '',
        callerAvatar: d['callerAvatar'],
        type: d['type'] ?? 'voice',
      ));
    });

    _socket!.on('call:accepted', (data) {
      final d = Map<String, dynamic>.from(data);
      _callAcceptedController.add(d['callId'] ?? '');
    });

    _socket!.on('call:declined', (data) {
      final d = Map<String, dynamic>.from(data);
      _callDeclinedController.add(d['callId'] ?? '');
    });

    _socket!.on('call:ended', (data) {
      _callEndedController.add(Map<String, dynamic>.from(data));
    });

    _socket!.on('call:busy', (data) {
      final d = Map<String, dynamic>.from(data);
      _callBusyController.add(d['receiverId'] ?? '');
    });

    _socket!.connect();
  }

  void sendMessage(String matchId, String content, {String type = 'text'}) {
    _socket?.emit('chat:send', {
      'matchId': matchId,
      'content': content,
      'type': type,
    });
  }

  void markRead(String matchId) {
    _socket?.emit('chat:read', {'matchId': matchId});
  }

  // ── Call methods ─────────────────────────────────────────────────────────────
  void initiateCall(String receiverId, String type) {
    _socket?.emit('call:initiate', {'receiverId': receiverId, 'type': type});
  }

  void acceptCall(String callId) {
    _socket?.emit('call:accept', {'callId': callId});
  }

  void declineCall(String callId) {
    _socket?.emit('call:decline', {'callId': callId});
  }

  void endCall(String callId, int duration) {
    _socket?.emit('call:end', {'callId': callId, 'duration': duration});
  }

  void disconnect() {
    _socket?.disconnect();
    _socket?.dispose();
    _socket = null;
  }

  void dispose() {
    disconnect();
    _messageController.close();
    _readController.close();
    _onlineController.close();
    _incomingCallController.close();
    _callAcceptedController.close();
    _callDeclinedController.close();
    _callEndedController.close();
    _callBusyController.close();
  }
}
