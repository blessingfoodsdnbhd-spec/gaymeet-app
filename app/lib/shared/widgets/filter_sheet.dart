import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../config/theme.dart';
import '../../core/providers/filter_provider.dart';
import 'gradient_button.dart';

// Available interest tags — shared with onboarding
const _kAvailableTags = [
  'Travel', 'Fitness', 'Music', 'Coffee', 'Dogs', 'Cats',
  'Gaming', 'Photography', 'Cooking', 'Hiking', 'Movies',
  'Art', 'Tech', 'Yoga', 'Nightlife', 'Books', 'Wine',
  'Beach', 'Running', 'Dance',
];

/// Opens the filter bottom sheet. The sheet commits changes directly to
/// [filterProvider] when the user taps "Apply".
Future<void> showFilterSheet(BuildContext context) {
  return showModalBottomSheet(
    context: context,
    isScrollControlled: true,
    backgroundColor: Colors.transparent,
    useRootNavigator: true,
    builder: (_) => const _FilterSheet(),
  );
}

/// A badge-adorned filter icon button for use in AppBar actions.
/// Automatically watches [filterProvider] and shows the active filter count.
class FilterIconButton extends ConsumerWidget {
  final VoidCallback onTap;

  const FilterIconButton({super.key, required this.onTap});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final activeCount = ref.watch(filterProvider).activeCount;

    return IconButton(
      tooltip: 'Filters',
      icon: Stack(
        clipBehavior: Clip.none,
        children: [
          const Icon(Icons.tune_rounded, size: 22),
          if (activeCount > 0)
            Positioned(
              right: -5,
              top: -5,
              child: Container(
                width: 17,
                height: 17,
                decoration: const BoxDecoration(
                  gradient: AppTheme.brandGradient,
                  shape: BoxShape.circle,
                ),
                child: Center(
                  child: Text(
                    '$activeCount',
                    style: const TextStyle(
                      fontSize: 9,
                      fontWeight: FontWeight.w800,
                      color: Colors.white,
                    ),
                  ),
                ),
              ),
            ),
        ],
      ),
      onPressed: onTap,
    );
  }
}

// ── Sheet ─────────────────────────────────────────────────────────────────────

class _FilterSheet extends ConsumerStatefulWidget {
  const _FilterSheet();

  @override
  ConsumerState<_FilterSheet> createState() => _FilterSheetState();
}

class _FilterSheetState extends ConsumerState<_FilterSheet> {
  late RangeValues _ageRange;
  late double _maxDistance;
  late Set<String> _tags;

  static const _sliderThemeBase = SliderThemeData(
    trackHeight: 3,
    thumbColor: Colors.white,
    thumbShape: RoundSliderThumbShape(enabledThumbRadius: 10),
    overlayShape: RoundSliderOverlayShape(overlayRadius: 20),
    rangeThumbShape: RoundRangeSliderThumbShape(enabledThumbRadius: 10),
  );

  @override
  void initState() {
    super.initState();
    final current = ref.read(filterProvider);
    _ageRange = RangeValues(
      current.ageMin.toDouble(),
      current.ageMax.toDouble(),
    );
    _maxDistance = current.maxDistanceKm;
    _tags = Set.from(current.tags);
  }

  // ── Draft helpers ─────────────────────────────────────────────────────────

  DiscoveryFilter _buildDraft() => DiscoveryFilter(
        ageMin: _ageRange.start.round(),
        ageMax: _ageRange.end.round(),
        maxDistanceKm: _maxDistance,
        tags: Set.from(_tags),
      );

  void _apply() {
    ref.read(filterProvider.notifier).apply(_buildDraft());
    Navigator.pop(context);
  }

  void _reset() {
    ref.read(filterProvider.notifier).reset();
    Navigator.pop(context);
  }

  // ── SliderTheme helper ────────────────────────────────────────────────────

  SliderThemeData get _sliderTheme => _sliderThemeBase.copyWith(
        activeTrackColor: AppTheme.primary,
        inactiveTrackColor: AppTheme.card,
        overlayColor: AppTheme.primary.withValues(alpha: 0.15),
        activeTickMarkColor: Colors.transparent,
        inactiveTickMarkColor: Colors.transparent,
      );

  // ── Build ─────────────────────────────────────────────────────────────────

  @override
  Widget build(BuildContext context) {
    final draft = _buildDraft();

    return Container(
      decoration: const BoxDecoration(
        color: AppTheme.surface,
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      // Shrink-wrap height; cap at 90% of screen so it doesn't overflow
      constraints: BoxConstraints(
        maxHeight: MediaQuery.of(context).size.height * 0.9,
      ),
      child: SafeArea(
        top: false,
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            // ── Handle ──
            Container(
              width: 36,
              height: 4,
              margin: const EdgeInsets.only(top: 12, bottom: 4),
              decoration: BoxDecoration(
                color: AppTheme.card,
                borderRadius: BorderRadius.circular(2),
              ),
            ),

            // ── Header ──
            Padding(
              padding: const EdgeInsets.fromLTRB(20, 8, 8, 8),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  const Text(
                    'Filters',
                    style: TextStyle(
                        fontSize: 20, fontWeight: FontWeight.w800),
                  ),
                  TextButton(
                    onPressed: _reset,
                    child: Text(
                      'Reset all',
                      style: TextStyle(
                          color: AppTheme.textHint, fontSize: 14),
                    ),
                  ),
                ],
              ),
            ),

            Divider(height: 1, color: const Color(0xFF2A2A2A)),

            // ── Scrollable content ──
            Flexible(
              child: SingleChildScrollView(
                padding: const EdgeInsets.fromLTRB(20, 24, 20, 12),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    _buildAgeSection(),
                    _buildDivider(),
                    _buildDistanceSection(),
                    _buildDivider(),
                    _buildTagsSection(),
                    const SizedBox(height: 8),
                  ],
                ),
              ),
            ),

