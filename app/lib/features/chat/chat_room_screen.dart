import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';

import '../../config/theme.dart';
import '../../core/api/block_report_service.dart';
import '../../core/dummy/dummy_data.dart';
import '../../core/models/message.dart';
import '../../core/providers/auth_provider.dart';
import '../../core/providers/chat_limit_provider.dart';
import '../../core/providers/chat_provider.dart';
import '../../core/providers/match_provider.dart';
import '../../core/providers/subscription_provider.dart';
import '../../core/providers/user_provider.dart';
import '../gifts/gift_sheet.dart';
import '../call/active_call_screen.dart';
import '../stickers/sticker_picker.dart';
import '../../core/providers/call_provider.dart';
import '../../core/models/sticker.dart';

// ── Report reason definitions ────────────────────────────────────────────────

/// (Display label, API slug)
const _reportReasons = [
  ('Inappropriate photos', 'inappropriate_photos'),
  ('Harassment', 'harassment'),
  ('Spam or scam', 'spam'),
  ('Fake profile', 'fake_profile'),
  ('Underage user', 'underage'),
  ('Other', 'other'),
];

// ── Screen ───────────────────────────────────────────────────────────────────

class ChatRoomScreen extends ConsumerStatefulWidget {
  final String matchId;
  final String otherUserId;
  final String otherUserName;
  final String? otherUserAvatar;

  const ChatRoomScreen({
    super.key,
    required this.matchId,
    required this.otherUserId,
    required this.otherUserName,
    this.otherUserAvatar,
  });

  @override
  ConsumerState<ChatRoomScreen> createState() => _ChatRoomScreenState();
}

class _ChatRoomScreenState extends ConsumerState<ChatRoomScreen> {
  final _msgC = TextEditingController();
  final _scrollC = ScrollController();
  late List<MessageModel> _messages;

  // Tracks whether a moderation action is in progress so we can show a
  // loading indicator and prevent double-taps.
  bool _actioning = false;

  // Boost banner dismissal state
  bool _boostBannerDismissed = false;

  @override
  void initState() {
    super.initState();
    if (kUseDummyData) {
      _messages = DummyData.messagesFor(widget.matchId);
    } else {
      Future.microtask(
          () => ref.read(chatProvider.notifier).openChat(widget.matchId));
    }
  }

  @override
  void dispose() {
    _msgC.dispose();
    _scrollC.dispose();
    if (!kUseDummyData) ref.read(chatProvider.notifier).closeChat();
    super.dispose();
  }

  // ── Messaging ─────────────────────────────────────────────────────────────

  void _send() {
    final text = _msgC.text.trim();
    if (text.isEmpty) return;

    if (!kUseDummyData) {
      // ── First-message gating for free users ──────────────────────────────
      final sub = ref.read(subscriptionProvider);
      if (!sub.isPremium) {
        final messages = ref.read(chatProvider).valueOrNull ?? [];
        final isFirstMessage = messages.isEmpty;
        if (isFirstMessage) {
          final limit = ref.read(chatLimitProvider);
          if (!limit.canStartNewConversation) {
            _showFirstMessageLimitSheet();
            return;
          }
          // Record before sending
          ref.read(chatLimitProvider.notifier).recordFirstMessage();
        }
      }
      ref.read(chatProvider.notifier).sendMessage(widget.matchId, text);
      _msgC.clear();
      return;
    }

    // Dummy mode
    setState(() {
      _messages.insert(
        0,
        MessageModel(
          id: DateTime.now().millisecondsSinceEpoch.toString(),
          matchId: widget.matchId,
          senderId: 'me',
          content: text,
          createdAt: DateTime.now(),
        ),
      );
    });
    _msgC.clear();
  }

  void _sendSticker(Sticker sticker) {
    if (!kUseDummyData) {
      ref.read(chatProvider.notifier).sendSticker(widget.matchId, sticker.emoji);
      return;
    }
    setState(() {
      _messages.insert(
        0,
        MessageModel(
          id: DateTime.now().millisecondsSinceEpoch.toString(),
          matchId: widget.matchId,
          senderId: 'me',
          content: sticker.emoji,
          type: 'sticker',
          createdAt: DateTime.now(),
        ),
      );
    });
  }

