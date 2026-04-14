import 'package:flutter/material.dart';
import '../../../core/theme/design_system.dart';

class AppTabBar extends StatelessWidget {
  final List<String> tabs;
  final int selectedIndex;
  final ValueChanged<int> onTap;
  final bool scrollable;

  const AppTabBar({
    super.key,
    required this.tabs,
    required this.selectedIndex,
    required this.onTap,
    this.scrollable = false,
  });

  @override
  Widget build(BuildContext context) {
    final inner = scrollable
        ? SingleChildScrollView(
            scrollDirection: Axis.horizontal,
            padding: const EdgeInsets.symmetric(horizontal: AppSpacing.md),
            child: Row(children: _buildTabs()),
          )
        : Padding(
            padding: const EdgeInsets.symmetric(horizontal: AppSpacing.md),
            child: Row(children: _buildTabs()),
          );

    return SizedBox(height: 38, child: inner);
  }

  List<Widget> _buildTabs() {
    return List.generate(tabs.length, (i) {
      final selected = i == selectedIndex;
      return GestureDetector(
        onTap: () => onTap(i),
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 200),
          margin: const EdgeInsets.only(right: AppSpacing.sm),
          padding: const EdgeInsets.symmetric(
              horizontal: AppSpacing.md, vertical: AppSpacing.sm),
          decoration: BoxDecoration(
            gradient: selected ? AppColors.pinkGradient : null,
            color: selected ? null : AppColors.bgCard,
            borderRadius: AppRadius.fullRadius,
            border: selected
                ? null
                : Border.all(
                    color: AppColors.pink500.withValues(alpha: 0.2), width: 1),
          ),
          child: Text(
            tabs[i],
            style: TextStyle(
              fontSize: 13,
              fontWeight: selected ? FontWeight.w700 : FontWeight.w500,
              color: selected ? Colors.white : AppColors.textSecondary,
            ),
          ),
        ),
      );
    });
  }
}
