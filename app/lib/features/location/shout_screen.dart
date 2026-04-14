import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../config/theme.dart';
import '../../core/models/shout.dart';
import '../../core/providers/shout_provider.dart';

class ShoutScreen extends ConsumerStatefulWidget {
  const ShoutScreen({super.key});

  @override
  ConsumerState<ShoutScreen> createState() => _ShoutScreenState();
}

class _ShoutScreenState extends ConsumerState<ShoutScreen> {
  final _controller = TextEditingController();
  bool _posting = false;

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  Future<void> _postShout() async {
    final text = _controller.text.trim();
    if (text.isEmpty) return;
    setState(() => _posting = true);
    await ref.read(shoutProvider.notifier).postShout(text);
    _controller.clear();
    if (mounted) setState(() => _posting = false);
  }

  Future<void> _deleteShout() async {
    await ref.read(shoutProvider.notifier).deleteShout();
  }

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(shoutProvider);

    return RefreshIndicator(
      color: AppTheme.primary,
      onRefresh: () => ref.read(shoutProvider.notifier).fetchShouts(),
      child: CustomScrollView(
        slivers: [
          // Compose / My shout section
          SliverToBoxAdapter(
            child: _buildComposeCard(state),
          ),

          if (state.isLoading && state.shouts.isEmpty)
            const SliverFillRemaining(
              child: Center(child: CircularProgressIndicator()),
            )
          else if (state.shouts.isEmpty)
            SliverFillRemaining(
              child: Center(
                child: Text(
                  'No shouts nearby. Be the first!',
                  style: TextStyle(color: AppTheme.textSecondary),
                ),
              ),
            )
          else
            SliverList(
              delegate: SliverChildBuilderDelegate(
                (_, i) => _ShoutCard(shout: state.shouts[i]),
                childCount: state.shouts.length,
              ),
            ),
        ],
      ),
    );
  }

  Widget _buildComposeCard(ShoutState state) {
    final myShout = state.myShout;

    return Container(
      margin: const EdgeInsets.all(12),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppTheme.card,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppTheme.primary.withValues(alpha: 0.3)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const Icon(Icons.campaign_rounded,
                  color: AppTheme.primary, size: 20),
              const SizedBox(width: 8),
              Text(
                '呼唤',
                style: TextStyle(
                  color: AppTheme.textPrimary,
                  fontWeight: FontWeight.w700,
                  fontSize: 15,
                ),
              ),
              const Spacer(),
              Text(
                '24h broadcast',
                style: TextStyle(color: AppTheme.textHint, fontSize: 11),
              ),
            ],
          ),
          const SizedBox(height: 12),
          if (myShout != null && !myShout.isExpired) ...[
            Container(
              width: double.infinity,
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: AppTheme.surface,
                borderRadius: BorderRadius.circular(10),
              ),
              child: Text(
                myShout.content,
                style: TextStyle(
                    color: AppTheme.textPrimary, fontSize: 14),
              ),
            ),
            const SizedBox(height: 8),
            Align(
              alignment: Alignment.centerRight,
              child: TextButton.icon(
                onPressed: _deleteShout,
                icon: const Icon(Icons.delete_outline_rounded,
                    size: 16, color: AppTheme.error),
                label: const Text('删除',
                    style:
                        TextStyle(color: AppTheme.error, fontSize: 13)),
              ),
            ),
          ] else ...[
            TextField(
              controller: _controller,
              maxLength: 140,
              maxLines: 3,
              style: TextStyle(color: AppTheme.textPrimary, fontSize: 14),
              decoration: InputDecoration(
                hintText: '说点什么吧... (max 140 chars)',
                hintStyle: TextStyle(color: AppTheme.textHint, fontSize: 13),
                counterStyle:
                    TextStyle(color: AppTheme.textHint, fontSize: 11),
                fillColor: AppTheme.surface,
                filled: true,
              ),
            ),
            const SizedBox(height: 8),
            SizedBox(
              width: double.infinity,
              child: ElevatedButton(
                onPressed: _posting ? null : _postShout,
                child: _posting
                    ? const SizedBox(
                        width: 16,
                        height: 16,
                        child: CircularProgressIndicator(
                            strokeWidth: 2, color: Colors.white),
                      )
                    : const Text('发送呼唤'),
              ),
            ),
          ],
        ],
      ),
    );
  }
}

// ── Shout card ────────────────────────────────────────────────────────────────

class _ShoutCard extends StatelessWidget {
  final ShoutModel shout;
  const _ShoutCard({required this.shout});

  @override
  Widget build(BuildContext context) {
    final u = shout.user;
    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 12, vertical: 5),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: AppTheme.card,
        borderRadius: BorderRadius.circular(14),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Avatar
          Container(
            width: 46,
            height: 46,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              color: AppTheme.surface,
            ),
            clipBehavior: Clip.antiAlias,
            child: u.avatarUrl != null
                ? CachedNetworkImage(
                    imageUrl: u.avatarUrl!,
                    fit: BoxFit.cover,
                    errorWidget: (_, __, ___) =>
                        const Icon(Icons.person_rounded, size: 24),
                  )
                : const Icon(Icons.person_rounded, size: 24),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Text(
                      u.nickname,
                      style: TextStyle(
                        color: AppTheme.textPrimary,
                        fontWeight: FontWeight.w600,
                        fontSize: 13,
                      ),
                    ),
                    if (u.countryCode != null) ...[
                      const SizedBox(width: 5),
                      Text(_flagEmoji(u.countryCode!),
                          style: const TextStyle(fontSize: 13)),
                    ],
                    if (u.isOnline) ...[
                      const SizedBox(width: 6),
                      Container(
                        width: 7,
                        height: 7,
                        decoration: const BoxDecoration(
                          shape: BoxShape.circle,
                          color: AppTheme.online,
                        ),
                      ),
                    ],
                    const Spacer(),
                    if (shout.distance != null)
                      Text(
                        shout.distance! < 1
                            ? '${(shout.distance! * 1000).round()}m'
                            : '${shout.distance!.toStringAsFixed(1)}km',
                        style: TextStyle(
                            color: AppTheme.textHint, fontSize: 11),
                      ),
                  ],
                ),
                const SizedBox(height: 4),
                Text(
                  shout.content,
                  style: TextStyle(
                    color: AppTheme.textSecondary,
                    fontSize: 13,
                    height: 1.4,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  _timeAgo(shout.createdAt),
                  style: TextStyle(color: AppTheme.textHint, fontSize: 11),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  String _flagEmoji(String code) {
    final base = 0x1F1E6 - 0x41;
    return String.fromCharCode(base + code.codeUnitAt(0)) +
        String.fromCharCode(base + code.codeUnitAt(1));
  }

  String _timeAgo(DateTime dt) {
    final diff = DateTime.now().difference(dt);
    if (diff.inMinutes < 1) return 'Just now';
    if (diff.inMinutes < 60) return '${diff.inMinutes}m ago';
    if (diff.inHours < 24) return '${diff.inHours}h ago';
    return '${diff.inDays}d ago';
  }
}
