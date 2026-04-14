class BusinessProfile {
  final String id;
  final String businessName;
  final String category;
  final String description;
  final String? logo;
  final String? coverImage;
  final String address;
  final String? phone;
  final String? website;
  final String? openingHours;
  final bool isVerified;
  final bool isActive;
  final DateTime? promotedUntil;
  final bool isPromoted;
  final int totalViews;
  final int totalClicks;
  final int weeklyViews;

  const BusinessProfile({
    required this.id,
    required this.businessName,
    required this.category,
    this.description = '',
    this.logo,
    this.coverImage,
    this.address = '',
    this.phone,
    this.website,
    this.openingHours,
    this.isVerified = false,
    this.isActive = true,
    this.promotedUntil,
    this.isPromoted = false,
    this.totalViews = 0,
    this.totalClicks = 0,
    this.weeklyViews = 0,
  });

  factory BusinessProfile.fromJson(Map<String, dynamic> j) => BusinessProfile(
        id: j['_id'] ?? '',
        businessName: j['businessName'] ?? '',
        category: j['category'] ?? 'other',
        description: j['description'] ?? '',
        logo: j['logo'],
        coverImage: j['coverImage'],
        address: j['address'] ?? '',
        phone: j['phone'],
        website: j['website'],
        openingHours: j['openingHours'],
        isVerified: j['isVerified'] ?? false,
        isActive: j['isActive'] ?? true,
        promotedUntil: j['promotedUntil'] != null ? DateTime.tryParse(j['promotedUntil']) : null,
        isPromoted: j['isPromoted'] ?? false,
        totalViews: (j['totalViews'] ?? 0).toInt(),
        totalClicks: (j['totalClicks'] ?? 0).toInt(),
        weeklyViews: (j['weeklyViews'] ?? 0).toInt(),
      );

  static String categoryLabel(String cat) {
    switch (cat) {
      case 'bar': return '酒吧';
      case 'club': return '夜店';
      case 'restaurant': return '餐厅';
      case 'sauna': return '桑拿';
      case 'hotel': return '酒店';
      case 'gym': return '健身房';
      default: return '其他';
    }
  }

  static String categoryEmoji(String cat) {
    switch (cat) {
      case 'bar': return '🍺';
      case 'club': return '🎵';
      case 'restaurant': return '🍜';
      case 'sauna': return '🧖';
      case 'hotel': return '🏨';
      case 'gym': return '💪';
      default: return '🏪';
    }
  }
}
