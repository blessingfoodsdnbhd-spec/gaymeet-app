import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../config/theme.dart';
import '../../core/providers/filter_provider.dart';
import 'nearby_grid_screen.dart';
import 'calling_screen.dart';
import 'popular_screen.dart';
import 'location_map_screen.dart';
import 'nearby_filter_tab.dart';

class LocationHubScreen extends ConsumerStatefulWidget {
  const LocationHubScreen({super.key});

  @override
  ConsumerState<LocationHubScreen> createState() => _LocationHubScreenState();
}

class _LocationHubScreenState extends ConsumerState<LocationHubScreen>
    with SingleTickerProviderStateMixin {
  late final TabController _tabController;

  static const _tabs = ['附近', '呼唤', '高人气', '位置', '过滤'];

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: _tabs.length, vsync: this);
    _tabController.addListener(() => setState(() {}));
  }

  @override
  void dispose() {
    _tabController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final filterActive = ref.watch(filterProvider).activeCount > 0;
    final currentIndex = _tabController.index;

    return Scaffold(
      appBar: AppBar(
        titleSpacing: 16,
        title: Row(
          children: [
            Text(
              _tabs[currentIndex],
              style: const TextStyle(
                  fontWeight: FontWeight.w800, fontSize: 18),
            ),
            // Filter badge on 附近 tab when filters are active
            if (currentIndex == 0 && filterActive) ...[
              const SizedBox(width: 8),
              Container(
                padding: const EdgeInsets.symmetric(
                    horizontal: 6, vertical: 2),
                decoration: BoxDecoration(
                  color: AppTheme.primary,
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Text(
                  '过滤中',
                  style: const TextStyle(
                      color: Colors.white,
                      fontSize: 11,
                      fontWeight: FontWeight.w700),
                ),
              ),
            ],
          ],
        ),
        bottom: PreferredSize(
          preferredSize: const Size.fromHeight(44),
          child: Container(
            height: 44,
            color: AppTheme.bg,
            child: TabBar(
              controller: _tabController,
              isScrollable: true,
              tabAlignment: TabAlignment.start,
              indicatorColor: AppTheme.primary,
              indicatorWeight: 2.5,
              indicatorSize: TabBarIndicatorSize.label,
              labelColor: AppTheme.primary,
              unselectedLabelColor: AppTheme.textHint,
              labelStyle: const TextStyle(
                fontSize: 14,
                fontWeight: FontWeight.w700,
              ),
              unselectedLabelStyle: const TextStyle(
                fontSize: 14,
                fontWeight: FontWeight.w500,
              ),
              padding: const EdgeInsets.symmetric(horizontal: 12),
              labelPadding: const EdgeInsets.symmetric(horizontal: 14),
              tabs: _tabs
                  .map((t) => Tab(
                        child: Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Text(t),
                            // Dot badge on 过滤 when active
                            if (t == '过滤' && filterActive)
                              Container(
                                margin: const EdgeInsets.only(left: 4),
                                width: 6,
                                height: 6,
                                decoration: const BoxDecoration(
                                  shape: BoxShape.circle,
                                  color: AppTheme.primary,
                                ),
                              ),
                          ],
                        ),
                      ))
                  .toList(),
            ),
          ),
        ),
      ),
      body: TabBarView(
        controller: _tabController,
        physics: const NeverScrollableScrollPhysics(),
        children: const [
          NearbyGridScreen(),
          CallingScreen(),
          PopularScreen(),
          LocationMapScreen(),
          NearbyFilterTab(),
        ],
      ),
    );
  }
}
