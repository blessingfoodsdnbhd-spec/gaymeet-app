import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../config/theme.dart';
import '../../core/providers/location_hub_provider.dart';
import '../../core/providers/subscription_provider.dart';

class LocationSettingsScreen extends ConsumerWidget {
  const LocationSettingsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final state = ref.watch(locationHubProvider);
    final isPremium = ref.watch(subscriptionProvider).isPremium;

    return SingleChildScrollView(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Current location
          _SectionLabel(label: '当前位置'),
          _SettingsCard(
            icon: Icons.my_location_rounded,
            title: '真实位置',
            subtitle: '使用GPS定位显示距离',
            trailing: state.hasVirtualLocation
                ? null
                : const Icon(Icons.check_circle_rounded,
                    color: AppTheme.online, size: 20),
            onTap: state.hasVirtualLocation
                ? () => ref
                    .read(locationHubProvider.notifier)
                    .clearVirtualLocation()
                : null,
          ),

          const SizedBox(height: 16),

          // Stealth mode
          _SectionLabel(label: '隐身遮蔽'),
          _ToggleCard(
            icon: Icons.visibility_off_rounded,
            title: '隐身模式',
            subtitle: '其他人在附近列表中看不到你',
            value: state.stealthMode,
            onChanged: (v) =>
                ref.read(locationHubProvider.notifier).toggleStealth(v),
          ),

          const SizedBox(height: 16),

          // Teleport (premium)
          _SectionLabel(
            label: '传送',
            badge: isPremium ? null : '高级',
          ),
          _TeleportCard(
            isPremium: isPremium,
            hasVirtualLocation: state.hasVirtualLocation,
            virtualLabel: state.virtualLocationLabel,
            virtualLat: state.virtualLat,
            virtualLng: state.virtualLng,
            onSetLocation: () => _showTeleportSheet(context, ref, isPremium),
            onClear: () =>
                ref.read(locationHubProvider.notifier).clearVirtualLocation(),
          ),

          const SizedBox(height: 24),

          // Info
          Container(
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(
              color: AppTheme.surface,
              borderRadius: BorderRadius.circular(12),
            ),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Icon(Icons.info_outline_rounded,
                    color: AppTheme.textHint, size: 18),
                const SizedBox(width: 10),
                Expanded(
                  child: Text(
                    '传送功能让其他用户看到你设定的虚拟位置，而非真实位置。隐身模式让你从附近列表消失，但仍可浏览其他人。',
                    style: TextStyle(
                        color: AppTheme.textHint, fontSize: 12, height: 1.5),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  void _showTeleportSheet(
      BuildContext context, WidgetRef ref, bool isPremium) {
    if (!isPremium) {
      showModalBottomSheet(
        context: context,
        backgroundColor: AppTheme.card,
        shape: const RoundedRectangleBorder(
          borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
        ),
        builder: (_) => _PremiumGateSheet(
          feature: '传送',
          onUpgrade: () {
            Navigator.pop(context);
            Navigator.of(context).pushNamed('/premium');
          },
        ),
      );
      return;
    }

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: AppTheme.card,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      builder: (_) => _TeleportInputSheet(
        onConfirm: (lat, lng, label) {
          Navigator.pop(context);
          ref
              .read(locationHubProvider.notifier)
              .setVirtualLocation(lat, lng, label: label);
        },
      ),
    );
  }
}

// ── Section helpers ───────────────────────────────────────────────────────────

class _SectionLabel extends StatelessWidget {
  final String label;
  final String? badge;
  const _SectionLabel({required this.label, this.badge});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Row(
        children: [
          Text(
            label,
            style: TextStyle(
              color: AppTheme.textSecondary,
              fontSize: 12,
              fontWeight: FontWeight.w600,
              letterSpacing: 0.5,
            ),
          ),
          if (badge != null) ...[
            const SizedBox(width: 6),
            Container(
              padding:
                  const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
              decoration: BoxDecoration(
                gradient: AppTheme.brandGradient,
                borderRadius: BorderRadius.circular(4),
              ),
              child: Text(
                badge!,
                style: const TextStyle(
                    color: Colors.white,
                    fontSize: 10,
                    fontWeight: FontWeight.w700),
              ),
            ),
          ],
        ],
      ),
    );
  }
}

class _SettingsCard extends StatelessWidget {
  final IconData icon;
  final String title;
  final String subtitle;
  final Widget? trailing;
  final VoidCallback? onTap;

