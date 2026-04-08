import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../config/theme.dart';
import '../../core/providers/filter_provider.dart';

class NearbyFilterTab extends ConsumerStatefulWidget {
  const NearbyFilterTab({super.key});

  @override
  ConsumerState<NearbyFilterTab> createState() => _NearbyFilterTabState();
}

class _NearbyFilterTabState extends ConsumerState<NearbyFilterTab> {
  late DiscoveryFilter _draft;

  @override
  void initState() {
    super.initState();
    _draft = ref.read(filterProvider);
  }

  void _apply() {
    ref.read(filterProvider.notifier).apply(_draft);
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: const Text('过滤已更新'),
        backgroundColor: AppTheme.primary,
        duration: const Duration(seconds: 1),
      ),
    );
  }

  void _reset() {
    setState(() => _draft = const DiscoveryFilter());
    ref.read(filterProvider.notifier).reset();
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        Expanded(
          child: SingleChildScrollView(
            padding: const EdgeInsets.fromLTRB(16, 16, 16, 0),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // ── Master toggle ─────────────────────────────────────────
                _MasterToggle(
                  value: _draft.filtersEnabled,
                  onChanged: (v) =>
                      setState(() => _draft = _draft.copyWith(filtersEnabled: v)),
                ),

                if (_draft.filtersEnabled) ...[
                  const SizedBox(height: 20),

                  // ── Height ────────────────────────────────────────────
                  _FilterSection(
                    label: '身高 (Height)',
                    unit: 'cm',
                    enabled: _draft.heightEnabled,
                    currentMin: _draft.heightMin.toDouble(),
                    currentMax: _draft.heightMax.toDouble(),
                    rangeMin: 140,
                    rangeMax: 250,
                    divisions: 110,
                    onToggle: (v) => setState(
                        () => _draft = _draft.copyWith(heightEnabled: v)),
                    onChanged: (range) => setState(() => _draft = _draft.copyWith(
                          heightMin: range.start.round(),
                          heightMax: range.end.round(),
                        )),
                  ),

                  const SizedBox(height: 20),

                  // ── Weight ────────────────────────────────────────────
                  _FilterSection(
                    label: '体重 (Weight)',
                    unit: 'kg',
                    enabled: _draft.weightEnabled,
                    currentMin: _draft.weightMin.toDouble(),
                    currentMax: _draft.weightMax.toDouble(),
                    rangeMin: 30,
                    rangeMax: 150,
                    divisions: 120,
                    onToggle: (v) => setState(
                        () => _draft = _draft.copyWith(weightEnabled: v)),
                    onChanged: (range) => setState(() => _draft = _draft.copyWith(
                          weightMin: range.start.round(),
                          weightMax: range.end.round(),
                        )),
                  ),

                  const SizedBox(height: 20),

                  // ── Age ───────────────────────────────────────────────
                  _FilterSection(
                    label: '年龄 (Age)',
                    unit: '岁',
                    enabled: _draft.ageEnabled,
                    currentMin: _draft.ageMin.toDouble(),
                    currentMax: _draft.ageMax.toDouble(),
                    rangeMin: 18,
                    rangeMax: 99,
                    divisions: 81,
                    onToggle: (v) =>
                        setState(() => _draft = _draft.copyWith(ageEnabled: v)),
                    onChanged: (range) => setState(() => _draft = _draft.copyWith(
                          ageMin: range.start.round(),
                          ageMax: range.end.round(),
                        )),
                  ),

                  const SizedBox(height: 20),

                  // ── Distance ──────────────────────────────────────────
                  _DistanceSection(
                    currentKm: _draft.maxDistanceKm,
                    onChanged: (v) => setState(
                        () => _draft = _draft.copyWith(maxDistanceKm: v)),
                  ),
                ],

                const SizedBox(height: 24),
              ],
            ),
          ),
        ),

        // ── Action buttons ────────────────────────────────────────────────
        Container(
          padding: const EdgeInsets.fromLTRB(16, 12, 16, 20),
          decoration: BoxDecoration(
            color: AppTheme.bg,
            border: Border(
                top: BorderSide(
                    color: const Color(0xFF2A2A2A), width: 0.5)),
          ),
          child: Row(
            children: [
              Expanded(
                child: OutlinedButton(
                  onPressed: _reset,
                  child: const Text('重置'),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                flex: 2,
                child: ElevatedButton(
                  onPressed: _apply,
                  child: const Text('应用过滤'),
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }
}

// ── Master toggle ─────────────────────────────────────────────────────────────

class _MasterToggle extends StatelessWidget {
  final bool value;
  final ValueChanged<bool> onChanged;
  const _MasterToggle({required this.value, required this.onChanged});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
      decoration: BoxDecoration(
        color: AppTheme.card,
        borderRadius: BorderRadius.circular(14),
        border: value
            ? Border.all(color: AppTheme.primary.withOpacity(0.4))
            : null,
      ),
      child: Row(
        children: [
          Container(
            width: 38,
            height: 38,
            decoration: BoxDecoration(
              gradient: value ? AppTheme.brandGradient : null,
              color: value ? null : AppTheme.surface,
              borderRadius: BorderRadius.circular(10),
            ),
            child: Icon(
              Icons.filter_list_rounded,
              color: value ? Colors.white : AppTheme.textHint,
              size: 20,
            ),
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  '使用过滤网',
                  style: TextStyle(
                    color: AppTheme.textPrimary,
                    fontWeight: FontWeight.w700,
                    fontSize: 15,
                  ),
                ),
                Text(
                  value ? '已启动' : '未启动',
                  style: TextStyle(
                    color: value ? AppTheme.primary : AppTheme.textHint,
                    fontSize: 12,
                  ),
                ),
              ],
            ),
          ),
          Switch(
            value: value,
            onChanged: onChanged,
            activeColor: AppTheme.primary,
          ),
        ],
      ),
    );
  }
}

