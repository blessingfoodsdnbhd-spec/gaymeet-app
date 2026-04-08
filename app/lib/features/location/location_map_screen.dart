import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:geolocator/geolocator.dart';
import 'package:go_router/go_router.dart';

import '../../config/theme.dart';
import '../../core/providers/privacy_provider.dart';
import '../../core/providers/teleport_provider.dart';

/// 位置 tab — shows the user's current GPS coordinates.
class LocationMapScreen extends ConsumerStatefulWidget {
  const LocationMapScreen({super.key});

  @override
  ConsumerState<LocationMapScreen> createState() => _LocationMapScreenState();
}

class _LocationMapScreenState extends ConsumerState<LocationMapScreen> {
  Position? _position;
  bool _loading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _fetchLocation();
  }

  Future<void> _fetchLocation() async {
    setState(() {
      _loading = true;
      _error = null;
    });

    try {
      bool serviceEnabled = await Geolocator.isLocationServiceEnabled();
      if (!serviceEnabled) {
        setState(() {
          _loading = false;
          _error = '位置服务未开启。请在设置中开启位置服务。';
        });
        return;
      }

      LocationPermission perm = await Geolocator.checkPermission();
      if (perm == LocationPermission.denied) {
        perm = await Geolocator.requestPermission();
        if (perm == LocationPermission.denied) {
          setState(() {
            _loading = false;
            _error = '位置权限被拒绝。';
          });
          return;
        }
      }
      if (perm == LocationPermission.deniedForever) {
        setState(() {
          _loading = false;
          _error = '位置权限被永久拒绝。请在系统设置中开启。';
        });
        return;
      }

      final pos = await Geolocator.getCurrentPosition(
        locationSettings: const LocationSettings(
          accuracy: LocationAccuracy.high,
        ),
      );
      if (mounted) {
        setState(() {
          _position = pos;
          _loading = false;
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _loading = false;
          _error = '获取位置失败：${e.toString()}';
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final teleport = ref.watch(teleportProvider);
    final privacy = ref.watch(privacyProvider);
    final isStealthOn = privacy.hideFromNearby;

    if (_loading) {
      return const Center(child: CircularProgressIndicator());
    }

    if (_error != null) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.all(32),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(Icons.location_off_rounded,
                  size: 52, color: AppTheme.textHint),
              const SizedBox(height: 16),
              Text(
                _error!,
                textAlign: TextAlign.center,
                style: TextStyle(
                    color: AppTheme.textSecondary, fontSize: 14, height: 1.5),
              ),
              const SizedBox(height: 20),
              ElevatedButton.icon(
                onPressed: _fetchLocation,
                icon: const Icon(Icons.refresh_rounded, size: 18),
                label: const Text('重试'),
              ),
            ],
          ),
        ),
      );
    }

    final pos = _position!;
    final lat = pos.latitude.toStringAsFixed(6);
    final lng = pos.longitude.toStringAsFixed(6);
    final acc = pos.accuracy.toStringAsFixed(0);

    return SingleChildScrollView(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // ── Teleport status banner ───────────────────────────────────────
          if (teleport.isActive)
            _StatusBanner(
              icon: Icons.flight_rounded,
              label: '传送中: ${teleport.cityName}',
              sublabel: '其他用户看到你在 ${teleport.cityName}',
              color: AppTheme.primary,
              onTap: () => context.push('/teleport'),
              actionLabel: '更改',
            ),

          // ── Stealth status banner ────────────────────────────────────────
          if (isStealthOn)
            _StatusBanner(
              icon: Icons.shield_rounded,
              label: '隐身模式已开启',
              sublabel: _stealthSubLabel(privacy),
              color: const Color(0xFF7B61FF),
              onTap: () => context.push('/stealth'),
              actionLabel: '设置',
            ),

          // ── Map placeholder ──────────────────────────────────────────────
          Container(
            height: 220,
            width: double.infinity,
            decoration: BoxDecoration(
              color: const Color(0xFF131320),
              borderRadius: BorderRadius.circular(16),
              border: Border.all(color: const Color(0xFF2A2A3A)),
            ),
            child: ClipRRect(
              borderRadius: BorderRadius.circular(16),
              child: Stack(
                children: [
                  // Grid lines (fake map feel)
                  CustomPaint(
                    painter: _GridPainter(),
                    size: const Size(double.infinity, 220),
                  ),
                  // Center marker
                  Center(
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Container(
                          width: 20,
                          height: 20,
                          decoration: BoxDecoration(
                            color: AppTheme.primary.withOpacity(0.2),
                            shape: BoxShape.circle,
                            border:
                                Border.all(color: AppTheme.primary, width: 2),
                          ),
                        ),
                        Container(width: 2, height: 12, color: AppTheme.primary),
                      ],
                    ),
                  ),
                  // Location label overlay
                  Positioned(
                    top: 14,
                    left: 14,
                    child: Container(
                      padding: const EdgeInsets.symmetric(
                          horizontal: 10, vertical: 5),
                      decoration: BoxDecoration(
                        color: Colors.black.withOpacity(0.6),
                        borderRadius: BorderRadius.circular(8),
                      ),
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Icon(
                            teleport.isActive
                                ? Icons.flight_rounded
                                : Icons.my_location_rounded,
                            color: teleport.isActive
                                ? AppTheme.primary
                                : Colors.white,
                            size: 14,
                          ),
                          const SizedBox(width: 5),
                          Text(
                            teleport.isActive
                                ? teleport.cityName ?? '虚拟位置'
                                : '当前位置',
                            style: const TextStyle(
                                color: Colors.white, fontSize: 12),
                          ),
                        ],
                      ),
                    ),
                  ),
                  // Stealth badge overlay
                  if (isStealthOn)
                    Positioned(
                      top: 14,
                      right: 14,
                      child: Container(
                        padding: const EdgeInsets.symmetric(
                            horizontal: 8, vertical: 4),
                        decoration: BoxDecoration(
                          color: const Color(0xFF7B61FF).withOpacity(0.85),
                          borderRadius: BorderRadius.circular(8),
                        ),
                        child: const Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Icon(Icons.shield_rounded,
                                color: Colors.white, size: 12),
                            SizedBox(width: 4),
                            Text('隐身中',
                                style: TextStyle(
                                    color: Colors.white, fontSize: 11)),
                          ],
                        ),
                      ),
                    ),
                  // Refresh button
                  Positioned(
                    bottom: 12,
                    right: 12,
                    child: GestureDetector(
                      onTap: _fetchLocation,
                      child: Container(
                        padding: const EdgeInsets.all(8),
                        decoration: const BoxDecoration(
                          color: AppTheme.primary,
                          shape: BoxShape.circle,
                        ),
                        child: const Icon(Icons.my_location_rounded,
                            color: Colors.white, size: 18),
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ),

          const SizedBox(height: 16),

          // ── Coordinates card ─────────────────────────────────────────────
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: AppTheme.card,
              borderRadius: BorderRadius.circular(14),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  '坐标',
                  style: TextStyle(
                    color: AppTheme.textSecondary,
                    fontSize: 12,
                    fontWeight: FontWeight.w600,
                    letterSpacing: 0.5,
                  ),
                ),
                const SizedBox(height: 12),
                _CoordRow(label: '纬度 (Lat)', value: lat),
                const Divider(height: 16, color: Color(0xFF2A2A2A)),
                _CoordRow(label: '经度 (Lng)', value: lng),
                const Divider(height: 16, color: Color(0xFF2A2A2A)),
                _CoordRow(label: '精度 (Accuracy)', value: '±${acc}m'),
              ],
            ),
          ),

          const SizedBox(height: 16),

          // ── Action shortcuts ─────────────────────────────────────────────
          Row(
            children: [
              Expanded(
                child: _ActionCard(
                  icon: Icons.flight_rounded,
                  title: '传送',
                  subtitle: teleport.isActive
                      ? teleport.cityName ?? '已启用'
                      : '切换虚拟位置',
                  isActive: teleport.isActive,
                  activeColor: AppTheme.primary,
                  onTap: () => context.push('/teleport'),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: _ActionCard(
                  icon: Icons.shield_rounded,
                  title: '隐身设置',
                  subtitle: isStealthOn ? '隐身已开启' : '对附近隐藏',
                  isActive: isStealthOn,
                  activeColor: const Color(0xFF7B61FF),
                  onTap: () => context.push('/stealth'),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  String _stealthSubLabel(PrivacySettings p) {
    switch (p.stealthOption) {
      case StealthOption.complete:
        return '所有人都看不到你';
      case StealthOption.friendsOnly:
        return '仅好友可见';
      case StealthOption.timed:
        if (p.stealthUntil != null) {
          final diff = p.stealthUntil!.difference(DateTime.now());
          if (diff.isNegative) return '定时隐身已过期';
          final h = diff.inHours;
          final m = diff.inMinutes % 60;
          return '剩余 ${h > 0 ? '${h}h ' : ''}${m}m';
        }
        return '定时隐身';
    }
  }
}

// ── Status banner ─────────────────────────────────────────────────────────────

class _StatusBanner extends StatelessWidget {
  final IconData icon;
  final String label;
  final String sublabel;
  final Color color;
  final VoidCallback onTap;
  final String actionLabel;

  const _StatusBanner({
    required this.icon,
    required this.label,
    required this.sublabel,
    required this.color,
    required this.onTap,
    required this.actionLabel,
  });

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        margin: const EdgeInsets.only(bottom: 12),
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
        decoration: BoxDecoration(
          color: color.withOpacity(0.12),
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: color.withOpacity(0.35)),
        ),
        child: Row(
          children: [
            Icon(icon, color: color, size: 18),
            const SizedBox(width: 10),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(label,
                      style: TextStyle(
                          color: color,
                          fontSize: 13,
                          fontWeight: FontWeight.w700)),
                  Text(sublabel,
                      style: TextStyle(
                          color: color.withOpacity(0.75), fontSize: 11)),
                ],
              ),
            ),
            Container(
              padding:
                  const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
              decoration: BoxDecoration(
                color: color.withOpacity(0.15),
                borderRadius: BorderRadius.circular(8),
              ),
              child: Text(actionLabel,
                  style: TextStyle(
                      color: color,
                      fontSize: 12,
                      fontWeight: FontWeight.w600)),
            ),
          ],
        ),
      ),
    );
  }
}