  const _SettingsCard({
    required this.icon,
    required this.title,
    required this.subtitle,
    this.trailing,
    this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: AppTheme.card,
          borderRadius: BorderRadius.circular(14),
        ),
        child: Row(
          children: [
            Container(
              width: 40,
              height: 40,
              decoration: BoxDecoration(
                color: AppTheme.surface,
                borderRadius: BorderRadius.circular(10),
              ),
              child: Icon(icon, color: AppTheme.primary, size: 20),
            ),
            const SizedBox(width: 14),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(title,
                      style: TextStyle(
                          color: AppTheme.textPrimary,
                          fontWeight: FontWeight.w600,
                          fontSize: 14)),
                  const SizedBox(height: 2),
                  Text(subtitle,
                      style: TextStyle(
                          color: AppTheme.textHint, fontSize: 12)),
                ],
              ),
            ),
            if (trailing != null) trailing!,
          ],
        ),
      ),
    );
  }
}

class _ToggleCard extends StatelessWidget {
  final IconData icon;
  final String title;
  final String subtitle;
  final bool value;
  final ValueChanged<bool> onChanged;

  const _ToggleCard({
    required this.icon,
    required this.title,
    required this.subtitle,
    required this.value,
    required this.onChanged,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppTheme.card,
        borderRadius: BorderRadius.circular(14),
      ),
      child: Row(
        children: [
          Container(
            width: 40,
            height: 40,
            decoration: BoxDecoration(
              color: AppTheme.surface,
              borderRadius: BorderRadius.circular(10),
            ),
            child: Icon(icon, color: AppTheme.textSecondary, size: 20),
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(title,
                    style: TextStyle(
                        color: AppTheme.textPrimary,
                        fontWeight: FontWeight.w600,
                        fontSize: 14)),
                const SizedBox(height: 2),
                Text(subtitle,
                    style:
                        TextStyle(color: AppTheme.textHint, fontSize: 12)),
              ],
            ),
          ),
          Switch(
            value: value,
            onChanged: onChanged,
            activeThumbColor: AppTheme.primary,
          ),
        ],
      ),
    );
  }
}

class _TeleportCard extends StatelessWidget {
  final bool isPremium;
  final bool hasVirtualLocation;
  final String? virtualLabel;
  final double? virtualLat;
  final double? virtualLng;
  final VoidCallback onSetLocation;
  final VoidCallback onClear;

