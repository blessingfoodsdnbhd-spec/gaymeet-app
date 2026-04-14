import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../config/theme.dart';
import '../../core/providers/subscription_provider.dart';
import '../../core/providers/teleport_provider.dart';

// ── City data ─────────────────────────────────────────────────────────────────

class _City {
  final String name;
  final String country;
  final String flag;
  final double lat;
  final double lng;

  const _City({
    required this.name,
    required this.country,
    required this.flag,
    required this.lat,
    required this.lng,
  });
}

const _cities = [
  // Malaysia
  _City(name: 'Kuala Lumpur', country: 'Malaysia', flag: '🇲🇾', lat: 3.1390, lng: 101.6869),
  _City(name: 'Penang',       country: 'Malaysia', flag: '🇲🇾', lat: 5.4141, lng: 100.3288),
  _City(name: 'Johor Bahru',  country: 'Malaysia', flag: '🇲🇾', lat: 1.4927, lng: 103.7414),
  _City(name: 'Ipoh',         country: 'Malaysia', flag: '🇲🇾', lat: 4.5975, lng: 101.0901),
  _City(name: 'Kuching',      country: 'Malaysia', flag: '🇲🇾', lat: 1.5497, lng: 110.3626),
  _City(name: 'Kota Kinabalu',country: 'Malaysia', flag: '🇲🇾', lat: 5.9804, lng: 116.0735),
  _City(name: 'Melaka',       country: 'Malaysia', flag: '🇲🇾', lat: 2.1896, lng: 102.2501),
  _City(name: 'Shah Alam',    country: 'Malaysia', flag: '🇲🇾', lat: 3.0733, lng: 101.5185),
  // Regional
  _City(name: 'Singapore',    country: 'Singapore',    flag: '🇸🇬', lat: 1.3521,  lng: 103.8198),
  _City(name: 'Bangkok',      country: 'Thailand',     flag: '🇹🇭', lat: 13.7563, lng: 100.5018),
  _City(name: 'Jakarta',      country: 'Indonesia',    flag: '🇮🇩', lat: -6.2088, lng: 106.8456),
  _City(name: 'Manila',       country: 'Philippines',  flag: '🇵🇭', lat: 14.5995, lng: 120.9842),
  _City(name: 'Ho Chi Minh',  country: 'Vietnam',      flag: '🇻🇳', lat: 10.8231, lng: 106.6297),
  _City(name: 'Taipei',       country: 'Taiwan',       flag: '🇹🇼', lat: 25.0330, lng: 121.5654),
  _City(name: 'Tokyo',        country: 'Japan',        flag: '🇯🇵', lat: 35.6762, lng: 139.6503),
  _City(name: 'Seoul',        country: 'South Korea',  flag: '🇰🇷', lat: 37.5665, lng: 126.9780),
  _City(name: 'Hong Kong',    country: 'Hong Kong',    flag: '🇭🇰', lat: 22.3193, lng: 114.1694),
  _City(name: 'Sydney',       country: 'Australia',    flag: '🇦🇺', lat: -33.8688, lng: 151.2093),
  _City(name: 'London',       country: 'UK',           flag: '🇬🇧', lat: 51.5074, lng: -0.1278),
  _City(name: 'New York',     country: 'USA',          flag: '🇺🇸', lat: 40.7128, lng: -74.0060),
];

// ── Screen ────────────────────────────────────────────────────────────────────

class TeleportScreen extends ConsumerStatefulWidget {
  const TeleportScreen({super.key});

  @override
  ConsumerState<TeleportScreen> createState() => _TeleportScreenState();
}

class _TeleportScreenState extends ConsumerState<TeleportScreen> {
  String _search = '';
  final _searchCtrl = TextEditingController();

  @override
  void dispose() {
    _searchCtrl.dispose();
    super.dispose();
  }

  List<_City> get _filtered {
    if (_search.isEmpty) return _cities;
    final q = _search.toLowerCase();
    return _cities.where((c) =>
        c.name.toLowerCase().contains(q) ||
        c.country.toLowerCase().contains(q)).toList();
  }