  void _showFirstMessageLimitSheet() {
    showModalBottomSheet(
      context: context,
      backgroundColor: AppTheme.surface,
      shape: const RoundedRectangleBorder(
          borderRadius: BorderRadius.vertical(top: Radius.circular(24))),
      builder: (ctx) => Padding(
        padding: const EdgeInsets.fromLTRB(24, 24, 24, 40),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: 48,
              height: 5,
              decoration: BoxDecoration(
                color: AppTheme.textHint,
                borderRadius: BorderRadius.circular(3),
              ),
            ),
            const SizedBox(height: 24),
            Container(
              width: 64,
              height: 64,
              decoration: BoxDecoration(
                color: AppTheme.card,
                borderRadius: BorderRadius.circular(18),
              ),
              child: const Icon(Icons.chat_bubble_outline_rounded,
                  color: AppTheme.primary, size: 30),
            ),
            const SizedBox(height: 16),
            const Text(
              "Upgrade to send unlimited messages",
              style: TextStyle(fontSize: 18, fontWeight: FontWeight.w700),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 8),
            Text(
              'You\'ve used all $kFreeFirstMessagesPerDay free conversation starts today.\nUpgrade to message everyone without limits.',
              style: TextStyle(color: AppTheme.textSecondary, height: 1.5),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 28),
            GestureDetector(
              onTap: () {
                Navigator.pop(ctx);
                context.push('/premium');
              },
              child: Container(
                width: double.infinity,
                height: 52,
                decoration: BoxDecoration(
                  gradient: AppTheme.brandGradient,
                  borderRadius: BorderRadius.circular(14),
                  boxShadow: [
                    BoxShadow(
                      color: AppTheme.primary.withOpacity(0.35),
                      blurRadius: 14,
                      offset: const Offset(0, 5),
                    )
                  ],
                ),
                child: const Center(
                  child: Text(
                    'Unlock Now 🔥',
                    style: TextStyle(
                      fontSize: 16,
                      fontWeight: FontWeight.w700,
                      color: Colors.white,
                    ),
                  ),
                ),
              ),
            ),
            const SizedBox(height: 12),
            TextButton(
              onPressed: () => Navigator.pop(ctx),
              child: Text('Maybe later',
                  style: TextStyle(color: AppTheme.textSecondary)),
            ),
          ],
        ),
      ),
    );
  }

  // ── Options menu ──────────────────────────────────────────────────────────

  void _showOptions() {
    showModalBottomSheet(
      context: context,
      backgroundColor: AppTheme.surface,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (sheetCtx) => SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: 36,
              height: 4,
              margin: const EdgeInsets.only(top: 12),
              decoration: BoxDecoration(
                color: AppTheme.textHint,
                borderRadius: BorderRadius.circular(2),
              ),
            ),
            ListTile(
              leading: Icon(Icons.block_rounded, color: AppTheme.error),
              title: Text('Block ${widget.otherUserName}',
                  style: TextStyle(color: AppTheme.error)),
              onTap: () {
                Navigator.pop(sheetCtx);
                _confirmBlock();
              },
            ),
            ListTile(
              leading: const Icon(Icons.flag_rounded, color: Colors.orange),
              title: const Text('Report User'),
              onTap: () {
                Navigator.pop(sheetCtx);
                _showReportSheet();
              },
            ),
            ListTile(
              leading: Icon(Icons.heart_broken_rounded,
                  color: AppTheme.textSecondary),
              title: const Text('Unmatch'),
              onTap: () {
                Navigator.pop(sheetCtx);
                _confirmUnmatch();
              },
            ),
            const SizedBox(height: 8),
          ],
        ),
      ),
    );
  }

  // ── Block ─────────────────────────────────────────────────────────────────

  Future<void> _confirmBlock() async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: AppTheme.surface,
        shape:
            RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        title: Text('Block ${widget.otherUserName}?'),
        content: Text(
          'They won\'t be able to see you or contact you, and your match will '
          'be removed.\n\nThis cannot be undone.',
          style: TextStyle(color: AppTheme.textSecondary, height: 1.5),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: const Text('Cancel'),
          ),
          TextButton(
            onPressed: () => Navigator.pop(ctx, true),
            child: Text('Block',
                style: TextStyle(
                    color: AppTheme.error, fontWeight: FontWeight.w700)),
          ),
        ],
      ),
    );

    if (confirmed != true || !mounted) return;

    setState(() => _actioning = true);
    try {
      // Block is the primary action — throw on failure so the user knows
      await ref
          .read(blockReportServiceProvider)
          .block(widget.otherUserId);

      // Remove the match server-side (fire & forget — block is what matters)
      ref
          .read(apiClientProvider)
          .dio
          .delete('/matches/${widget.matchId}')
          .catchError((_) {});

      // Optimistic local state updates — all three feeds
      ref
          .read(matchesProvider.notifier)
          .removeMatchByUserId(widget.otherUserId);
      ref
          .read(discoverUsersProvider.notifier)
          .removeUser(widget.otherUserId);
      ref
          .read(nearbyUsersProvider.notifier)
          .removeUser(widget.otherUserId);

      if (mounted) context.go('/chats');
    } catch (_) {
      if (mounted) {
        setState(() => _actioning = false);
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
              content: Text('Failed to block. Please try again.')),
        );
      }
    }
  }

  // ── Report ────────────────────────────────────────────────────────────────

  Future<void> _showReportSheet() async {
    final reason = await showModalBottomSheet<String>(
      context: context,
      backgroundColor: AppTheme.surface,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (ctx) => SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Handle
            Center(
              child: Container(
                width: 36,
                height: 4,
                margin: const EdgeInsets.only(top: 12, bottom: 16),
                decoration: BoxDecoration(
                  color: AppTheme.card,
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
            ),
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 20),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text('Report ${widget.otherUserName}',
                      style: const TextStyle(
                          fontSize: 18, fontWeight: FontWeight.w700)),
                  const SizedBox(height: 4),
                  Text(
                    'Why are you reporting this account?',
                    style: TextStyle(
                        color: AppTheme.textSecondary, fontSize: 14),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 8),
            // Reason list
            for (final (label, slug) in _reportReasons)
              ListTile(
                title: Text(label),
                trailing: Icon(Icons.chevron_right_rounded,
                    color: AppTheme.textHint, size: 20),
                onTap: () => Navigator.pop(ctx, slug),
              ),
            const SizedBox(height: 8),
          ],
        ),
      ),
    );

    if (reason == null || !mounted) return;

    setState(() => _actioning = true);
    try {
      await ref
          .read(blockReportServiceProvider)
          .report(widget.otherUserId, reason);
      if (mounted) {
        setState(() => _actioning = false);
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text(
                'Report submitted. Thank you for keeping the community safe.'),
          ),
        );
      }
    } catch (_) {
      if (mounted) {
        setState(() => _actioning = false);
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
              content:
                  Text('Failed to submit report. Please try again.')),
        );
      }
    }
  }

  // ── Unmatch ───────────────────────────────────────────────────────────────

  Future<void> _confirmUnmatch() async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: AppTheme.surface,
        shape:
            RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        title: const Text('Unmatch?'),
        content: Text(
          'You and ${widget.otherUserName} will be removed from each other\'s '
          'matches and this conversation will be deleted.',
          style: TextStyle(color: AppTheme.textSecondary, height: 1.5),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: const Text('Cancel'),
          ),
          TextButton(
            onPressed: () => Navigator.pop(ctx, true),
            child: const Text('Unmatch',
                style: TextStyle(fontWeight: FontWeight.w700)),
          ),
        ],
      ),
    );

    if (confirmed != true || !mounted) return;

    setState(() => _actioning = true);
    try {
      await ref.read(apiClientProvider).dio.delete('/matches/${widget.matchId}');
      ref
          .read(matchesProvider.notifier)
          .removeMatchByUserId(widget.otherUserId);
      if (mounted) context.go('/chats');
    } catch (_) {
      if (mounted) {
        setState(() => _actioning = false);
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
              content: Text('Failed to unmatch. Please try again.')),
        );
      }
    }
  }

  // ── Build ─────────────────────────────────────────────────────────────────

  @override
  Widget build(BuildContext context) {
    final messages = kUseDummyData
        ? _messages
        : ref.watch(chatProvider).valueOrNull ?? [];

    return Scaffold(
      appBar: AppBar(
        leadingWidth: 32,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_ios_rounded, size: 18),
          onPressed: () => Navigator.pop(context),
        ),
        title: Row(
          children: [
            Container(
              width: 34,
              height: 34,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                image: widget.otherUserAvatar != null
                    ? DecorationImage(
                        image: NetworkImage(widget.otherUserAvatar!),
                        fit: BoxFit.cover,
                      )
                    : null,
                color: AppTheme.card,
              ),
              child: widget.otherUserAvatar == null
                  ? const Icon(Icons.person_rounded, size: 18)
                  : null,
            ),
            const SizedBox(width: 10),
            Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(widget.otherUserName,
                    style: const TextStyle(
                        fontSize: 15, fontWeight: FontWeight.w600)),
                Row(
                  children: [
                    Container(
                      width: 6,
                      height: 6,
                      decoration: const BoxDecoration(
                        shape: BoxShape.circle,
                        color: AppTheme.online,
                      ),
                    ),
                    const SizedBox(width: 4),
                    Text('Online',
                        style: TextStyle(
                            fontSize: 11,
                            color: AppTheme.textSecondary)),
                  ],
                ),
              ],
            ),
          ],
        ),
        actions: [
          if (_actioning)
            const Padding(
              padding: EdgeInsets.symmetric(horizontal: 16),
              child: SizedBox(
                width: 18,
                height: 18,
                child: CircularProgressIndicator(strokeWidth: 2),
              ),
            )
          else ...[
            // Voice call
            IconButton(
              icon: const Icon(Icons.call_rounded, size: 20),
              onPressed: () {
                ref.read(callProvider.notifier).initiateCall(
                      widget.otherUserId,
                      widget.otherUserName,
                      widget.otherUserAvatar,
                      'voice',
                    );
                Navigator.of(context).push(MaterialPageRoute(
                    builder: (_) => const ActiveCallScreen()));
              },
            ),
            // Video call
            IconButton(
              icon: const Icon(Icons.videocam_rounded, size: 22),
              onPressed: () {
                ref.read(callProvider.notifier).initiateCall(
                      widget.otherUserId,
                      widget.otherUserName,
                      widget.otherUserAvatar,
                      'video',
                    );
                Navigator.of(context).push(MaterialPageRoute(
                    builder: (_) => const ActiveCallScreen()));
              },
            ),
            IconButton(
              icon: const Icon(Icons.more_vert_rounded, size: 20),
              onPressed: _showOptions,
            ),
          ],
        ],
      ),
      body: Column(
        children: [
          // ── Boost upsell banner ─────────────────────────────────────────
          Builder(builder: (context) {
            final sub = ref.watch(subscriptionProvider);
            final messages = kUseDummyData
                ? _messages
                : ref.watch(chatProvider).valueOrNull ?? [];
            final showBanner = !sub.isPremium &&
                !_boostBannerDismissed &&
                messages.length >= 3;
            if (!showBanner) return const SizedBox.shrink();
            return _BoostBanner(
              onUpgrade: () => context.push('/premium'),
              onDismiss: () => setState(() => _boostBannerDismissed = true),
            );
          }),

          Expanded(
            child: messages.isEmpty
                ? Center(
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Icon(Icons.chat_bubble_outline_rounded,
                            size: 48, color: AppTheme.textHint),
                        const SizedBox(height: 12),
                        Text('Say hello!',
                            style: TextStyle(
                                color: AppTheme.textSecondary,
                                fontSize: 16)),
                      ],
                    ),
                  )
                : ListView.builder(
                    controller: _scrollC,
                    reverse: true,
                    padding: const EdgeInsets.symmetric(
                        horizontal: 16, vertical: 12),
                    itemCount: messages.length,
                    itemBuilder: (_, i) {
                      final msg = messages[i];
                      final isMe = msg.senderId == 'me' ||
                          msg.senderId ==
                              ref.read(authStateProvider).user?.id;
                      final showDate = i == messages.length - 1 ||
                          messages[i + 1].createdAt.day !=
                              msg.createdAt.day;

                      return Column(
                        children: [
                          if (showDate)
                            Padding(
                              padding:
                                  const EdgeInsets.symmetric(vertical: 12),
                              child: Text(
                                _formatDate(msg.createdAt),
                                style: TextStyle(
                                    color: AppTheme.textHint,
                                    fontSize: 12),
                              ),
                            ),
                          _Bubble(message: msg, isMe: isMe),
                        ],
                      );
                    },
                  ),
          ),
          _buildInput(),
        ],
      ),
    );
  }

  Widget _buildInput() {
    return Container(
      padding: EdgeInsets.fromLTRB(
          12, 10, 8, MediaQuery.of(context).padding.bottom + 10),
      decoration: BoxDecoration(
        color: AppTheme.surface,
        border: Border(
          top: BorderSide(color: const Color(0xFF2A2A2A), width: 0.5),
        ),
      ),
      child: Row(
        children: [
          // Gift button
          GestureDetector(
            onTap: () => showModalBottomSheet(
              context: context,
              isScrollControlled: true,
              backgroundColor: Colors.transparent,
              builder: (_) => GiftSheet(
                receiverId: widget.otherUserId,
                receiverName: widget.otherUserName,
              ),
            ),
            child: Container(
              width: 36,
              height: 36,
              margin: const EdgeInsets.only(right: 4),
              decoration: BoxDecoration(
                color: AppTheme.card,
                borderRadius: BorderRadius.circular(18),
              ),
              child: const Center(
                child: Text('🎁', style: TextStyle(fontSize: 16)),
              ),
            ),
          ),
          // Sticker button
          GestureDetector(
            onTap: () async {
              final sticker = await showModalBottomSheet<Sticker>(
                context: context,
                backgroundColor: Colors.transparent,
                builder: (_) => const StickerPicker(),
              );
              if (sticker != null && mounted) {
                _sendSticker(sticker);
              }
            },
            child: Container(
              width: 36,
              height: 36,
              margin: const EdgeInsets.only(right: 4),
              decoration: BoxDecoration(
                color: AppTheme.card,
                borderRadius: BorderRadius.circular(18),
              ),
              child: const Center(
                child: Text('😀', style: TextStyle(fontSize: 16)),
              ),
            ),
          ),
          Expanded(
            child: Container(
              decoration: BoxDecoration(
                color: AppTheme.card,
                borderRadius: BorderRadius.circular(24),
              ),
              child: TextField(
                controller: _msgC,
                style: const TextStyle(fontSize: 15),
                decoration: InputDecoration(
                  hintText: 'Message...',
                  hintStyle: TextStyle(color: AppTheme.textHint),
                  border: InputBorder.none,
                  contentPadding: const EdgeInsets.symmetric(
                      horizontal: 18, vertical: 12),
                ),
                textInputAction: TextInputAction.send,
                onSubmitted: (_) => _send(),
              ),
            ),
          ),
          const SizedBox(width: 8),
          GestureDetector(
            onTap: _send,
            child: Container(
              width: 44,
              height: 44,
              decoration: BoxDecoration(
                gradient: AppTheme.brandGradient,
                borderRadius: BorderRadius.circular(22),
              ),
              child: const Icon(Icons.send_rounded,
                  color: Colors.white, size: 20),
            ),
          ),
        ],
      ),
    );
  }

  String _formatDate(DateTime dt) {
    final now = DateTime.now();
    if (dt.day == now.day && dt.month == now.month) return 'Today';
    if (dt.day == now.day - 1) return 'Yesterday';
    return DateFormat.MMMd().format(dt);
  }
}

