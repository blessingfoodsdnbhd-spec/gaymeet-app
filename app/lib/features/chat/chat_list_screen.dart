import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:cached_network_image/cached_network_image.dart';
import 'package:go_router/go_router.dart';
import 'package:timeago/timeago.dart' as timeago;
import '../../config/theme.dart';
import '../../core/dummy/dummy_data.dart';
import '../../core/providers/conversations_provider.dart';
import '../../core/models/match.dart';

class ChatListScreen extends ConsumerWidget {
  const ChatListScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final matches = kUseDummyData
        ? DummyData.matches
        : ref.watch(conversationsProvider).valueOrNull ?? [];

    return Scaffold(
      appBar: AppBar(
        title: const Text('Messages'),
        actions: [
          IconButton(
            icon: const Icon(Icons.group_rounded),
            tooltip: '群组',
            onPressed: () => context.push('/groups'),
          ),
        ],
      ),
      body: matches.isEmpty
          ? Center(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Icon(Icons.chat_bubble_outline_rounded,
                      size: 56, color: AppTheme.textHint),
                  const SizedBox(height: 16),
                  Text('No conversations yet',
                      style: TextStyle(color: AppTheme.textSecondary)),
                ],
              ),
            )
          : ListView.separated(
              itemCount: matches.length,
              separatorBuilder: (_, __) => const Divider(indent: 76),
              itemBuilder: (_, i) => _ChatTile(match: matches[i]),
            ),
    );
  }
}

class _ChatTile extends StatelessWidget {
  final MatchModel match;
  const _ChatTile({required this.match});

  @override
  Widget build(BuildContext context) {
    return ListTile(
      contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
      leading: Stack(
        children: [
          CircleAvatar(
            radius: 28,
            backgroundImage: match.user.avatarUrl != null
                ? CachedNetworkImageProvider(match.user.avatarUrl!)
                : null,
            backgroundColor: AppTheme.card,
            child: match.user.avatarUrl == null
                ? const Icon(Icons.person_rounded)
                : null,
          ),
          if (match.user.isOnline)
            Positioned(
              bottom: 0,
              right: 0,
              child: Container(
                width: 14,
                height: 14,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  color: AppTheme.online,
                  border: Border.all(color: AppTheme.bg, width: 2),
                ),
              ),
            ),
        ],
      ),
      title: Text(match.user.nickname,
          style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 15)),
      subtitle: Text(
        match.lastMessage ?? 'Say hello! 👋',
        maxLines: 1,
        overflow: TextOverflow.ellipsis,
        style: TextStyle(
          color: match.unreadCount > 0
              ? AppTheme.textPrimary
              : AppTheme.textSecondary,
          fontSize: 13,
          fontWeight:
              match.unreadCount > 0 ? FontWeight.w500 : FontWeight.normal,
        ),
      ),
      trailing: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.end,
        children: [
          Text(
            timeago.format(match.lastMessageAt ?? match.matchedAt,
                locale: 'en_short'),
            style: TextStyle(color: AppTheme.textHint, fontSize: 11),
          ),
          if (match.unreadCount > 0) ...[
            const SizedBox(height: 4),
            Container(
              width: 20,
              height: 20,
              decoration: const BoxDecoration(
                shape: BoxShape.circle,
                gradient: AppTheme.brandGradient,
              ),
              child: Center(
                child: Text('${match.unreadCount}',
                    style: const TextStyle(fontSize: 10, color: Colors.white)),
              ),
            ),
          ],
        ],
      ),
      onTap: () => context.push('/chat/${match.matchId}', extra: {
        'userId': match.user.id,
        'userName': match.user.nickname,
        'userAvatar': match.user.avatarUrl,
      }),
    );
  }
}
