import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';

import '../../config/theme.dart';
import '../../core/providers/popular_provider.dart';
import '../../core/providers/subscription_provider.dart';

String _todayHeader() {
  final now = DateTime.now();
  final weekdays = ['周一', '周二', '周三', '周四', '周五', '周六', '周日'];
  final day = weekdays[now.weekday - 1];
  return '${now.month}/${now.day} ($day)';
}

class PopularScreen extends ConsumerStatefulWidget {
  const PopularScreen({super.key});

  @override
  ConsumerState<PopularScreen> createState() => _PopularScreenState();
}

class _PopularScreenState extends ConsumerState<PopularScreen> {
  void _showPurchaseSheet() {
    showModalBottomSheet(
      context: context,
      backgroundColor: AppTheme.card,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      builder: (_) => _PurchaseTicketSheet(
        onPurchase: () async {
          Navigator.pop(context);
          await ref.read(popularProvider.notifier).purchaseTicket();
          if (mounted) {
            ScaffoldMessenger.of(context).showSnackBar(
              SnackBar(
                content: const Text('人气票已购买！有效期7天'),
                backgroundColor: AppTheme.primary,
              ),
            );
          }
        },
      ),
    );
  }

  void _showUseTicketSheet() {
    showModalBottomSheet(
      context: context,
      backgroundColor: AppTheme.card,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      builder: (_) => _UseTicketSheet(
        onUse: () async {
          Navigator.pop(context);
          await ref.read(popularProvider.notifier).useTicket();
          if (mounted) {
            ScaffoldMessenger.of(context).showSnackBar(
              SnackBar(
                content: const Text('你已出现在人气榜！'),
                backgroundColor: AppTheme.primary,
              ),
            );
          }
        },
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(popularProvider);
    final isPremium = ref.watch(subscriptionProvider).isPremium;

    return RefreshIndicator(
      color: AppTheme.primary,
      onRefresh: () => ref.read(popularProvider.notifier).fetchPopular(),
      child: CustomScrollView(
        slivers: [
          // Header banner
          SliverToBoxAdapter(
            child: _buildHeader(isPremium),
          ),

          if (state.isLoading && state.entries.isEmpty)
            const SliverFillRemaining(
              child: Center(child: CircularProgressIndicator()),
            )
          else if (state.entries.isEmpty)
            SliverFillRemaining(
              child: Center(
                child: Text(
                  '暂无人气榜',
                  style: TextStyle(color: AppTheme.textSecondary),
                ),
              ),
            )
          else
            SliverPadding(
              padding: const EdgeInsets.all(12),
              sliver: SliverGrid(
                gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                  crossAxisCount: 3,
                  childAspectRatio: 0.72,
                  crossAxisSpacing: 8,
                  mainAxisSpacing: 8,
                ),
                delegate: SliverChildBuilderDelegate(
                  (_, i) => _PopularTile(entry: state.entries[i]),
                  childCount: state.entries.length,
                ),
              ),
            ),
        ],
      ),
    );
  }

  Widget _buildHeader(bool isPremium) {
    return Container(
      margin: const EdgeInsets.all(12),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        gradient: const LinearGradient(
          colors: [Color(0xFFFF3B6F), Color(0xFFFF8A5C)],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        borderRadius: BorderRadius.circular(16),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const Icon(Icons.local_fire_department_rounded,
                  color: Colors.white, size: 20),
              const SizedBox(width: 8),
              const Text(
                '高人气',
                style: TextStyle(
                  color: Colors.white,
                  fontWeight: FontWeight.w800,
                  fontSize: 16,
                ),
              ),
              const Spacer(),
              const Text(
                '每日更新',
                style: TextStyle(
                  color: Colors.white70,
                  fontSize: 11,
                ),
              ),
            ],
          ),
          const SizedBox(height: 6),
          Row(
            children: [
              Container(
                padding: const EdgeInsets.symmetric(
                    horizontal: 8, vertical: 3),
                decoration: BoxDecoration(
                  color: Colors.white.withValues(alpha: 0.15),
                  borderRadius: BorderRadius.circular(6),
                ),
                child: Text(
                  _todayHeader(),
                  style: const TextStyle(
                    color: Colors.white,
                    fontSize: 12,
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ),
              const SizedBox(width: 8),
              const Text(
                '今日人气榜 • 购买票上榜',
                style: TextStyle(color: Colors.white70, fontSize: 12),
              ),
            ],
          ),
          const SizedBox(height: 12),
          Row(
            children: [
              Expanded(
                child: OutlinedButton.icon(
                  onPressed: _showPurchaseSheet,
                  icon: const Icon(Icons.confirmation_number_outlined,
                      size: 16, color: Colors.white),
                  label: const Text('购买人气票',
                      style: TextStyle(color: Colors.white, fontSize: 13)),
                  style: OutlinedButton.styleFrom(
                    side: const BorderSide(color: Colors.white54),
                    padding: const EdgeInsets.symmetric(vertical: 10),
                  ),
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: ElevatedButton.icon(
                  onPressed: _showUseTicketSheet,
                  icon: const Icon(Icons.rocket_launch_rounded,
                      size: 16, color: Colors.black),
                  label: const Text('使用票',
                      style: TextStyle(
                          color: Colors.black, fontWeight: FontWeight.w700)),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: Colors.white,
                    padding: const EdgeInsets.symmetric(vertical: 10),
                  ),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

// ── Popular tile ──────────────────────────────────────────────────────────────

class _PopularTile extends StatelessWidget {
  final PopularEntry entry;
  const _PopularTile({required this.entry});

  @override
  Widget build(BuildContext context) {
    final u = entry.user;

    return GestureDetector(
      onTap: () => context.push('/user/${u.id}', extra: u),
      child: Container(
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(14),
          color: AppTheme.card,
        ),
        clipBehavior: Clip.antiAlias,
        child: Stack(
          fit: StackFit.expand,
          children: [
            if (u.avatarUrl != null)
              CachedNetworkImage(
                imageUrl: u.avatarUrl!,
                fit: BoxFit.cover,
                errorWidget: (_, __, ___) =>
                    const Center(child: Icon(Icons.person_rounded, size: 32)),
              )
            else
              const Center(child: Icon(Icons.person_rounded, size: 32)),

            const DecoratedBox(
              decoration: BoxDecoration(gradient: AppTheme.cardGradient),
            ),

            // Rank badge
            Positioned(
              top: 7,
              left: 7,
              child: Container(
                padding: const EdgeInsets.symmetric(
                    horizontal: 6, vertical: 2),
                decoration: BoxDecoration(
                  color: entry.rank <= 3
                      ? AppTheme.boost
                      : AppTheme.surface.withValues(alpha: 0.85),
                  borderRadius: BorderRadius.circular(6),
                ),
                child: Text(
                  '#${entry.rank}',
                  style: TextStyle(
                    fontSize: 10,
                    fontWeight: FontWeight.w800,
                    color: entry.rank <= 3 ? Colors.black : AppTheme.textPrimary,
                  ),
                ),
              ),
            ),

            // Ticket badge
            if (entry.source == 'ticket')
              Positioned(
                top: 7,
                right: 7,
                child: Container(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 5, vertical: 2),
                  decoration: BoxDecoration(
                    color: AppTheme.primary.withValues(alpha: 0.9),
                    borderRadius: BorderRadius.circular(6),
                  ),
                  child: const Text(
                    '票',
                    style: TextStyle(fontSize: 9, color: Colors.white),
                  ),
                ),
              ),

            Positioned(
              left: 6,
              right: 6,
              bottom: 6,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text(
                    u.nickname,
                    style: const TextStyle(
                      fontWeight: FontWeight.w700,
                      fontSize: 12,
                      color: Colors.white,
                    ),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                  if (u.height != null || u.age != null)
                    Text(
                      [
                        if (u.age != null) '${u.age}岁',
                        if (u.height != null) '${u.height}cm',
                      ].join(' · '),
                      style: TextStyle(
                        fontSize: 10,
                        color: Colors.white.withValues(alpha: 0.75),
                      ),
                    ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

// ── Sheets ────────────────────────────────────────────────────────────────────

class _PurchaseTicketSheet extends StatelessWidget {
  final VoidCallback onPurchase;
  const _PurchaseTicketSheet({required this.onPurchase});

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
          const Icon(Icons.confirmation_number_rounded,
              color: AppTheme.primary, size: 48),
          const SizedBox(height: 12),
          Text(
            '购买人气票',
            style: TextStyle(
              color: AppTheme.textPrimary,
              fontSize: 20,
              fontWeight: FontWeight.w800,
            ),
          ),
          const SizedBox(height: 8),
          Text(
            '使用人气票可以让你出现在人气榜上，\n让更多人看到你的资料。',
            textAlign: TextAlign.center,
            style: TextStyle(color: AppTheme.textSecondary, fontSize: 13, height: 1.5),
          ),
          const SizedBox(height: 16),
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: AppTheme.surface,
              borderRadius: BorderRadius.circular(12),
            ),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text('人气票 × 1',
                    style: TextStyle(color: AppTheme.textPrimary, fontWeight: FontWeight.w600)),
                Text('RM 4.90',
                    style: TextStyle(
                        color: AppTheme.primary,
                        fontSize: 18,
                        fontWeight: FontWeight.w800)),
              ],
            ),
          ),
          const SizedBox(height: 16),
          SizedBox(
            width: double.infinity,
            child: ElevatedButton(
              onPressed: onPurchase,
              child: const Text('立即购买'),
            ),
          ),
          const SizedBox(height: 8),
        ],
      ),
    );
  }
}

class _UseTicketSheet extends StatelessWidget {
  final VoidCallback onUse;
  const _UseTicketSheet({required this.onUse});

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
          const Icon(Icons.rocket_launch_rounded,
              color: AppTheme.primary, size: 48),
          const SizedBox(height: 12),
          Text(
            '使用人气票',
            style: TextStyle(
              color: AppTheme.textPrimary,
              fontSize: 20,
              fontWeight: FontWeight.w800,
            ),
          ),
          const SizedBox(height: 8),
          Text(
            '你的资料将出现在今日人气榜，\n有效期至今天结束。',
            textAlign: TextAlign.center,
            style: TextStyle(color: AppTheme.textSecondary, fontSize: 13, height: 1.5),
          ),
          const SizedBox(height: 20),
          SizedBox(
            width: double.infinity,
            child: ElevatedButton.icon(
              onPressed: onUse,
              icon: const Icon(Icons.rocket_launch_rounded, size: 18),
              label: const Text('立即上榜！'),
            ),
          ),
          const SizedBox(height: 8),
        ],
      ),
    );
  }
}
