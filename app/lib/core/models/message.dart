class MessageModel {
  final String id;
  final String matchId;
  final String senderId;
  final String? senderNickname;
  final String content;
  final String type; // 'text' | 'sticker'
  final bool isRead;
  final DateTime createdAt;

  MessageModel({
    required this.id,
    required this.matchId,
    required this.senderId,
    this.senderNickname,
    required this.content,
    this.type = 'text',
    this.isRead = false,
    required this.createdAt,
  });

  bool get isSticker => type == 'sticker';

  factory MessageModel.fromJson(Map<String, dynamic> json) {
    return MessageModel(
      id: json['id'] ?? json['_id'] ?? '',
      matchId: json['matchId'] ?? '',
      senderId: json['senderId'] ?? '',
      senderNickname: json['senderNickname'],
      content: json['content'] ?? '',
      type: json['type'] ?? 'text',
      isRead: json['isRead'] ?? false,
      createdAt: DateTime.tryParse(json['createdAt'] ?? '') ?? DateTime.now(),
    );
  }
}
