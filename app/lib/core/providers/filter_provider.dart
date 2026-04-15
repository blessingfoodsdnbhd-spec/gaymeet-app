import 'package:flutter_riverpod/flutter_riverpod.dart';

// Sentinel used in copyWith to distinguish "not provided" from explicit null.
const Object _sentinel = Object();

/// Immutable model representing the user's current discovery filter selections.
class DiscoveryFilter {
  // ── Existing filters ──────────────────────────────────────────────────────
  final int ageMin;
  final int ageMax;
  final double maxDistanceKm;
  final Set<String> tags;

  // ── Master toggle ─────────────────────────────────────────────────────────
  final bool filtersEnabled;

  // ── Height filter ─────────────────────────────────────────────────────────
  final bool heightEnabled;
  final int heightMin; // cm
  final int heightMax; // cm

  // ── Weight filter ─────────────────────────────────────────────────────────
  final bool weightEnabled;
  final int weightMin; // kg
  final int weightMax; // kg

  // ── Age filter (separate enabled flag; ageMin/ageMax reused above) ────────
  final bool ageEnabled;

  // ── Personality / profile filters ─────────────────────────────────────────
  final String? role;
  final String? zodiac;
  final String? mbti;
  final String? bloodType;
  final List<String> kinks;

  const DiscoveryFilter({
    this.ageMin = 18,
    this.ageMax = 80,
    this.maxDistanceKm = 50,
    this.tags = const {},
    this.filtersEnabled = false,
    this.heightEnabled = false,
    this.heightMin = 140,
    this.heightMax = 250,
    this.weightEnabled = false,
    this.weightMin = 30,
    this.weightMax = 150,
    this.ageEnabled = false,
    this.role,
    this.zodiac,
    this.mbti,
    this.bloodType,
    this.kinks = const [],
  });

  static const DiscoveryFilter defaults = DiscoveryFilter();

  /// Number of filter dimensions that differ from defaults.
  int get activeCount {
    if (!filtersEnabled) return 0;
    int n = 0;
    if (ageEnabled && (ageMin != defaults.ageMin || ageMax != defaults.ageMax)) {
      n++;
    }
    if (heightEnabled) n++;
    if (weightEnabled) n++;
    if (maxDistanceKm != defaults.maxDistanceKm) n++;
    if (tags.isNotEmpty) n++;
    if (role != null) n++;
    if (zodiac != null) n++;
    if (mbti != null) n++;
    if (bloodType != null) n++;
    if (kinks.isNotEmpty) n++;
    return n;
  }

  bool get isDefault => !filtersEnabled || activeCount == 0;

  DiscoveryFilter copyWith({
    int? ageMin,
    int? ageMax,
    double? maxDistanceKm,
    Set<String>? tags,
    bool? filtersEnabled,
    bool? heightEnabled,
    int? heightMin,
    int? heightMax,
    bool? weightEnabled,
    int? weightMin,
    int? weightMax,
    bool? ageEnabled,
    Object? role = _sentinel,
    Object? zodiac = _sentinel,
    Object? mbti = _sentinel,
    Object? bloodType = _sentinel,
    List<String>? kinks,
  }) {
    return DiscoveryFilter(
      ageMin: ageMin ?? this.ageMin,
      ageMax: ageMax ?? this.ageMax,
      maxDistanceKm: maxDistanceKm ?? this.maxDistanceKm,
      tags: tags ?? this.tags,
      filtersEnabled: filtersEnabled ?? this.filtersEnabled,
      heightEnabled: heightEnabled ?? this.heightEnabled,
      heightMin: heightMin ?? this.heightMin,
      heightMax: heightMax ?? this.heightMax,
      weightEnabled: weightEnabled ?? this.weightEnabled,
      weightMin: weightMin ?? this.weightMin,
      weightMax: weightMax ?? this.weightMax,
      ageEnabled: ageEnabled ?? this.ageEnabled,
      role: identical(role, _sentinel) ? this.role : role as String?,
      zodiac: identical(zodiac, _sentinel) ? this.zodiac : zodiac as String?,
      mbti: identical(mbti, _sentinel) ? this.mbti : mbti as String?,
      bloodType: identical(bloodType, _sentinel) ? this.bloodType : bloodType as String?,
      kinks: kinks ?? this.kinks,
    );
  }

  /// Build the API query-parameter map for this filter.
  Map<String, dynamic> toQueryParams() {
    return {
      'radius': maxDistanceKm,
      if (filtersEnabled) ..._activeParams(),
      if (tags.isNotEmpty) 'tags': tags.join(','),
    };
  }

  Map<String, dynamic> _activeParams() => {
        if (ageEnabled && ageMin != defaults.ageMin) 'ageMin': ageMin,
        if (ageEnabled && ageMax != defaults.ageMax) 'ageMax': ageMax,
        if (heightEnabled) 'heightMin': heightMin,
        if (heightEnabled) 'heightMax': heightMax,
        if (weightEnabled) 'weightMin': weightMin,
        if (weightEnabled) 'weightMax': weightMax,
        if (role != null) 'role': role,
        if (zodiac != null) 'zodiac': zodiac,
        if (mbti != null) 'mbti': mbti,
        if (bloodType != null) 'bloodType': bloodType,
        if (kinks.isNotEmpty) 'kinks': kinks.join(','),
      };

  /// Apply this filter to a local list of users (used for dummy-data mode).
  bool matchesUser({
    int? height,
    int? weight,
    int? age,
  }) {
    if (!filtersEnabled) return true;
    if (heightEnabled && height != null &&
        (height < heightMin || height > heightMax)) { return false; }
    if (weightEnabled && weight != null &&
        (weight < weightMin || weight > weightMax)) { return false; }
    if (ageEnabled && age != null && (age < ageMin || age > ageMax)) {
      return false;
    }
    return true;
  }

  @override
  bool operator ==(Object other) {
    if (identical(this, other)) return true;
    if (other is! DiscoveryFilter) return false;
    return other.ageMin == ageMin &&
        other.ageMax == ageMax &&
        other.maxDistanceKm == maxDistanceKm &&
        other.tags.length == tags.length &&
        other.tags.containsAll(tags) &&
        other.filtersEnabled == filtersEnabled &&
        other.heightEnabled == heightEnabled &&
        other.heightMin == heightMin &&
        other.heightMax == heightMax &&
        other.weightEnabled == weightEnabled &&
        other.weightMin == weightMin &&
        other.weightMax == weightMax &&
        other.ageEnabled == ageEnabled &&
        other.role == role &&
        other.zodiac == zodiac &&
        other.mbti == mbti &&
        other.bloodType == bloodType &&
        other.kinks.length == kinks.length;
  }

  @override
  int get hashCode => Object.hash(ageMin, ageMax, maxDistanceKm, tags.length,
      filtersEnabled, heightEnabled, heightMin, heightMax,
      weightEnabled, weightMin, weightMax, ageEnabled,
      role, zodiac, mbti, bloodType, kinks.length);
}

class FilterNotifier extends StateNotifier<DiscoveryFilter> {
  FilterNotifier() : super(const DiscoveryFilter());

  void apply(DiscoveryFilter filter) => state = filter;
  void reset() => state = const DiscoveryFilter();
}

final filterProvider =
    StateNotifierProvider<FilterNotifier, DiscoveryFilter>((ref) {
  return FilterNotifier();
});