// ── Action card ───────────────────────────────────────────────────────────────

class _ActionCard extends StatelessWidget {
  final IconData icon;
  final String title;
  final String subtitle;
  final bool isActive;
  final Color activeColor;
  final VoidCallback onTap;

  const _ActionCard({
    required this.icon,
    required this.title,
    required this.subtitle,
    required this.isActive,
    required this.activeColor,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: isActive ? activeColor.withOpacity(0.1) : AppTheme.card,
          borderRadius: BorderRadius.circular(14),
          border: Border.all(
            color: isActive
                ? activeColor.withOpacity(0.4)
                : const Color(0xFF2A2A2A),
          ),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Icon(icon,
                color: isActive ? activeColor : AppTheme.textHint, size: 22),
            const SizedBox(height: 8),
            Text(title,
                style: TextStyle(
                  color: isActive ? activeColor : AppTheme.textPrimary,
                  fontSize: 13,
                  fontWeight: FontWeight.w700,
                )),
            const SizedBox(height: 2),
            Text(subtitle,
                style: TextStyle(color: AppTheme.textHint, fontSize: 11),
                maxLines: 1,
                overflow: TextOverflow.ellipsis),
          ],
        ),
      ),
    );
  }
}

// ── Coord row ─────────────────────────────────────────────────────────────────

class _CoordRow extends StatelessWidget {
  final String label;
  final String value;
  const _CoordRow({required this.label, required this.value});

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        Text(label,
            style: TextStyle(color: AppTheme.textSecondary, fontSize: 13)),
        Text(
          value,
          style: const TextStyle(
            color: AppTheme.textPrimary,
            fontSize: 13,
            fontWeight: FontWeight.w600,
            fontFamily: 'monospace',
          ),
        ),
      ],
    );
  }
}

// ── Grid painter for fake map feel ────────────────────────────────────────────

class _GridPainter extends CustomPainter {
  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()
      ..color = const Color(0xFF2A2A4A)
      ..strokeWidth = 0.5;

    const step = 30.0;
    for (double x = 0; x < size.width; x += step) {
      canvas.drawLine(Offset(x, 0), Offset(x, size.height), paint);
    }
    for (double y = 0; y < size.height; y += step) {
      canvas.drawLine(Offset(0, y), Offset(size.width, y), paint);
    }
  }

  @override
  bool shouldRepaint(_) => false;
}