// ── Boost upsell banner ───────────────────────────────────────────────────────

class _BoostBanner extends StatelessWidget {
  final VoidCallback onUpgrade;
  final VoidCallback onDismiss;

  const _BoostBanner({required this.onUpgrade, required this.onDismiss});

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.fromLTRB(12, 8, 12, 0),
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
      decoration: BoxDecoration(
        gradient: LinearGradient(
          colors: [
            AppTheme.primary.withOpacity(0.12),
            AppTheme.accent.withOpacity(0.1),
          ],
        ),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(
            color: AppTheme.primary.withOpacity(0.25), width: 1),
      ),
      child: Row(
        children: [
          const Text('🚀', style: TextStyle(fontSize: 18)),
          const SizedBox(width: 10),
          Expanded(
            child: GestureDetector(
              onTap: onUpgrade,
              child: Text(
                'Boost your profile to get more matches',
                style: TextStyle(
                  fontSize: 12,
                  color: AppTheme.textSecondary,
                  height: 1.3,
                ),
              ),
            ),
          ),
          const SizedBox(width: 8),
          GestureDetector(
            onTap: onUpgrade,
            child: Container(
              padding:
                  const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
              decoration: BoxDecoration(
                gradient: AppTheme.brandGradient,
                borderRadius: BorderRadius.circular(8),
              ),
              child: const Text('Boost',
                  style: TextStyle(
                      fontSize: 12,
                      fontWeight: FontWeight.w700,
                      color: Colors.white)),
            ),
          ),
          const SizedBox(width: 6),
          GestureDetector(
            onTap: onDismiss,
            child: Icon(Icons.close_rounded,
                size: 16, color: AppTheme.textHint),
          ),
        ],
      ),
    );
  }
}

