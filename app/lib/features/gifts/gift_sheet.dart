import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../config/theme.dart';
import '../../core/models/gift.dart';
import '../../core/providers/gifts_provider.dart';

/// Bottom sheet for sending a virtual gift to [receiverId].
/// Opens via showModalBottomSheet.
class GiftSheet extends ConsumerStatefulWidget {
  final String receiverId;
  final String receiverName;

  const GiftSheet({
    super.key,
    required this.receiverId,
    required this.receiverName,
  });

  @override
  ConsumerState<GiftSheet> createState() => _GiftSheetState();
}

class _GiftSheetState extends ConsumerState<GiftSheet>
    with SingleTickerProviderStateMixin {
  late final TabController _tabCtrl;
  Gift? _selected;
  final _msgC = TextEditingController();

  static const _categories = [
    ('romantic', '浪漫'),
    ('fun', '趣味'),
    ('luxury', '奢华'),
  ];

  @override
  void initState() {
    super.initState();
    _tabCtrl = TabController(length: _categories.length, vsync: this);
  }

  @override
  void dispose() {
    _tabCtrl.dispose();
    _msgC.dispose();
    super.dispose();
  }

  Future<void> _send() async {
    if (_selected == null) return;
    final giftsNotifier = ref.read(giftsProvider.notifier);
    final balance = ref.read(giftsProvider).coinBalance;

    if (balance < _selected!.price) {
      Navigator.pop(context);
      context.push('/coins');
      return;
    }

    final err = await giftsNotifier.sendGift(
      receiverId: widget.receiverId,
      giftId: _selected!.id,
      giftPrice: _selected!.price,
      message: _msgC.text.trim().isEmpty ? null : _msgC.text.trim(),
    );

    if (!mounted) return;
    Navigator.pop(context);

    if (err == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
              '已发送 ${_selected!.icon} ${_selected!.name} 给 ${widget.receiverName}！'),
          backgroundColor: AppTheme.primary,
        ),
      );
    } else if (err == 'insufficient_coins') {
      context.push('/coins');
    } else {
      ScaffoldMessenger.of(context)
          .showSnackBar(SnackBar(content: Text('发送失败：$err')));
    }
  }

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(giftsProvider);

    return Container(
      height: MediaQuery.of(context).size.height * 0.62,
      decoration: const BoxDecoration(
        color: AppTheme.surface,
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      child: Column(
        children: [
          // ── Handle ──────────────────────────────────────────────────────
          const SizedBox(height: 10),
          Container(
            width: 36,
            height: 4,
            decoration: BoxDecoration(
              color: const Color(0xFF3A3A3A),
              borderRadius: BorderRadius.circular(2),
            ),
          ),

          // ── Header row ───────────────────────────────────────────────────
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 14, 16, 0),
            child: Row(
              children: [
                const Text('送礼物',
                    style:
                        TextStyle(fontSize: 16, fontWeight: FontWeight.w700)),
                const Spacer(),
                Container(
                  padding: const EdgeInsets.symmetric(
                      horizontal: 10, vertical: 4),
                  decoration: BoxDecoration(
                    color: AppTheme.card,
                    borderRadius: BorderRadius.circular(20),
                  ),
                  child: Row(
                    children: [
                      const Text('🪙 ', style: TextStyle(fontSize: 14)),
                      Text(
                        state.coinBalance.toString(),
                        style: TextStyle(
                          color: AppTheme.textPrimary,
                          fontWeight: FontWeight.w700,
                          fontSize: 13,
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(width: 8),
                GestureDetector(
                  onTap: () {
                    Navigator.pop(context);
                    context.push('/coins');
                  },
                  child: Container(
                    padding: const EdgeInsets.symmetric(
                        horizontal: 10, vertical: 4),
                    decoration: BoxDecoration(
                      gradient: AppTheme.brandGradient,
                      borderRadius: BorderRadius.circular(20),
                    ),
                    child: const Text('充值',
                        style: TextStyle(
                            color: Colors.white,
                            fontSize: 12,
                            fontWeight: FontWeight.w600)),
                  ),
                ),
              ],
            ),
          ),

          // ── Category tabs ────────────────────────────────────────────────
          TabBar(
            controller: _tabCtrl,
            tabs: _categories.map((c) => Tab(text: c.$2)).toList(),
            labelColor: AppTheme.primary,
            unselectedLabelColor: AppTheme.textSecondary,
            indicatorColor: AppTheme.primary,
            indicatorSize: TabBarIndicatorSize.label,
          ),

          // ── Gift grids ───────────────────────────────────────────────────
          Expanded(
            child: TabBarView(
              controller: _tabCtrl,
              children: _categories.map((cat) {
                final gifts = state.byCategory(cat.$1);
                return GridView.builder(
                  padding: const EdgeInsets.all(12),
                  gridDelegate:
                      const SliverGridDelegateWithFixedCrossAxisCount(
                    crossAxisCount: 4,
                    mainAxisSpacing: 12,
                    crossAxisSpacing: 12,
                    childAspectRatio: 0.75,
                  ),
                  itemCount: gifts.length,
                  itemBuilder: (_, i) => _GiftTile(
                    gift: gifts[i],
                    isSelected: _selected?.id == gifts[i].id,
                    onTap: () => setState(() => _selected = gifts[i]),
                  ),
                );
              }).toList(),
            ),
          ),

          // ── Message input ────────────────────────────────────────────────
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
            child: Container(
              decoration: BoxDecoration(
                color: AppTheme.card,
                borderRadius: BorderRadius.circular(22),
              ),
              child: TextField(
                controller: _msgC,
                style: const TextStyle(fontSize: 14),
                decoration: InputDecoration(
                  hintText: '附言（可选）...',
                  hintStyle: TextStyle(color: AppTheme.textHint),
                  border: InputBorder.none,
                  contentPadding: const EdgeInsets.symmetric(
                      horizontal: 16, vertical: 10),
                ),
              ),
            ),
          ),

          // ── Send button ──────────────────────────────────────────────────
          Padding(
            padding: EdgeInsets.fromLTRB(
                16, 4, 16, MediaQuery.of(context).padding.bottom + 12),
            child: SizedBox(
              width: double.infinity,
              child: ElevatedButton(
                onPressed: _selected == null || state.isSending ? null : _send,
                child: state.isSending
                    ? const SizedBox(
                        width: 20,
                        height: 20,
                        child: CircularProgressIndicator(
                            strokeWidth: 2, color: Colors.white))
                    : Text(_selected == null
                        ? '选择礼物'
                        : '发送 ${_selected!.icon} ${_selected!.name}（${_selected!.price} 🪙）'),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

// ── Gift Tile ─────────────────────────────────────────────────────────────────

class _GiftTile extends StatelessWidget {
  final Gift gift;
  final bool isSelected;
  final VoidCallback onTap;

  const _GiftTile({
    required this.gift,
    required this.isSelected,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 150),
        decoration: BoxDecoration(
          color: isSelected
              ? AppTheme.primary.withValues(alpha: 0.12)
              : AppTheme.card,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(
            color: isSelected ? AppTheme.primary : Colors.transparent,
            width: 2,
          ),
        ),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Text(gift.icon, style: const TextStyle(fontSize: 28)),
            const SizedBox(height: 4),
            Text(
              gift.name,
              style: TextStyle(
                color: AppTheme.textPrimary,
                fontSize: 11,
                fontWeight: FontWeight.w600,
              ),
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 2),
            Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                const Text('🪙', style: TextStyle(fontSize: 10)),
                Text(
                  ' ${gift.price}',
                  style: TextStyle(
                    color: AppTheme.textHint,
                    fontSize: 11,
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}
