import '../models/place.dart';
import 'api_client.dart';

class PlacesService {
  final ApiClient _api;
  PlacesService(this._api);

  Future<Map<String, dynamic>> getPlaces({
    String? category,
    String? city,
    String? search,
    double? lat,
    double? lng,
    double radiusKm = 10,
    String sort = 'newest',
    int page = 1,
    String? myUserId,
  }) async {
    final params = <String, dynamic>{
      if (category != null && category != 'all') 'category': category,
      if (city != null) 'city': city,
      if (search != null && search.isNotEmpty) 'search': search,
      if (lat != null) 'lat': lat,
      if (lng != null) 'lng': lng,
      'radius': radiusKm,
      'sort': sort,
      'page': page,
    };
    final res = await _api.dio.get('/places', queryParameters: params);
    final data = res.data['data'];
    return {
      'places': (data['places'] as List<dynamic>)
          .map((e) => Place.fromJson(e as Map<String, dynamic>, myUserId: myUserId))
          .toList(),
      'hasMore': data['hasMore'] ?? false,
      'total': data['total'] ?? 0,
    };
  }

  Future<Place> getPlace(String id, {String? myUserId}) async {
    final res = await _api.dio.get('/places/$id');
    return Place.fromJson(res.data['data']['place'] as Map<String, dynamic>, myUserId: myUserId);
  }

  Future<Place> createPlace(Map<String, dynamic> data) async {
    final res = await _api.dio.post('/places', data: data);
    return Place.fromJson(res.data['data']['place'] as Map<String, dynamic>);
  }

  Future<Place> updatePlace(String id, Map<String, dynamic> data) async {
    final res = await _api.dio.patch('/places/$id', data: data);
    return Place.fromJson(res.data['data']['place'] as Map<String, dynamic>);
  }

  Future<void> deletePlace(String id) async {
    await _api.dio.delete('/places/$id');
  }

  Future<Map<String, dynamic>> ratePlace(String id, int score, String review) async {
    final res = await _api.dio.post('/places/$id/rate', data: {'score': score, 'review': review});
    return res.data['data'] as Map<String, dynamic>;
  }

  Future<Map<String, dynamic>> toggleLike(String id) async {
    final res = await _api.dio.post('/places/$id/like');
    return res.data['data'] as Map<String, dynamic>;
  }

  Future<List<Place>> getSavedPlaces({String? myUserId}) async {
    final res = await _api.dio.get('/places/saved');
    return (res.data['data']['places'] as List<dynamic>)
        .map((e) => Place.fromJson(e as Map<String, dynamic>, myUserId: myUserId))
        .toList();
  }

  Future<List<Place>> getMyPlaces() async {
    final res = await _api.dio.get('/places/mine');
    return (res.data['data']['places'] as List<dynamic>)
        .map((e) => Place.fromJson(e as Map<String, dynamic>))
        .toList();
  }

  Future<List<PlaceEvent>> getPlaceEvents(String placeId) async {
    final res = await _api.dio.get('/places/$placeId/events');
    return (res.data['data']['events'] as List<dynamic>)
        .map((e) => PlaceEvent.fromJson(e as Map<String, dynamic>))
        .toList();
  }

  Future<PlaceEvent> createPlaceEvent(String placeId, Map<String, dynamic> data) async {
    final res = await _api.dio.post('/places/$placeId/events', data: data);
    return PlaceEvent.fromJson(res.data['data']['event'] as Map<String, dynamic>);
  }
}