// ── Filter section (height/weight/age) ────────────────────────────────────────

class _FilterSection extends StatelessWidget {
  final String label;
  final String unit;
  final bool enabled;
  final double currentMin;
  final double currentMax;
  final double rangeMin;
  final double rangeMax;
  final int divisions;
  final ValueChanged<bool> onToggle;
  final ValueChanged<RangeValues> onChanged;

  const _FilterSection({
    required this.label,
    required this.unit,
    required this.enabled,
    required this.currentMin,
    required this.currentMax,
    required this.rangeMin,
    required this.rangeMax,
    required this.divisions,
    required this.onToggle,
    required this.onChanged,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        color: AppTheme.card,
        borderRadius: BorderRadius.circular(14),
        border: enabled
            ? Border.all(color: AppTheme.primary.withOpacity(0.3))
            : null,
      ),
      child: Column(
        children: [
          // Header row with toggle
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 12, 8, 0),
            child: Row(
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        label,
                        style: TextStyle(
                          color: AppTheme.textPrimary,
                          fontWeight: FontWeight.w600,
                          fontSize: 14,
                        ),
                      ),
                      Text(
                        enabled
                            ? '${currentMin.round()} – ${currentMax.round()} $unit'
                            : '未启动',
                        style: TextStyle(
                          color: enabled
                              ? AppTheme.primary
                              : AppTheme.textHint,
                          fontSize: 12,
                        ),
                      ),
                    ],
                  ),
                ),
                Switch(
                  value: enabled,
                  onChanged: onToggle,
                  activeColor: AppTheme.primary,
                ),
              ],
            ),
          ),

          // Slider (only when enabled)
          if (enabled) ...[
            Padding(
              padding: const EdgeInsets.fromLTRB(8, 0, 8, 4),
              child: SliderTheme(
                data: SliderTheme.of(context).copyWith(
                  activeTrackColor: AppTheme.primary,
                  inactiveTrackColor: AppTheme.surface,
                  thumbColor: AppTheme.primary,
                  overlayColor: AppTheme.primary.withOpacity(0.12),
                  rangeThumbShape:
                      const RoundRangeSliderThumbShape(enabledThumbRadius: 8),
                  trackHeight: 3,
                ),
                child: RangeSlider(
                  values: RangeValues(currentMin, currentMax),
                  min: rangeMin,
                  max: rangeMax,
                  divisions: divisions,
                  labels: RangeLabels(
                    '${currentMin.round()}$unit',
                    '${currentMax.round()}$unit',
                  ),
                  onChanged: onChanged,
                ),
              ),
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 0, 16, 12),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text('${rangeMin.round()} $unit',
                      style: TextStyle(
                          color: AppTheme.textHint, fontSize: 11)),
                  Text('${rangeMax.round()} $unit',
                      style: TextStyle(
                          color: AppTheme.textHint, fontSize: 11)),
                ],
              ),
            ),
          ] else
            const SizedBox(height: 12),
        ],
      ),
    );
  }
}

// ── Distance section ──────────────────────────────────────────────────────────

class _DistanceSection extends StatelessWidget {
  final double currentKm;
  final ValueChanged<double> onChanged;

  const _DistanceSection({
    required this.currentKm,
    required this.onChanged,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.fromLTRB(16, 14, 16, 14),
      decoration: BoxDecoration(
        color: AppTheme.card,
        borderRadius: BorderRadius.circular(14),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                '距离 (Distance)',
                style: TextStyle(
                  color: AppTheme.textPrimary,
                  fontWeight: FontWeight.w600,
                  fontSize: 14,
                ),
              ),
              Text(
                '${currentKm.round()} km',
                style: TextStyle(
                    color: AppTheme.primary,
                    fontSize: 13,
                    fontWeight: FontWeight.w600),
              ),
            ],
          ),
          SliderTheme(
            data: SliderTheme.of(context).copyWith(
              activeTrackColor: AppTheme.primary,
              inactiveTrackColor: AppTheme.surface,
              thumbColor: AppTheme.primary,
              overlayColor: AppTheme.primary.withOpacity(0.12),
              thumbShape:
                  const RoundSliderThumbShape(enabledThumbRadius: 8),
              trackHeight: 3,
            ),
            child: Slider(
              value: currentKm,
              min: 1,
              max: 300,
              divisions: 299,
              label: '${currentKm.round()} km',
              onChanged: onChanged,
            ),
          ),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text('1 km',
                  style:
                      TextStyle(color: AppTheme.textHint, fontSize: 11)),
              Text('300 km',
                  style:
                      TextStyle(color: AppTheme.textHint, fontSize: 11)),
            ],
          ),
        ],
      ),
    );
  }
}
