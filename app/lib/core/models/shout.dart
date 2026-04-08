import 'user.dart';

class ShoutModel {
  final String id;
  final UserModel user;
  final String content;
  final double? distance;
  final DateTime createdAt;
  final DateTime expiresAt;

  const ShoutModel({
    required this.id,
    required this.user,
    required this.content,
    this.distance,
    required this.createdAt,
    required this.expiresAt,
  });

  bool get isExpired => DateTime.now().isAfter(expiresAt);

  factory ShoutModel.fromJson(Map<String, dynamic> json) {
    return ShoutModel(
      id: json['id'] ?? '',
      user: UserModel.fromJson(json['user'] as Map<String, dynamic>),
      content: json['content'] ?? '',
      distance: json['distance']?.toDouble(),
      createdAt: DateTime.parse(json['createdAt']),
      expiresAt: DateTime.parse(json['expiresAt']),
    );
  }
}