  const _TeleportCard({
    required this.isPremium,
    required this.hasVirtualLocation,
    this.virtualLabel,
    this.virtualLat,
    this.virtualLng,
    required this.onSetLocation,
    required this.onClear,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppTheme.card,
        borderRadius: BorderRadius.circular(14),
        border: hasVirtualLocation
            ? Border.all(color: AppTheme.primary.withValues(alpha: 0.4))
            : null,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                width: 40,
                height: 40,
                decoration: BoxDecoration(
                  color: hasVirtualLocation
                      ? AppTheme.primary.withValues(alpha: 0.15)
                      : AppTheme.surface,
                  borderRadius: BorderRadius.circular(10),
                ),
                child: Icon(
                  Icons.explore_rounded,
                  color: hasVirtualLocation
                      ? AppTheme.primary
                      : AppTheme.textSecondary,
                  size: 20,
                ),
              ),
              const SizedBox(width: 14),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text('传送到任何地点',
                        style: TextStyle(
                            color: AppTheme.textPrimary,
                            fontWeight: FontWeight.w600,
                            fontSize: 14)),
                    const SizedBox(height: 2),
                    Text(
                      hasVirtualLocation
                          ? virtualLabel ??
                              '${virtualLat?.toStringAsFixed(4)}, ${virtualLng?.toStringAsFixed(4)}'
                          : '设置虚拟位置（他人看到的位置）',
                      style: TextStyle(
                        color: hasVirtualLocation
                            ? AppTheme.primary
                            : AppTheme.textHint,
                        fontSize: 12,
                      ),
                    ),
                  ],
                ),
              ),
              if (!isPremium)
                Container(
                  padding: const EdgeInsets.symmetric(
                      horizontal: 8, vertical: 4),
                  decoration: BoxDecoration(
                    gradient: AppTheme.brandGradient,
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: const Text('高级',
                      style: TextStyle(
                          color: Colors.white,
                          fontSize: 11,
                          fontWeight: FontWeight.w700)),
                ),
            ],
          ),
          const SizedBox(height: 14),
          Row(
            children: [
              Expanded(
                child: ElevatedButton.icon(
                  onPressed: onSetLocation,
                  icon: const Icon(Icons.explore_rounded, size: 16),
                  label: Text(
                      hasVirtualLocation ? '更改位置' : '设置位置'),
                  style: ElevatedButton.styleFrom(
                    padding: const EdgeInsets.symmetric(vertical: 10),
                  ),
                ),
              ),
              if (hasVirtualLocation) ...[
                const SizedBox(width: 10),
                OutlinedButton(
                  onPressed: onClear,
                  style: OutlinedButton.styleFrom(
                    padding: const EdgeInsets.symmetric(
                        horizontal: 14, vertical: 10),
                    side: BorderSide(color: AppTheme.error),
                  ),
                  child: Text('恢复真实',
                      style: TextStyle(color: AppTheme.error, fontSize: 13)),
                ),
              ],
            ],
          ),
        ],
      ),
    );
  }
}

// ── Sheets ────────────────────────────────────────────────────────────────────

class _PremiumGateSheet extends StatelessWidget {
  final String feature;
  final VoidCallback onUpgrade;

  const _PremiumGateSheet({required this.feature, required this.onUpgrade});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.all(24),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            width: 40,
            height: 4,
            decoration: BoxDecoration(
              color: AppTheme.textHint,
              borderRadius: BorderRadius.circular(2),
            ),
          ),
          const SizedBox(height: 20),
          const Icon(Icons.lock_rounded, color: AppTheme.primary, size: 48),
          const SizedBox(height: 12),
          Text(
            '$feature 是高级功能',
            style: TextStyle(
                color: AppTheme.textPrimary,
                fontSize: 18,
                fontWeight: FontWeight.w800),
          ),
          const SizedBox(height: 8),
          Text(
            '升级高级会员，让你传送到任何城市，让更多人看到你。',
            textAlign: TextAlign.center,
            style:
                TextStyle(color: AppTheme.textSecondary, fontSize: 13, height: 1.5),
          ),
          const SizedBox(height: 20),
          SizedBox(
            width: double.infinity,
            child: ElevatedButton(
              onPressed: onUpgrade,
              child: const Text('升级高级会员 🔥'),
            ),
          ),
          const SizedBox(height: 8),
        ],
      ),
    );
  }
}

class _TeleportInputSheet extends StatefulWidget {
  final void Function(double lat, double lng, String? label) onConfirm;
  const _TeleportInputSheet({required this.onConfirm});

  @override
  State<_TeleportInputSheet> createState() => _TeleportInputSheetState();
}

class _TeleportInputSheetState extends State<_TeleportInputSheet> {
  final _latCtrl = TextEditingController();
  final _lngCtrl = TextEditingController();
  final _labelCtrl = TextEditingController();

