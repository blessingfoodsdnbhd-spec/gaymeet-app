import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../api/places_service.dart';
import '../models/place.dart';
import 'auth_provider.dart';

final placesServiceProvider = Provider<PlacesService>((ref) {
  return PlacesService(ref.watch(apiClientProvider));
});

// ── State ─────────────────────────────────────────────────────────────────────

class PlacesState {
  final bool isLoading;
  final bool isLoadingMore;
  final String? error;
  final List<Place> places;
  final bool hasMore;
  final int currentPage;
  final String selectedCategory;
  final String sortBy;
  final String searchQuery;
  final List<Place> savedPlaces;
  final List<Place> myPlaces;

  const PlacesState({
    this.isLoading = false,
    this.isLoadingMore = false,
    this.error,
    this.places = const [],
    this.hasMore = false,
    this.currentPage = 1,
    this.selectedCategory = 'all',
    this.sortBy = 'newest',
    this.searchQuery = '',
    this.savedPlaces = const [],
    this.myPlaces = const [],
  });

  PlacesState copyWith({
    bool? isLoading,
    bool? isLoadingMore,
    String? error,
    List<Place>? places,
    bool? hasMore,
    int? currentPage,
    String? selectedCategory,
    String? sortBy,
    String? searchQuery,
    List<Place>? savedPlaces,
    List<Place>? myPlaces,
  }) =>
      PlacesState(
        isLoading: isLoading ?? this.isLoading,
        isLoadingMore: isLoadingMore ?? this.isLoadingMore,
        error: error,
        places: places ?? this.places,
        hasMore: hasMore ?? this.hasMore,
        currentPage: currentPage ?? this.currentPage,
        selectedCategory: selectedCategory ?? this.selectedCategory,
        sortBy: sortBy ?? this.sortBy,
        searchQuery: searchQuery ?? this.searchQuery,
        savedPlaces: savedPlaces ?? this.savedPlaces,
        myPlaces: myPlaces ?? this.myPlaces,
      );
}

// ── Notifier ──────────────────────────────────────────────────────────────────

class PlacesNotifier extends StateNotifier<PlacesState> {
  final PlacesService _service;
  final String? _myUserId;

  PlacesNotifier(this._service, this._myUserId) : super(const PlacesState());

  Future<void> load({bool reset = true}) async {
    if (reset) {
      state = state.copyWith(isLoading: true, error: null, currentPage: 1);
    } else {
      if (!state.hasMore) return;
      state = state.copyWith(isLoadingMore: true);
    }

    try {
      final page = reset ? 1 : state.currentPage + 1;
      final result = await _service.getPlaces(
        category: state.selectedCategory == 'all' ? null : state.selectedCategory,
        search: state.searchQuery.isEmpty ? null : state.searchQuery,
        sort: state.sortBy,
        page: page,
        myUserId: _myUserId,
      );
      final newPlaces = result['places'] as List<Place>;
      state = state.copyWith(
        isLoading: false,
        isLoadingMore: false,
        places: reset ? newPlaces : [...state.places, ...newPlaces],
        hasMore: result['hasMore'] as bool,
        currentPage: page,
      );
    } catch (e) {
      state = state.copyWith(
          isLoading: false,
          isLoadingMore: false,
          error: _parseError(e));
    }
  }

  void setCategory(String cat) {
    state = state.copyWith(selectedCategory: cat);
    load();
  }

  void setSort(String sort) {
    state = state.copyWith(sortBy: sort);
    load();
  }

  void setSearch(String q) {
    state = state.copyWith(searchQuery: q);
    load();
  }

  Future<void> loadSaved() async {
    try {
      final saved = await _service.getSavedPlaces(myUserId: _myUserId);
      state = state.copyWith(savedPlaces: saved);
    } catch (_) {}
  }

  Future<void> loadMyPlaces() async {
    try {
      final mine = await _service.getMyPlaces();
      state = state.copyWith(myPlaces: mine);
    } catch (_) {}
  }

  Future<String?> createPlace(Map<String, dynamic> data) async {
    try {
      final place = await _service.createPlace(data);
      state = state.copyWith(places: [place, ...state.places]);
      return null;
    } catch (e) {
      return _parseError(e);
    }
  }

  Future<void> toggleLike(String placeId) async {
    try {
      final result = await _service.toggleLike(placeId);
      final liked = result['liked'] as bool;
      final count = result['likesCount'] as int;
      state = state.copyWith(
        places: state.places.map((p) {
          if (p.id == placeId) {
            return Place(
              id: p.id, author: p.author, name: p.name, description: p.description,
              category: p.category, address: p.address, city: p.city, country: p.country,
              phone: p.phone, website: p.website, openingHours: p.openingHours,
              photos: p.photos, tags: p.tags, priceRange: p.priceRange,
              isVerified: p.isVerified, ratings: p.ratings,
              averageRating: p.averageRating, totalReviews: p.totalReviews,
              likesCount: count, isLiked: liked, lat: p.lat, lng: p.lng,
              createdAt: p.createdAt,
            );
          }
          return p;
        }).toList(),
      );
    } catch (_) {}
  }

  String _parseError(dynamic e) {
    if (e is Exception) return e.toString().replaceAll('Exception: ', '');
    return 'Something went wrong';
  }
}

// ── Provider ──────────────────────────────────────────────────────────────────

final placesProvider =
    StateNotifierProvider<PlacesNotifier, PlacesState>((ref) {
  final userId = ref.watch(authStateProvider).user?.id;
  return PlacesNotifier(ref.watch(placesServiceProvider), userId);
});

// Selected place for detail view
final selectedPlaceProvider = StateProvider<Place?>((ref) => null);
