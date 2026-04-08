import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../config/theme.dart';
import '../../core/models/direct_message.dart';
import '../../core/providers/dm_provider.dart';

class DmInboxScreen extends ConsumerStatefulWidget {
  const DmInboxScreen({super.key});

  @override
  ConsumerState<DmInboxScreen> createState() => _DmInboxScreenState();
}

class _DmInboxScreenState extends ConsumerState<DmInboxScreen>
    with SingleTickerProviderStateMixin {
  late TabController _tabs;

  @override
  void initState() {
    super.initState();
    _tabs = TabController(length: 2, vsync: this);
    ref.read(dmProvider.notifier).fetchSent();
  }

  @override
  void dispose() {
    _tabs.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(dmProvider);

    return Scaffold(
      appBar: AppBar(
        title: const Text('私信箱'),
        bottom: TabBar(
          controller: _tabs,
          tabs: [
            Tab(
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  const Text('收件箱'),
                  if (state.unreadCount > 0) ...[
                    const SizedBox(width: 6),
                    Container(
                      padding: const EdgeInsets.symmetric(
                          horizontal: 6, vertical: 1),
                      decoration: BoxDecoration(
                        color: AppTheme.primary,
                        borderRadius: BorderRadius.circular(10),
                      ),
                      child: Text(
                        state.unreadCount.toString(),
                        style: const TextStyle(
                            fontSize: 10,
                            color: Colors.white,
                            fontWeight: FontWeight.w700),
                      ),
                    ),
                  ],
                ],
              ),
            ),
            const Tab(text: '已发送'),
          ],
        ),
      ),
      body: state.isLoading
          ? const Center(child: CircularProgressIndicator())
          : TabBarView(
              controller: _tabs,
              children: [
                _InboxList(messages: state.inbox),
                _SentList(messages: state.sent),
              ],
            ),
    );
  }
}

// ── Inbox ─────────────────────────────────────────────────────────────────────

class _InboxList extends ConsumerWidget {
  final List<DirectMessage> messages;
  const _InboxList({required this.messages});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    if (messages.isEmpty) {
      return Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(Icons.mark_email_unread_outlined,
                size: 52, color: AppTheme.textHint),
            const SizedBox(height: 12),
            Text('暂无私信',
                style: TextStyle(
                    color: AppTheme.textSecondary, fontSize: 15)),
          ],
        ),
      );
    }

    return RefreshIndicator(
      color: AppTheme.primary,
      onRefresh: () => ref.read(dmProvider.notifier).fetchInbox(),
      child: ListView.builder(
        itemCount: messages.length,
        itemBuilder: (_, i) => _InboxTile(message: messages[i]),
      ),
    );
  }
}

class _InboxTile extends ConsumerStatefulWidget {
  final DirectMessage message;
  const _InboxTile({required this.message});

  @override
  ConsumerState<_InboxTile> createState() => _InboxTileState();
}

class _InboxTileState extends ConsumerState<_InboxTile> {
  bool _expanded = false;
  final _replyCtrl = TextEditingController();
  bool _replying = false;

  @override
  void dispose() {
    _replyCtrl.dispose();
    super.dispose();
  }

  Future<void> _accept() async {
    await ref.read(dmProvider.notifier).accept(widget.message.id);
  }

  Future<void> _delete() async {
    await ref.read(dmProvider.notifier).delete(widget.message.id);
  }

