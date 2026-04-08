import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../config/theme.dart';
import '../../core/models/gift.dart';
import '../../core/providers/gifts_provider.dart';

class GiftInboxScreen extends ConsumerStatefulWidget {
  const GiftInboxScreen({super.key});

  @override
  ConsumerState<GiftInboxScreen> createState() => _GiftInboxScreenState();
}

class _GiftInboxScreenState extends ConsumerState<GiftInboxScreen> {
  @override
  void initState() {
    super.initState();
    Future.microtask(() => ref.read(giftsProvider.notifier).fetchReceived());
  }

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(giftsProvider);
    final txs = state.received;

    return Scaffold(
      appBar: AppBar(
        title: const Text('收到的礼物'),
        actions: [
          Padding(
            padding: const EdgeInsets.only(right: 16),
            child: Center(
              child: Container(
                padding:
                    const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                decoration: BoxDecoration(
                  color: AppTheme.card,
                  borderRadius: BorderRadius.circular(16),
                ),
                child: Row(children: [
                  const Text('🪙 ', style: TextStyle(fontSize: 12)),
                  Text(state.coinBalance.toString(),
                      style: const TextStyle(
                          fontWeight: FontWeight.w700, fontSize: 12)),
                ]),
              ),
            ),
          ),
        ],
      ),
      body: state.isLoading
          ? const Center(child: CircularProgressIndicator())
          : txs.isEmpty
              ? _buildEmpty()
              : RefreshIndicator(
                  color: AppTheme.primary,
                  onRefresh: () =>
                      ref.read(giftsProvider.notifier).fetchReceived(),
                  child: ListView.separated(
                    padding: const EdgeInsets.symmetric(vertical: 8),
                    itemCount: txs.length,
                    separatorBuilder: (_, __) => const Divider(
                        height: 1, color: Color(0xFF2A2A2A), indent: 76),
                    itemBuilder: (_, i) => _GiftTile(tx: txs[i]),
                  ),
                ),
    );
  }

  Widget _buildEmpty() => Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Text('🎁', style: TextStyle(fontSize: 52)),
            const SizedBox(height: 12),
            Text('还没有收到礼物',
                style: TextStyle(
                    color: AppTheme.textSecondary, fontSize: 15)),
            const SizedBox(height: 6),
            Text('快去向喜欢的人介绍自己吧！',
                style:
                    TextStyle(color: AppTheme.textHint, fontSize: 13)),
          ],
        ),
      );
}

class _GiftTile extends StatelessWidget {
  final GiftTransaction tx;
  const _GiftTile({required this.tx});

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: () => context.push('/user/${tx.sender.id}'),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
        child: Row(
          children: [
            // Avatar
            Container(
              width: 48,
              height: 48,
              decoration: const BoxDecoration(shape: BoxShape.circle),
              clipBehavior: Clip.antiAlias,
              child: tx.sender.avatarUrl != null
                  ? CachedNetworkImage(
                      imageUrl: tx.sender.avatarUrl!, fit: BoxFit.cover)
                  : Container(
                      color: AppTheme.card,
                      child: const Icon(Icons.person_rounded,
                          color: Color(0xFF3A3A3A))),
            ),
            const SizedBox(width: 14),
            // Info
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  RichText(
                    text: TextSpan(
                      style: const TextStyle(fontSize: 14, height: 1.4),
                      children: [
                        TextSpan(
                          text: tx.sender.nickname,
                          style: const TextStyle(
                              fontWeight: FontWeight.w700,
                              color: Colors.white),
                        ),
                        TextSpan(
                          text: ' 送了你 ',
                          style: TextStyle(color: AppTheme.textSecondary),
                        ),
                        TextSpan(
                          text: '${tx.gift.icon} ${tx.gift.name}',
                          style: TextStyle(
                              color: AppTheme.primary,
                              fontWeight: FontWeight.w600),
                        ),
                      ],
                    ),
                  ),
                  if (tx.message != null && tx.message!.isNotEmpty) ...[
                    const SizedBox(height: 4),
                    Text(
                      '"${tx.message}"',
                      style: TextStyle(
                        color: AppTheme.textSecondary,
                        fontSize: 13,
                        fontStyle: FontStyle.italic,
                      ),
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                    ),
                  ],
                  const SizedBox(height: 4),
                  Text(
                    _timeAgo(tx.createdAt),
                    style:
                        TextStyle(color: AppTheme.textHint, fontSize: 11),
                  ),
                ],
              ),
            ),
            const SizedBox(width: 8),
            // Gift big emoji
            Text(tx.gift.icon,
                style: const TextStyle(fontSize: 32)),
          ],
        ),
      ),
    );
  }

  String _timeAgo(DateTime dt) {
    final diff = DateTime.now().difference(dt);
    if (diff.inMinutes < 1) return '刚刚';
    if (diff.inMinutes < 60) return '${diff.inMinutes}分钟前';
    if (diff.inHours < 24) return '${diff.inHours}小时前';
    if (diff.inDays < 7) return '${diff.inDays}天前';
    return '${dt.month}/${dt.day}';
  }
}
