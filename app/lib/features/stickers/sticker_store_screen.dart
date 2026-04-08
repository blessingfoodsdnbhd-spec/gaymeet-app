import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../config/theme.dart';
import '../../core/models/sticker.dart';
import '../../core/providers/stickers_provider.dart';
import '../../core/providers/gifts_provider.dart';

class StickerStoreScreen extends ConsumerStatefulWidget {
  const StickerStoreScreen({super.key});

  @override
  ConsumerState<StickerStoreScreen> createState() =>
      _StickerStoreScreenState();
}

class _StickerStoreScreenState extends ConsumerState<StickerStoreScreen>
    with SingleTickerProviderStateMixin {
  late TabController _tabs;
  final _categories = ['全部', '免费', '新品', '热门', '精品'];
  final _catKeys = ['all', 'free', 'new', 'popular', 'premium'];

  @override
  void initState() {
    super.initState();
    _tabs = TabController(length: _categories.length, vsync: this);
  }

  @override
  void dispose() {
    _tabs.dispose();
    super.dispose();
  }

  List<StickerPack> _filteredPacks(List<StickerPack> all, int tabIndex) {
    if (tabIndex == 0) return all;
    final cat = _catKeys[tabIndex];
    return all.where((p) => p.category == cat).toList();
  }

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(stickersProvider);

    return Scaffold(
      appBar: AppBar(
        title: const Text('贴图商店'),
        bottom: TabBar(
          controller: _tabs,
          isScrollable: true,
          tabs: _categories.map((c) => Tab(text: c)).toList(),
        ),
      ),
      body: state.isLoading
          ? const Center(child: CircularProgressIndicator())
          : TabBarView(
              controller: _tabs,
              children: List.generate(
                _categories.length,
                (i) => _PackList(
                  packs: _filteredPacks(state.allPacks, i),
                ),
              ),
            ),
    );
  }
}

class _PackList extends ConsumerWidget {
  final List<StickerPack> packs;
  const _PackList({required this.packs});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    if (packs.isEmpty) {
      return Center(
        child: Text('暂无贴图',
            style: TextStyle(color: AppTheme.textSecondary)),
      );
    }
    return RefreshIndicator(
      color: AppTheme.primary,
      onRefresh: () => ref.read(stickersProvider.notifier).fetchAll(),
      child: ListView.builder(
        padding: const EdgeInsets.all(16),
        itemCount: packs.length,
        itemBuilder: (_, i) => _PackCard(pack: packs[i]),
      ),
    );
  }
}

class _PackCard extends ConsumerStatefulWidget {
  final StickerPack pack;
  const _PackCard({required this.pack});

  @override
  ConsumerState<_PackCard> createState() => _PackCardState();
}

class _PackCardState extends ConsumerState<_PackCard> {
  bool _expanded = false;
  bool _purchasing = false;

  Future<void> _purchase() async {
    final balance = ref.read(giftsProvider).coinBalance;
    if (balance < widget.pack.price) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('金币不足，请充值')),
      );
      return;
    }
    setState(() => _purchasing = true);
    final ok = await ref.read(stickersProvider.notifier).purchase(widget.pack.id);
    if (mounted) {
      setState(() => _purchasing = false);
      if (!ok) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('购买失败，请重试')),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final pack = widget.pack;

    return Container(
      margin: const EdgeInsets.only(bottom: 16),
      decoration: BoxDecoration(
        color: AppTheme.card,
        borderRadius: BorderRadius.circular(16),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Header row
          Padding(
            padding: const EdgeInsets.all(14),
            child: Row(
              children: [
                Text(pack.coverEmoji,
                    style: const TextStyle(fontSize: 40)),
                const SizedBox(width: 14),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(pack.name,
                          style: const TextStyle(
                              fontSize: 15, fontWeight: FontWeight.w700)),
                      const SizedBox(height: 2),
                      Text(pack.description,
                          style: TextStyle(
                              color: AppTheme.textSecondary, fontSize: 12)),
                      const SizedBox(height: 4),
                      Text(
                        '${pack.totalDownloads} 人已购买',
                        style: TextStyle(
                            color: AppTheme.textHint, fontSize: 11),
                      ),
                    ],
                  ),
                ),
                const SizedBox(width: 8),
                _buildActionButton(pack),
              ],
            ),
          ),

          // Sticker preview row
          if (pack.stickers.isNotEmpty)
            Padding(
              padding: const EdgeInsets.fromLTRB(14, 0, 14, 6),
              child: GestureDetector(
                onTap: () => setState(() => _expanded = !_expanded),
                child: Row(
                  children: [
                    ...pack.stickers.take(6).map((s) => Padding(
                          padding: const EdgeInsets.only(right: 6),
                          child: Text(s.emoji,
                              style: const TextStyle(fontSize: 22)),
                        )),
                    if (pack.stickers.length > 6)
                      Text('+${pack.stickers.length - 6}',
                          style: TextStyle(
                              color: AppTheme.textHint, fontSize: 12)),
                    const Spacer(),
                    Icon(
                      _expanded
                          ? Icons.keyboard_arrow_up_rounded
                          : Icons.keyboard_arrow_down_rounded,
                      color: AppTheme.textHint,
                      size: 18,
                    ),
                  ],
                ),
              ),
            ),

          // Expanded grid
          if (_expanded)
            Padding(
              padding: const EdgeInsets.fromLTRB(14, 4, 14, 14),
              child: GridView.builder(
                shrinkWrap: true,
                physics: const NeverScrollableScrollPhysics(),
                gridDelegate:
                    const SliverGridDelegateWithFixedCrossAxisCount(
                  crossAxisCount: 4,
                  mainAxisSpacing: 8,
                  crossAxisSpacing: 8,
                ),
                itemCount: pack.stickers.length,
                itemBuilder: (_, i) => Container(
                  decoration: BoxDecoration(
                    color: AppTheme.surface,
                    borderRadius: BorderRadius.circular(10),
                  ),
                  child: Center(
                    child: Text(pack.stickers[i].emoji,
                        style: const TextStyle(fontSize: 28)),
                  ),
                ),
              ),
            ),

          const SizedBox(height: 4),
        ],
      ),
    );
  }

  Widget _buildActionButton(StickerPack pack) {
    if (pack.isOwned) {
      return Container(
        padding:
            const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
        decoration: BoxDecoration(
          color: const Color(0xFF4CAF50).withOpacity(0.15),
          borderRadius: BorderRadius.circular(8),
        ),
        child: const Text('已购买',
            style: TextStyle(
                color: Color(0xFF4CAF50),
                fontSize: 12,
                fontWeight: FontWeight.w600)),
      );
    }
    if (pack.isFree) {
      return ElevatedButton(
        onPressed: _purchasing ? null : _purchase,
        style: ElevatedButton.styleFrom(
          padding:
              const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
          minimumSize: Size.zero,
          tapTargetSize: MaterialTapTargetSize.shrinkWrap,
        ),
        child: const Text('免费获取', style: TextStyle(fontSize: 12)),
      );
    }
    return ElevatedButton(
      onPressed: _purchasing ? null : _purchase,
      style: ElevatedButton.styleFrom(
        padding:
            const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
        minimumSize: Size.zero,
        tapTargetSize: MaterialTapTargetSize.shrinkWrap,
      ),
      child: _purchasing
          ? const SizedBox(
              width: 14,
              height: 14,
              child: CircularProgressIndicator(strokeWidth: 2))
          : Text('${pack.price} 🪙',
              style: const TextStyle(fontSize: 12)),
    );
  }
}