  Future<void> _sendReply() async {
    final content = _replyCtrl.text.trim();
    if (content.isEmpty) return;
    setState(() => _replying = true);
    final ok = await ref.read(dmProvider.notifier).reply(widget.message.id, content);
    if (ok && mounted) {
      _replyCtrl.clear();
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('回复已发送')),
      );
    }
    if (mounted) setState(() => _replying = false);
  }

  @override
  Widget build(BuildContext context) {
    final m = widget.message;
    final isBlurred = m.blurred || !m.isAccepted;

    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
      decoration: BoxDecoration(
        color: AppTheme.card,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(
          color: isBlurred
              ? AppTheme.primary.withOpacity(0.3)
              : const Color(0xFF2A2A2A),
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Header
          ListTile(
            contentPadding:
                const EdgeInsets.symmetric(horizontal: 14, vertical: 4),
            leading: _DmAvatar(user: m.sender),
            title: Row(
              children: [
                Text(m.sender.nickname,
                    style: const TextStyle(
                        fontWeight: FontWeight.w700, fontSize: 14)),
                if (m.sender.isVerified) ...[
                  const SizedBox(width: 4),
                  const Icon(Icons.verified_rounded,
                      size: 14, color: Color(0xFF1976D2)),
                ],
              ],
            ),
            subtitle: Text(
              '花费 ${m.cost} 🪙 · ${_timeAgo(m.createdAt)}',
              style: TextStyle(color: AppTheme.textHint, fontSize: 11),
            ),
            trailing: GestureDetector(
              onTap: () => setState(() => _expanded = !_expanded),
              child: Icon(
                _expanded
                    ? Icons.keyboard_arrow_up_rounded
                    : Icons.keyboard_arrow_down_rounded,
                color: AppTheme.textHint,
              ),
            ),
          ),

          // Message content (blurred if not accepted)
          Padding(
            padding: const EdgeInsets.fromLTRB(14, 0, 14, 12),
            child: isBlurred
                ? Stack(
                    children: [
                      Text(
                        m.content,
                        style: const TextStyle(fontSize: 14, height: 1.5),
                        maxLines: 2,
                      ),
                      Positioned.fill(
                        child: ClipRRect(
                          child: Container(
                            decoration: BoxDecoration(
                              color: AppTheme.card.withOpacity(0.85),
                              borderRadius: BorderRadius.circular(4),
                            ),
                            child: Center(
                              child: Row(
                                mainAxisSize: MainAxisSize.min,
                                children: [
                                  Icon(Icons.lock_rounded,
                                      size: 14, color: AppTheme.textHint),
                                  const SizedBox(width: 4),
                                  Text('接受后可查看',
                                      style: TextStyle(
                                          color: AppTheme.textSecondary,
                                          fontSize: 12)),
                                ],
                              ),
                            ),
                          ),
                        ),
                      ),
                    ],
                  )
                : Text(m.content,
                    style: const TextStyle(fontSize: 14, height: 1.5)),
          ),

          // Actions
          if (!m.isAccepted)
            Padding(
              padding: const EdgeInsets.fromLTRB(14, 0, 14, 14),
              child: Row(
                children: [
                  Expanded(
                    child: OutlinedButton(
                      onPressed: _delete,
                      style: OutlinedButton.styleFrom(
                          side: BorderSide(color: AppTheme.textHint)),
                      child: const Text('删除'),
                    ),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    flex: 2,
                    child: ElevatedButton(
                      onPressed: _accept,
                      child: const Text('接受私信'),
                    ),
                  ),
                ],
              ),
            ),

          // Expanded reply section
          if (m.isAccepted && _expanded) ...[
            const Divider(height: 1, color: Color(0xFF2A2A2A)),
            Padding(
              padding: const EdgeInsets.all(14),
              child: Row(
                children: [
                  Expanded(
                    child: TextField(
                      controller: _replyCtrl,
                      maxLength: 200,
                      decoration: const InputDecoration(
                        hintText: '回复...',
                        counterText: '',
                      ),
                    ),
                  ),
                  const SizedBox(width: 8),
                  _replying
                      ? const SizedBox(
                          width: 24,
                          height: 24,
                          child:
                              CircularProgressIndicator(strokeWidth: 2))
                      : IconButton(
                          onPressed: _sendReply,
                          icon: Icon(Icons.send_rounded,
                              color: AppTheme.primary),
                        ),
                ],
              ),
            ),
          ],
        ],
      ),
    );
  }

  String _timeAgo(DateTime dt) {
    final diff = DateTime.now().difference(dt);
    if (diff.inMinutes < 60) return '${diff.inMinutes}分钟前';
    if (diff.inHours < 24) return '${diff.inHours}小时前';
    return '${diff.inDays}天前';
  }
}

// ── Sent ──────────────────────────────────────────────────────────────────────

class _SentList extends StatelessWidget {
  final List<DirectMessage> messages;
  const _SentList({required this.messages});

  @override
  Widget build(BuildContext context) {
    if (messages.isEmpty) {
      return Center(
        child: Text('尚未发送任何私信',
            style: TextStyle(color: AppTheme.textSecondary)),
      );
    }
    return ListView.builder(
      itemCount: messages.length,
      itemBuilder: (_, i) {
        final m = messages[i];
        return Container(
          margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
          padding: const EdgeInsets.all(14),
          decoration: BoxDecoration(
            color: AppTheme.card,
            borderRadius: BorderRadius.circular(16),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  _DmAvatar(user: m.receiver),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(m.receiver.nickname,
                            style: const TextStyle(
                                fontWeight: FontWeight.w700, fontSize: 14)),
                        Text(
                          '${m.isAccepted ? "✓ 已接受" : "待接受"} · 花费 ${m.cost} 🪙',
                          style: TextStyle(
                              color: m.isAccepted
                                  ? const Color(0xFF4CAF50)
                                  : AppTheme.textHint,
                              fontSize: 11),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 10),
              Text(m.content,
                  style: const TextStyle(fontSize: 14, height: 1.5)),
            ],
          ),
        );
      },
    );
  }
}

// ── Avatar ────────────────────────────────────────────────────────────────────

class _DmAvatar extends StatelessWidget {
  final DmUser user;
  const _DmAvatar({required this.user});

  @override
  Widget build(BuildContext context) {
    return Container(
      width: 40,
      height: 40,
      decoration: const BoxDecoration(shape: BoxShape.circle),
      clipBehavior: Clip.antiAlias,
      child: user.avatarUrl != null
          ? CachedNetworkImage(imageUrl: user.avatarUrl!, fit: BoxFit.cover)
          : Container(
              color: AppTheme.card,
              child: const Icon(Icons.person_rounded,
                  color: Color(0xFF3A3A3A), size: 22),
            ),
    );
  }
}
