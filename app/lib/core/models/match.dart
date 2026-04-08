import 'user.dart';

class MatchModel {
  final String matchId;
  final DateTime matchedAt;
  final UserModel user;
  final String? lastMessage;
  final DateTime? lastMessageAt;
  final int unreadCount;

  MatchModel({
    required this.matchId,
    required this.matchedAt,
    required this.user,
    this.lastMessage,
    this.lastMessageAt,
    this.unreadCount = 0,
  });

  factory MatchModel.fromJson(Map<String, dynamic> json) {
    return MatchModel(
      matchId: json['matchId'],
      matchedAt: DateTime.parse(json['matchedAt']),
      user: UserModel.fromJson(json['user']),
      lastMessage: json['lastMessage'],
      lastMessageAt: json['lastMessageAt'] != null
          ? DateTime.parse(json['lastMessageAt'])
          : null,
      unreadCount: json['unreadCount'] ?? 0,
    );
  }
}
