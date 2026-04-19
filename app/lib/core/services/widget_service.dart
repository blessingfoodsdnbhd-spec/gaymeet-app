import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:home_widget/home_widget.dart';
import '../api/api_client.dart';

const _appGroup = 'group.com.meetupnearby.app';

class WidgetService {
  static Future<void> init() async {
    await HomeWidget.setAppGroupId(_appGroup);
  }

  static Future<void> refresh(ApiClient api) async {
    try {
      final res = await api.dio.get('/users/widget-data');
      final data = res.data as Map<String, dynamic>;

      await HomeWidget.saveWidgetData<int>('nearbyOnline', data['nearbyOnline'] as int? ?? 0);
      await HomeWidget.saveWidgetData<String>('closestDistance', data['closestDistance'] as String? ?? '--');

      final chats = data['recentChats'];
      if (chats != null) {
        await HomeWidget.saveWidgetData<String>('recentChats', jsonEncode(chats));
      }

      await HomeWidget.updateWidget(iOSName: 'NearbyRadarWidget');
      await HomeWidget.updateWidget(iOSName: 'RecentChatsWidget');
    } catch (e) {
      debugPrint('WidgetService.refresh error: $e');
    }
  }
}