  // Quick presets
  static const _presets = [
    {'label': '🇸🇬 Singapore', 'lat': 1.3521, 'lng': 103.8198},
    {'label': '🇯🇵 Tokyo', 'lat': 35.6762, 'lng': 139.6503},
    {'label': '🇹🇼 Taipei', 'lat': 25.0330, 'lng': 121.5654},
    {'label': '🇰🇷 Seoul', 'lat': 37.5665, 'lng': 126.9780},
    {'label': '🇹🇭 Bangkok', 'lat': 13.7563, 'lng': 100.5018},
    {'label': '🇦🇺 Sydney', 'lat': -33.8688, 'lng': 151.2093},
  ];

  void _applyPreset(Map preset) {
    _latCtrl.text = preset['lat'].toString();
    _lngCtrl.text = preset['lng'].toString();
    _labelCtrl.text = preset['label'] as String;
  }

  void _confirm() {
    final lat = double.tryParse(_latCtrl.text.trim());
    final lng = double.tryParse(_lngCtrl.text.trim());
    if (lat == null || lng == null) return;
    final label = _labelCtrl.text.trim().isEmpty ? null : _labelCtrl.text.trim();
    widget.onConfirm(lat, lng, label);
  }

  @override
  void dispose() {
    _latCtrl.dispose();
    _lngCtrl.dispose();
    _labelCtrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: EdgeInsets.only(
        left: 20,
        right: 20,
        top: 20,
        bottom: MediaQuery.of(context).viewInsets.bottom + 20,
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Center(
            child: Container(
              width: 40,
              height: 4,
              decoration: BoxDecoration(
                color: AppTheme.textHint,
                borderRadius: BorderRadius.circular(2),
              ),
            ),
          ),
          const SizedBox(height: 20),
          Text(
            '设置虚拟位置',
            style: TextStyle(
                color: AppTheme.textPrimary,
                fontSize: 18,
                fontWeight: FontWeight.w800),
          ),
          const SizedBox(height: 14),

          // Presets
          Text('快速选择城市',
              style: TextStyle(color: AppTheme.textHint, fontSize: 12)),
          const SizedBox(height: 8),
          SizedBox(
            height: 36,
            child: ListView.separated(
              scrollDirection: Axis.horizontal,
              itemCount: _presets.length,
              separatorBuilder: (_, __) => const SizedBox(width: 8),
              itemBuilder: (_, i) => GestureDetector(
                onTap: () => _applyPreset(_presets[i]),
                child: Container(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                  decoration: BoxDecoration(
                    color: AppTheme.surface,
                    borderRadius: BorderRadius.circular(20),
                    border: Border.all(color: const Color(0xFF3A3A3A)),
                  ),
                  child: Text(
                    _presets[i]['label'] as String,
                    style: TextStyle(
                        color: AppTheme.textSecondary, fontSize: 13),
                  ),
                ),
              ),
            ),
          ),
          const SizedBox(height: 16),

          Row(
            children: [
              Expanded(
                child: TextField(
                  controller: _latCtrl,
                  keyboardType: const TextInputType.numberWithOptions(
                      decimal: true, signed: true),
                  style: TextStyle(color: AppTheme.textPrimary),
                  decoration: const InputDecoration(
                    labelText: '纬度 (Latitude)',
                    hintText: '1.3521',
                  ),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: TextField(
                  controller: _lngCtrl,
                  keyboardType: const TextInputType.numberWithOptions(
                      decimal: true, signed: true),
                  style: TextStyle(color: AppTheme.textPrimary),
                  decoration: const InputDecoration(
                    labelText: '经度 (Longitude)',
                    hintText: '103.8198',
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          TextField(
            controller: _labelCtrl,
            style: TextStyle(color: AppTheme.textPrimary),
            decoration: const InputDecoration(
              labelText: '位置名称（可选）',
              hintText: 'e.g. Singapore',
            ),
          ),
          const SizedBox(height: 20),
          SizedBox(
            width: double.infinity,
            child: ElevatedButton.icon(
              onPressed: _confirm,
              icon: const Icon(Icons.explore_rounded, size: 18),
              label: const Text('确认传送'),
            ),
          ),
        ],
      ),
    );
  }
}
