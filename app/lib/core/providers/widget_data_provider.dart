import 'dart:convert';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:home_widget/home_widget.dart';
import '../api/api_client.dart';
import 'auth_provider.dart';

const _appGroup = 'group.com.meetupnearby.app';
const _iOSWidgetName = 'MeYouWidget';
const _androidWidgetName = 'MeYouWidgetProvider';

final widgetDataProvider = Provider<WidgetDataService>((ref) {
  return WidgetDataService(ref.watch(apiClientProvider));
});

class WidgetDataService {
  final ApiClient _api;

  WidgetDataService(this._api) {
    HomeWidget.setAppGroupId(_appGroup);
  }

  Future<void> refresh() async {
    try {
      final resp = await _api.dio.get('/widget-data');
      final data = resp.data['data'] as Map<String, dynamic>;

      final nearbyOnline = data['nearbyOnline'] as int? ?? 0;
      final closestKm = data['closestKm'] as int?;
      final recentChats = data['recentChats'] as List<dynamic>? ?? [];

      await HomeWidget.saveWidgetData<int>('widget_nearbyOnline', nearbyOnline);
      if (closestKm != null) {
        await HomeWidget.saveWidgetData<int>('widget_closestKm', closestKm);
      }
      await HomeWidget.saveWidgetData<String>(
        'widget_recentChats',
        jsonEncode(recentChats),
      );

      await HomeWidget.updateWidget(
        iOSName: _iOSWidgetName,
        androidName: _androidWidgetName,
      );
    } catch (_) {
      // Widget updates are best-effort
    }
  }
}
