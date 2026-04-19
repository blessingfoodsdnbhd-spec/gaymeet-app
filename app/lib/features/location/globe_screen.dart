import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:webview_flutter/webview_flutter.dart';
import '../../core/api/api_client.dart';
import '../../core/providers/auth_provider.dart';

class GlobeScreen extends ConsumerStatefulWidget {
  const GlobeScreen({super.key});

  @override
  ConsumerState<GlobeScreen> createState() => _GlobeScreenState();
}

class _GlobeScreenState extends ConsumerState<GlobeScreen> {
  late final WebViewController _controller;
  bool _webReady = false;
  bool _dataLoaded = false;
  Map<String, dynamic>? _pendingData;

  @override
  void initState() {
    super.initState();
    _controller = WebViewController()
      ..setJavaScriptMode(JavaScriptMode.unrestricted)
      ..addJavaScriptChannel(
        'UserTapped',
        onMessageReceived: (msg) => _onUserTapped(msg.message),
      )
      ..addJavaScriptChannel(
        'PostTapped',
        onMessageReceived: (msg) => _onPostTapped(msg.message),
      )
      ..addJavaScriptChannel(
        'PlaceTapped',
        onMessageReceived: (msg) => _onPlaceTapped(msg.message),
      )
      ..setNavigationDelegate(NavigationDelegate(
        onPageFinished: (_) {
          setState(() => _webReady = true);
          _maybeInject();
        },
      ))
      ..loadFlutterAsset('assets/globe.html');

    _fetchPoints();
  }

  Future<void> _fetchPoints() async {
    try {
      final api = ref.read(apiClientProvider);
      final resp = await api.dio.get('/globe/points');
      final body = resp.data;
      final data = body is Map ? (body['data'] ?? body) : body;

      _pendingData = {
        'users':   (data['users']  as List? ?? []).cast<Map<String, dynamic>>(),
        'posts':   (data['posts']  as List? ?? []).cast<Map<String, dynamic>>(),
        'places':  (data['places'] as List? ?? []).cast<Map<String, dynamic>>(),
        'userLat': data['userLat'],
        'userLng': data['userLng'],
      };
      _maybeInject();
    } catch (e) {
      // Fall back to empty globe
      _pendingData = {'users': [], 'posts': [], 'places': []};
      _maybeInject();
    }
  }

  void _maybeInject() {
    if (!_webReady || _dataLoaded || _pendingData == null) return;
    _dataLoaded = true;
    final json = jsonEncode(_pendingData);
    final escaped = json.replaceAll('\\', '\\\\').replaceAll("'", "\\'");
    _controller.runJavaScript("window.loadPoints && window.loadPoints('$escaped')");
  }

  void _onUserTapped(String userId) {
    if (userId.isEmpty) return;
    context.push('/user/$userId');
  }

  void _onPostTapped(String postId) {
    if (postId.isEmpty) return;
    context.push('/moments/$postId');
  }

  void _onPlaceTapped(String placeId) {
    if (placeId.isEmpty) return;
    context.push('/places/$placeId');
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFF060a14),
      appBar: AppBar(
        backgroundColor: const Color(0xFF060a14),
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
