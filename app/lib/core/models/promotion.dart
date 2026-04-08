enum PromotionType { banner, interstitial, both }

class Promotion {
  final String id;
  final String imageUrl;
  final String title;
  final String subtitle;
  final String? actionUrl;
  final PromotionType type;
  final DateTime startDate;
  final DateTime endDate;
  final bool isActive;

  const Promotion({
    required this.id,
    required this.imageUrl,
    required this.title,
    required this.subtitle,
    this.actionUrl,
    required this.type,
    required this.startDate,
    required this.endDate,
    required this.isActive,
  });

  factory Promotion.fromJson(Map<String, dynamic> json) => Promotion(
        id: json['id'] as String,
        imageUrl: json['imageUrl'] as String,
        title: json['title'] as String,
        subtitle: json['subtitle'] as String,
        actionUrl: json['actionUrl'] as String?,
        type: PromotionType.values.firstWhere(
          (e) => e.name == (json['type'] as String? ?? 'banner'),
          orElse: () => PromotionType.banner,
        ),
        startDate: DateTime.parse(json['startDate'] as String),
        endDate: DateTime.parse(json['endDate'] as String),
        isActive: json['isActive'] as bool? ?? true,
      );

  bool get isCurrentlyActive {
    final now = DateTime.now();
    return isActive && now.isAfter(startDate) && now.isBefore(endDate);
  }
}