            // ── Apply button ──
            Padding(
              padding: EdgeInsets.fromLTRB(
                  20, 8, 20, MediaQuery.of(context).padding.bottom + 16),
              child: GradientButton(
                text: draft.activeCount > 0
                    ? 'Apply ${draft.activeCount} Filter${draft.activeCount > 1 ? 's' : ''}'
                    : 'Apply Filters',
                onPressed: _apply,
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildDivider() => Padding(
        padding: const EdgeInsets.symmetric(vertical: 24),
        child: Divider(height: 1, color: const Color(0xFF2A2A2A)),
      );

  // ── Age range ─────────────────────────────────────────────────────────────

  Widget _buildAgeSection() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        _SectionHeader(
          label: 'Age range',
          value: '${_ageRange.start.round()} – ${_ageRange.end.round()}',
        ),
        const SizedBox(height: 4),
        SliderTheme(
          data: _sliderTheme,
          child: RangeSlider(
            min: 18,
            max: 80,
            divisions: 62,
            values: _ageRange,
            onChanged: (v) => setState(() => _ageRange = v),
          ),
        ),
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 4),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text('18',
                  style: TextStyle(
                      color: AppTheme.textHint, fontSize: 12)),
              Text('80+',
                  style: TextStyle(
                      color: AppTheme.textHint, fontSize: 12)),
            ],
          ),
        ),
      ],
    );
  }

  // ── Distance ──────────────────────────────────────────────────────────────

  Widget _buildDistanceSection() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        _SectionHeader(
          label: 'Max distance',
          value: '${_maxDistance.round()} km',
        ),
        const SizedBox(height: 4),
        SliderTheme(
          data: _sliderTheme,
          child: Slider(
            min: 1,
            max: 100,
            divisions: 99,
            value: _maxDistance,
            onChanged: (v) => setState(() => _maxDistance = v),
          ),
        ),
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 4),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text('1 km',
                  style: TextStyle(
                      color: AppTheme.textHint, fontSize: 12)),
              Text('100 km',
                  style: TextStyle(
                      color: AppTheme.textHint, fontSize: 12)),
            ],
          ),
        ),
      ],
    );
  }

  // ── Tags ──────────────────────────────────────────────────────────────────

  Widget _buildTagsSection() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            const Text(
              'Interests',
              style: TextStyle(
                  fontSize: 16, fontWeight: FontWeight.w600),
            ),
            if (_tags.isNotEmpty)
              GestureDetector(
                onTap: () => setState(() => _tags.clear()),
                child: Text(
                  'Clear',
                  style: TextStyle(
                      color: AppTheme.textHint, fontSize: 13),
                ),
              ),
          ],
        ),
        const SizedBox(height: 14),
        Wrap(
          spacing: 8,
          runSpacing: 10,
          children: _kAvailableTags.map((tag) {
            final selected = _tags.contains(tag);
            return GestureDetector(
              onTap: () => setState(() {
                if (selected) {
                  _tags.remove(tag);
                } else {
                  _tags.add(tag);
                }
              }),
              child: AnimatedContainer(
                duration: const Duration(milliseconds: 180),
                padding: const EdgeInsets.symmetric(
                    horizontal: 14, vertical: 9),
                decoration: BoxDecoration(
                  gradient: selected ? AppTheme.brandGradient : null,
                  color: selected ? null : AppTheme.card,
                  borderRadius: BorderRadius.circular(24),
                  border: selected
                      ? null
                      : Border.all(color: const Color(0xFF3A3A3A)),
                ),
                child: Text(
                  tag,
                  style: TextStyle(
                    fontSize: 13,
                    fontWeight: selected
                        ? FontWeight.w600
                        : FontWeight.w400,
                    color: selected
                        ? Colors.white
                        : AppTheme.textSecondary,
                  ),
                ),
              ),
            );
          }).toList(),
        ),
        if (_tags.isNotEmpty) ...[
          const SizedBox(height: 10),
          Text(
            '${_tags.length} selected',
            style: TextStyle(color: AppTheme.textHint, fontSize: 12),
          ),
        ],
      ],
    );
  }
}

// ── Shared section header ─────────────────────────────────────────────────────

class _SectionHeader extends StatelessWidget {
  final String label;
  final String value;

  const _SectionHeader({required this.label, required this.value});

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        Text(label,
            style: const TextStyle(
                fontSize: 16, fontWeight: FontWeight.w600)),
        Container(
          padding:
              const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
          decoration: BoxDecoration(
            color: AppTheme.card,
            borderRadius: BorderRadius.circular(12),
          ),
          child: Text(
            value,
            style: const TextStyle(
              color: AppTheme.primary,
              fontWeight: FontWeight.w600,
              fontSize: 13,
            ),
          ),
        ),
      ],
    );
  }
}
