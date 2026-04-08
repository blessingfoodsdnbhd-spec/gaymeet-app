class StickerPack {
  final String id;
  final String name;
  final String description;
  final String coverEmoji;
  final List<Sticker> stickers;
  final int price;
  final String category;
  final int totalDownloads;
  final bool isOwned;

  const StickerPack({
    required this.id,
    required this.name,
    required this.description,
    required this.coverEmoji,
    required this.stickers,
    required this.price,
    required this.category,
    required this.totalDownloads,
    required this.isOwned,
  });

  bool get isFree => price == 0;

  factory StickerPack.fromJson(Map<String, dynamic> json) {
    final stickersData = json['stickers'] as List? ?? [];
    return StickerPack(
      id: json['_id'] ?? json['id'] ?? '',
      name: json['name'] ?? '',
      description: json['description'] ?? '',
      coverEmoji: json['coverEmoji'] ?? '😀',
      stickers: stickersData
          .map((s) => Sticker.fromJson(s as Map<String, dynamic>))
          .toList(),
      price: json['price'] ?? 0,
      category: json['category'] ?? 'new',
      totalDownloads: json['totalDownloads'] ?? 0,
      isOwned: json['isOwned'] ?? false,
    );
  }

  StickerPack copyWith({bool? isOwned}) => StickerPack(
        id: id,
        name: name,
        description: description,
        coverEmoji: coverEmoji,
        stickers: stickers,
        price: price,
        category: category,
        totalDownloads: totalDownloads,
        isOwned: isOwned ?? this.isOwned,
      );
}

class Sticker {
  final String id;
  final String emoji;
  final String? imageUrl;

  const Sticker({required this.id, required this.emoji, this.imageUrl});

  factory Sticker.fromJson(Map<String, dynamic> json) => Sticker(
        id: json['id'] ?? '',
        emoji: json['emoji'] ?? '😀',
        imageUrl: json['imageUrl'],
      );
}