  void _selectCity(_City city, bool isPremium) {
    if (!isPremium) {
      _showPremiumGate();
      return;
    }
    ref.read(teleportProvider.notifier).activate(city.lat, city.lng, city.name);
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text('传送到 ${city.name} ✈️'),
        backgroundColor: AppTheme.primary,
        duration: const Duration(seconds: 2),
      ),
    );
    context.pop();
  }

  void _deactivate() {
    ref.read(teleportProvider.notifier).deactivate();
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(content: Text('已恢复真实位置')),
    );
  }

  void _showPremiumGate() {
    showModalBottomSheet(
      context: context,
      backgroundColor: AppTheme.card,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      builder: (_) => Padding(
        padding: const EdgeInsets.all(28),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: 40, height: 4,
              decoration: BoxDecoration(
                color: AppTheme.textHint,
                borderRadius: BorderRadius.circular(2),
              ),
            ),
            const SizedBox(height: 20),
            ShaderMask(
              shaderCallback: (r) => AppTheme.brandGradient.createShader(r),
              child: const Icon(Icons.flight_rounded,
                  size: 52, color: Colors.white),
            ),
            const SizedBox(height: 14),
            Text('传送是高级功能',
                style: TextStyle(
                    color: AppTheme.textPrimary,
                    fontSize: 20,
                    fontWeight: FontWeight.w800)),
            const SizedBox(height: 8),
            Text(
              '升级高级会员，传送到任何城市，让当地用户看到你的资料。',
              textAlign: TextAlign.center,
              style: TextStyle(
                  color: AppTheme.textSecondary, fontSize: 13, height: 1.5),
            ),
            const SizedBox(height: 20),
            SizedBox(
              width: double.infinity,
              child: ElevatedButton(
                onPressed: () {
                  Navigator.pop(context);
                  context.push('/premium');
                },
                child: const Text('升级高级会员 🔥'),
              ),
            ),
            const SizedBox(height: 8),
          ],
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final teleport = ref.watch(teleportProvider);
    final isPremium = ref.watch(subscriptionProvider).isPremium;

    return Scaffold(
      backgroundColor: AppTheme.bg,
      appBar: AppBar(
        title: const Text('传送', style: TextStyle(fontWeight: FontWeight.w800)),
        backgroundColor: AppTheme.bg,
      ),
      body: Column(
        children: [
          // ── Current status banner ────────────────────────────────────────
          AnimatedContainer(
            duration: const Duration(milliseconds: 300),
            margin: const EdgeInsets.fromLTRB(16, 0, 16, 8),
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              gradient: teleport.isActive
                  ? AppTheme.brandGradient
                  : null,
              color: teleport.isActive ? null : AppTheme.card,
              borderRadius: BorderRadius.circular(16),
              border: teleport.isActive
                  ? null
                  : Border.all(color: const Color(0xFF2A2A2A)),
            ),
            child: Row(
              children: [
                Icon(
                  teleport.isActive
                      ? Icons.flight_rounded
                      : Icons.my_location_rounded,
                  color: Colors.white,
                  size: 22,
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        teleport.isActive
                            ? '传送中: ${teleport.cityName}'
                            : '真实位置',
                        style: const TextStyle(
                          color: Colors.white,
                          fontWeight: FontWeight.w700,
                          fontSize: 15,
                        ),
                      ),
                      Text(
                        teleport.isActive
                            ? '其他用户看到你在 ${teleport.cityName}'
                            : '其他用户看到你的真实位置',
                        style: const TextStyle(
                            color: Colors.white70, fontSize: 12),
                      ),
                    ],
                  ),
                ),
                if (teleport.isActive)
                  TextButton(
                    onPressed: _deactivate,
                    style: TextButton.styleFrom(
                      backgroundColor: Colors.white.withValues(alpha: 0.2),
                      shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(8)),
                      padding: const EdgeInsets.symmetric(
                          horizontal: 12, vertical: 6),
                    ),
                    child: const Text('恢复',
                        style: TextStyle(
                            color: Colors.white, fontWeight: FontWeight.w700)),
                  ),
              ],
            ),
          ),

          // ── Premium gate info (free users) ───────────────────────────────
          if (!isPremium)
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 0, 16, 8),
              child: Container(
                padding: const EdgeInsets.symmetric(
                    horizontal: 14, vertical: 10),
                decoration: BoxDecoration(
                  color: AppTheme.primary.withValues(alpha: 0.08),
                  borderRadius: BorderRadius.circular(10),
                  border: Border.all(
                      color: AppTheme.primary.withValues(alpha: 0.25)),
                ),
                child: Row(
                  children: [
                    const Icon(Icons.lock_rounded,
                        color: AppTheme.primary, size: 16),
                    const SizedBox(width: 8),
                    Expanded(
                      child: Text(
                        '传送功能需要高级会员。点击城市查看详情。',
                        style: TextStyle(
                            color: AppTheme.primary, fontSize: 12),
                      ),
                    ),
                  ],
                ),
              ),
            ),

          // ── Search box ───────────────────────────────────────────────────
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 0, 16, 8),
            child: TextField(
              controller: _searchCtrl,
              onChanged: (v) => setState(() => _search = v),
              style: TextStyle(color: AppTheme.textPrimary),
              decoration: InputDecoration(
                hintText: '搜索城市...',
                prefixIcon: Icon(Icons.search_rounded,
                    color: AppTheme.textHint, size: 20),
                suffixIcon: _search.isNotEmpty
                    ? GestureDetector(
                        onTap: () {
                          _searchCtrl.clear();
                          setState(() => _search = '');
                        },
                        child: Icon(Icons.close_rounded,
                            color: AppTheme.textHint, size: 18),
                      )
                    : null,
              ),
            ),
          ),

          // ── City list ────────────────────────────────────────────────────
          Expanded(
            child: ListView.separated(
              padding: const EdgeInsets.only(bottom: 24),
              itemCount: _filtered.length,
              separatorBuilder: (_, __) => Divider(
                height: 1,
                thickness: 0.5,
                color: const Color(0xFF2A2A2A),
                indent: 72,
              ),
              itemBuilder: (_, i) {
                final city = _filtered[i];
                final isActive = teleport.isActive &&
                    teleport.cityName == city.name;
                return ListTile(
                  onTap: () => _selectCity(city, isPremium),
                  contentPadding:
                      const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
                  leading: Container(
                    width: 46,
                    height: 46,
                    decoration: BoxDecoration(
                      color: isActive
                          ? AppTheme.primary.withValues(alpha: 0.15)
                          : AppTheme.card,
                      borderRadius: BorderRadius.circular(10),
                    ),
                    child: Center(
                      child: Text(city.flag,
                          style: const TextStyle(fontSize: 24)),
                    ),
                  ),
                  title: Text(
                    city.name,
                    style: TextStyle(
                      color: isActive
                          ? AppTheme.primary
                          : AppTheme.textPrimary,
                      fontWeight: isActive
                          ? FontWeight.w700
                          : FontWeight.w600,
                      fontSize: 15,
                    ),
                  ),
                  subtitle: Text(
                    city.country,
                    style: TextStyle(
                        color: AppTheme.textHint, fontSize: 12),
                  ),
                  trailing: isActive
                      ? Container(
                          padding: const EdgeInsets.symmetric(
                              horizontal: 8, vertical: 4),
                          decoration: BoxDecoration(
                            color: AppTheme.primary,
                            borderRadius: BorderRadius.circular(8),
                          ),
                          child: const Text('传送中',
                              style: TextStyle(
                                  color: Colors.white,
                                  fontSize: 11,
                                  fontWeight: FontWeight.w700)),
                        )
                      : isPremium
                          ? Icon(Icons.flight_takeoff_rounded,
                              color: AppTheme.textHint, size: 18)
                          : Icon(Icons.lock_rounded,
                              color: AppTheme.textHint, size: 16),
                );
              },
            ),
          ),
        ],
      ),
    );
  }
}