// ── Message bubble ────────────────────────────────────────────────────────────

class _Bubble extends StatelessWidget {
  final MessageModel message;
  final bool isMe;

  const _Bubble({required this.message, required this.isMe});

  @override
  Widget build(BuildContext context) {
    // Sticker: render as large emoji with no bubble
    if (message.isSticker) {
      return Padding(
        padding: const EdgeInsets.only(bottom: 6),
        child: Row(
          mainAxisAlignment:
              isMe ? MainAxisAlignment.end : MainAxisAlignment.start,
          children: [
            Column(
              crossAxisAlignment:
                  isMe ? CrossAxisAlignment.end : CrossAxisAlignment.start,
              children: [
                Text(message.content, style: const TextStyle(fontSize: 52)),
                Text(
                  DateFormat.Hm().format(message.createdAt),
                  style:
                      TextStyle(fontSize: 10, color: AppTheme.textHint),
                ),
              ],
            ),
          ],
        ),
      );
    }

    return Padding(
      padding: const EdgeInsets.only(bottom: 6),
      child: Row(
        mainAxisAlignment:
            isMe ? MainAxisAlignment.end : MainAxisAlignment.start,
        children: [
          Container(
            constraints: BoxConstraints(
              maxWidth: MediaQuery.of(context).size.width * 0.72,
            ),
            padding:
                const EdgeInsets.symmetric(horizontal: 16, vertical: 11),
            decoration: BoxDecoration(
              gradient: isMe ? AppTheme.brandGradient : null,
              color: isMe ? null : AppTheme.card,
              borderRadius: BorderRadius.only(
                topLeft: const Radius.circular(18),
                topRight: const Radius.circular(18),
                bottomLeft: Radius.circular(isMe ? 18 : 4),
                bottomRight: Radius.circular(isMe ? 4 : 18),
              ),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.end,
              children: [
                Text(
                  message.content,
                  style: const TextStyle(
                    fontSize: 15,
                    color: Colors.white,
                    height: 1.35,
                  ),
                ),
                const SizedBox(height: 3),
                Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text(
                      DateFormat.Hm().format(message.createdAt),
                      style: TextStyle(
                        fontSize: 10,
                        color: isMe
                            ? Colors.white.withOpacity(0.6)
                            : AppTheme.textHint,
                      ),
                    ),
                    if (isMe) ...[
                      const SizedBox(width: 3),
                      Icon(
                        message.isRead
                            ? Icons.done_all_rounded
                            : Icons.done_rounded,
                        size: 13,
                        color: message.isRead
                            ? const Color(0xFF64FFDA)
                            : Colors.white.withOpacity(0.5),
                      ),
                    ],
                  ],
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
