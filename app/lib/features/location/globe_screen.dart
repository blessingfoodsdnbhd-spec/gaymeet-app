import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:webview_flutter/webview_flutter.dart';
import '../../core/api/api_client.dart';

class GlobeScreen extends StatefulWidget {
  const GlobeScreen({super.key});

  @override
  State<GlobeScreen> createState() => _GlobeScreenState();
}

class _GlobeScreenState extends State<GlobeScreen> {
  late final WebViewController _controller;
  bool _webReady = false;
  bool _dataLoaded = false;
  List<Map<String, dynamic>> _pendingUsers = [];

  @override
  void initState() {
    super.initState();
    _controller = WebViewController()
      ..setJavaScriptMode(JavaScriptMode.unrestricted)
      ..addJavaScriptChannel(
        'UserTapped',
        onMessageReceived: (msg) => _onUserTapped(msg.message),
      )
      ..setNavigationDelegate(NavigationDelegate(
        onPageFinished: (_) {
          setState(() => _webReady = true);
          _maybeInjectUsers();
        },
      ))
      ..loadFlutterAsset('assets/globe.html');

    _fetchLocations();
  }

  Future<void> _fetchLocations() async {
    try {
      final api = ApiClient();
      final resp = await api.dio.get('/api/users/locations');
      final body = resp.data;
      final List raw = body is Map ? (body['data'] ?? body['users'] ?? []) : (body as List);
      final users = raw.map<Map<String, dynamic>>((u) {
        final coords = u['location']?['coordinates'];
        final double? lng = coords != null ? (coords[0] as num).toDouble() : null;
        final double? lat = coords != null ? (coords[1] as num).toDouble() : null;
        final photos = u['photos'] as List? ?? [];
        return {
          'id': u['_id']?.toString() ?? u['id']?.toString() ?? '',
          'nickname': u['nickname'] ?? '用户',
          'lat': lat,
          'lng': lng,
          'avatar': photos.isNotEmpty ? photos[0] : null,
        };
      }).where((u) => u['lat'] != null && u['lng'] != null).toList();

      _pendingUsers = users;
      _maybeInjectUsers();
    } catch (e) {
      _pendingUsers = [];
      _maybeInjectUsers();
    }
  }

  void _maybeInjectUsers() {
    if (!_webReady || _dataLoaded) return;
    _dataLoaded = true;
    if (_pendingUsers.isEmpty) {
      _controller.runJavaScript('window.showEmpty && window.showEmpty()');
    } else {
      final json = jsonEncode(_pendingUsers);
      // Escape for JS string injection
      final escaped = json.replaceAll('\\', '\\\\').replaceAll("'", "\\'");
      _controller.runJavaScript("window.loadUsers('$escaped')");
    }
  }

  void _onUserTapped(String userId) {
    if (userId.isEmpty) return;
    context.push('/user/$userId');
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFF0A0A12),
      appBar: AppBar(
        backgroundColor: const Color(0xFF0A0A12),
        elevation: 0,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_ios_new_rounded, color: Colors.white),
          onPressed: () => context.pop(),
        ),
        title: const Text(
          '全球用户',
          style: TextStyle(
            color: Colors.white,
            fontWeight: FontWeight.w700,
            fontSize: 17,
          ),
        ),
        centerTitle: true,
      ),
      body: WebViewWidget(controller: _controller),
    );
  }
}
