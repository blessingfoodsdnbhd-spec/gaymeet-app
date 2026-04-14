class QuestionSender {
  final String id;
  final String nickname;
  final String? avatarUrl;

  const QuestionSender({
    required this.id,
    required this.nickname,
    this.avatarUrl,
  });

  factory QuestionSender.fromJson(Map<String, dynamic> json) {
    final rawId = json['_id'] ?? json['id'] ?? '';
    return QuestionSender(
      id: rawId.toString(),
      nickname: json['nickname'] as String? ?? '',
      avatarUrl: json['avatarUrl'] as String?,
    );
  }
}

class Question {
  final String id;
  final String targetUserId;
  final QuestionSender? sender; // null if anonymous
  final String content;
  final String? answer;
  final bool isAnonymous;
  final bool isPublic;
  final DateTime createdAt;
  final DateTime? answeredAt;

  const Question({
    required this.id,
    required this.targetUserId,
    this.sender,
    required this.content,
    this.answer,
    required this.isAnonymous,
    this.isPublic = false,
    required this.createdAt,
    this.answeredAt,
  });

  bool get isAnswered => answer != null && answer!.isNotEmpty;

  factory Question.fromJson(Map<String, dynamic> json) {
    final rawId = json['_id'] ?? json['id'] ?? '';
    final senderJson = json['senderUser'];
    QuestionSender? sender;
    if (senderJson is Map) {
      sender = QuestionSender.fromJson(senderJson as Map<String, dynamic>);
    }

    return Question(
      id: rawId.toString(),
      targetUserId:
          (json['targetUser'] as Map<String, dynamic>?)?['_id']?.toString() ??
              json['targetUser']?.toString() ??
              '',
      sender: sender,
      content: json['content'] as String? ?? '',
      answer: json['answer'] as String?,
      isAnonymous: json['isAnonymous'] as bool? ?? true,
      isPublic: json['isPublic'] as bool? ?? false,
      createdAt: json['createdAt'] != null
          ? DateTime.parse(json['createdAt'])
          : DateTime.now(),
      answeredAt: json['answeredAt'] != null
          ? DateTime.tryParse(json['answeredAt'])
          : null,
    );
  }

  Question copyWith({String? answer, bool? isPublic, DateTime? answeredAt}) =>
      Question(
        id: id,
        targetUserId: targetUserId,
        sender: sender,
        content: content,
        answer: answer ?? this.answer,
        isAnonymous: isAnonymous,
        isPublic: isPublic ?? this.isPublic,
        createdAt: createdAt,
        answeredAt: answeredAt ?? this.answeredAt,
      );
}
