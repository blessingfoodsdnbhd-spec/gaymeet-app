class Gift {
  final String id;
  final String name;
  final String icon;
  final int price;
  final String category; // romantic / fun / luxury

  const Gift({
    required this.id,
    required this.name,
    required this.icon,
    required this.price,
    required this.category,
  });

  factory Gift.fromJson(Map<String, dynamic> j) => Gift(
        id: (j['_id'] ?? j['id'] ?? '') as String,
        name: (j['name'] ?? '') as String,
        icon: (j['icon'] ?? '🎁') as String,
        price: (j['price'] as num?)?.toInt() ?? 0,
        category: (j['category'] ?? 'fun') as String,
      );
}

class GiftSender {
  final String id;
  final String nickname;
  final String? avatarUrl;
  final String? countryCode;

  const GiftSender({
    required this.id,
    required this.nickname,
    this.avatarUrl,
    this.countryCode,
  });

  factory GiftSender.fromJson(Map<String, dynamic> j) => GiftSender(
        id: (j['_id'] ?? j['id'] ?? '') as String,
        nickname: (j['nickname'] ?? '') as String,
        avatarUrl: j['avatarUrl'] as String?,
        countryCode: j['countryCode'] as String?,
      );
}

class GiftTransaction {
  final String id;
  final GiftSender sender;
  final Gift gift;
  final String? message;
  final int coins;
  final bool isFreeGift;
  final DateTime createdAt;

  const GiftTransaction({
    required this.id,
    required this.sender,
    required this.gift,
    this.message,
    required this.coins,
    required this.isFreeGift,
    required this.createdAt,
  });

  factory GiftTransaction.fromJson(Map<String, dynamic> j) => GiftTransaction(
        id: (j['_id'] ?? j['id'] ?? '') as String,
        sender: GiftSender.fromJson(j['sender'] as Map<String, dynamic>),
        gift: Gift.fromJson(j['gift'] as Map<String, dynamic>),
        message: j['message'] as String?,
        coins: (j['coins'] as num?)?.toInt() ?? 0,
        isFreeGift: (j['isFreeGift'] as bool?) ?? false,
        createdAt: DateTime.tryParse(j['createdAt'] as String? ?? '') ??
            DateTime.now(),
      );
}

class CoinPackage {
  final String id;
  final int coins;
  final int bonus;
  final double price;
  final String currency;
  final String label;
  final bool bestValue;
  final bool popular;

  const CoinPackage({
    required this.id,
    required this.coins,
    this.bonus = 0,
    required this.price,
    required this.currency,
    required this.label,
    this.bestValue = false,
    this.popular = false,
  });

  int get totalCoins => coins + bonus;

  factory CoinPackage.fromJson(Map<String, dynamic> j) => CoinPackage(
        id: (j['id'] ?? '') as String,
        coins: (j['coins'] as num?)?.toInt() ?? 0,
        bonus: (j['bonus'] as num?)?.toInt() ?? 0,
        price: (j['price'] as num?)?.toDouble() ?? 0,
        currency: (j['currency'] ?? 'MYR') as String,
        label: (j['label'] ?? '') as String,
        bestValue: (j['bestValue'] as bool?) ?? false,
        popular: (j['popular'] as bool?) ?? false,
      );
}
