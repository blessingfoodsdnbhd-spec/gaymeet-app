import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../api/api_client.dart';
import '../models/user.dart';
import 'auth_provider.dart';
import 'filter_provider.dart';
import 'teleport_provider.dart';

final nearbyUsersProvider =
    StateNotifierProvider<NearbyUsersNotifier, AsyncValue<List<UserModel>>>(
        (ref) {
  return NearbyUsersNotifier(ref.watch(apiClientProvider), ref);
});

final discoverUsersProvider =
    StateNotifierProvider<DiscoverUsersNotifier, AsyncValue<List<UserModel>>>(
        (ref) {
  return DiscoverUsersNotifier(ref.watch(apiClientProvider), ref);
});

class NearbyUsersNotifier extends StateNotifier<AsyncValue<List<UserModel>>> {
  final ApiClient _api;
  final Ref _ref;

  NearbyUsersNotifier(this._api, this._ref) : super(const AsyncValue.loading());

  Future<void> fetchNearby({
    double radius = 50,
    int page = 1,
    DiscoveryFilter? filter,
  }) async {
    state = const AsyncValue.loading();
    try {
      // Use virtual location if teleport is active
      final teleport = _ref.read(teleportProvider);
      final extraParams = teleport.isActive &&
              teleport.virtualLat != null &&
              teleport.virtualLng != null
          ? {
              'lat': teleport.virtualLat,
              'lng': teleport.virtualLng,
            }
          : <String, dynamic>{};

      final response = await _api.dio.get('/users/nearby', queryParameters: {
        'radius': radius,
        'page': page,
        'limit': 20,
        ...extraParams,
        if (filter != null) ...filter.toQueryParams(),
      });
      final List<dynamic> data = response.data['data'];
      final myId = _ref.read(authProvider).user?.id ?? '';
      final users = data
          .map((u) => UserModel.fromJson(u))
          .where((u) => u.id != myId)
          .toList();
      state = AsyncValue.data(users);
    } catch (e, st) {
      state = AsyncValue.error(e, st);
    }
  }

  Future<void> updateLocation(double lat, double lng,
      {DiscoveryFilter? filter}) async {
    try {
      await _api.dio.put('/users/me/location', data: {
        'latitude': lat,
        'longitude': lng,
      });
      await fetchNearby(filter: filter);
    } catch (_) {}
  }

  /// Immediately remove a user by id from the local nearby list.
  /// Called after blocking so the tile never reappears.
  void removeUser(String userId) {
    state.whenData((users) {
      state = AsyncValue.data(users.where((u) => u.id != userId).toList());
    });
  }
}

class DiscoverUsersNotifier extends StateNotifier<AsyncValue<List<UserModel>>> {
  final ApiClient _api;

  final Ref _ref;

  DiscoverUsersNotifier(this._api, this._ref) : super(const AsyncValue.loading());

  Future<void> fetchDiscoverUsers({DiscoveryFilter? filter}) async {
    state = const AsyncValue.loading();
    try {
      final response = await _api.dio.get('/users/discover', queryParameters: {
        if (filter != null) ...filter.toQueryParams(),
      });
      final List<dynamic> data = response.data['data'];
      final myId = _ref.read(authProvider).user?.id ?? '';
      final users = data
          .map((u) => UserModel.fromJson(u))
          .where((u) => u.id != myId)
          .toList();
      state = AsyncValue.data(users);
    } catch (e, st) {
      state = AsyncValue.error(e, st);
    }
  }

  void removeFirst() {
    state.whenData((users) {
      if (users.isNotEmpty) {
        state = AsyncValue.data(users.sublist(1));
      }
    });
  }

  /// Immediately remove a user by id from the local discover list.
  /// Called after blocking so the card never reappears.
  void removeUser(String userId) {
    state.whenData((users) {
      state = AsyncValue.data(users.where((u) => u.id != userId).toList());
    });
  }
}
