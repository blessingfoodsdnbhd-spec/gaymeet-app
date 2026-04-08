import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../config/theme.dart';
import '../../core/dummy/dummy_data.dart';
import '../../core/models/user.dart';

/// 呼唤 tab — shows users who are online or recently active,
/// sorted by lastActive (most recent first).
class CallingScreen extends ConsumerWidget {
  const CallingScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    // Sort dummy users by lastActive descending
    final users = [...DummyData.users]..sort((a, b) {
        final aTime = a.lastActive ?? DateTime(2000);
        final bTime = b.lastActive ?? DateTime(2000);
        return bTime.compareTo(aTime);
      });

    // Split into online now and recently active
    final online = users.where((u) => u.isOnline).toList();
    final offline = users.where((u) => !u.isOnline).toList();

    return ListView(
      padding: const EdgeInsets.only(top: 8, bottom: 24),
      children: [
        if (online.isNotEmpty) ...[
          _SectionHeader(
            label: '在线 (${online.length})',
            icon: Icons.circle,
            iconColor: AppTheme.online,
          ),
          ...online.map((u) => _CallingRow(user: u)),
          Divider(height: 1, thickness: 0.5, color: const Color(0xFF2A2A2A)),
        ],
        if (offline.isNotEmpty) ...[
          _SectionHeader(
            label: '最近活跃',
            icon: Icons.access_time_rounded,
            iconColor: AppTheme.textHint,
          ),
          ...offline.map((u) => _CallingRow(user: u)),
        ],
      ],
    );
  }
}

// ── Section header ────────────────────────────────────────────────────────────

class _SectionHeader extends StatelessWidget {
  final String label;
  final IconData icon;
  final Color iconColor;

  const _SectionHeader({
    required this.label,
    required this.icon,
    required this.iconColor,
  });

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 12, 16, 6),
      child: Row(
        children: [
          Icon(icon, size: 10, color: iconColor),
          const SizedBox(width: 6),
          Text(
            label,
            style: TextStyle(
              color: AppTheme.textSecondary,
              fontSize: 12,
              fontWeight: FontWeight.w600,
              letterSpacing: 0.3,
            ),
          ),
        ],
      ),
    );
  }
}

// ── Row widget ────────────────────────────────────────────────────────────────

class _CallingRow extends StatelessWidget {
  final UserModel user;
  const _CallingRow({required this.user});

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: () => context.push('/user/${user.id}', extra: user),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
        child: Row(
          children: [
            // Avatar
            Stack(
              children: [
                Container(
                  width: 62,
                  height: 62,
                  decoration: BoxDecoration(
                    borderRadius: BorderRadius.circular(10),
                    color: AppTheme.card,
                  ),
                  clipBehavior: Clip.antiAlias,
                  child: user.avatarUrl != null
                      ? CachedNetworkImage(
                          imageUrl: user.avatarUrl!,
                          fit: BoxFit.cover,
                          placeholder: (_, __) =>
                              Container(color: AppTheme.card),
                          errorWidget: (_, __, ___) => const Icon(
                              Icons.person_rounded,
                              size: 30,
                              color: Color(0xFF3A3A3A)),
                        )
                      : const Icon(Icons.person_rounded,
                          size: 30, color: Color(0xFF3A3A3A)),
                ),
                Positioned(
                  bottom: 2,
                  right: 2,
                  child: Container(
                    width: 11,
                    height: 11,
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      color: user.isOnline
                          ? AppTheme.online
                          : const Color(0xFF3A3A3A),
                      border: Border.all(color: AppTheme.bg, width: 2),
                    ),
                  ),
                ),
              ],
            ),
            const SizedBox(width: 14),

            // Info
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Flexible(
                        child: Text(
                          user.nickname,
                          style: const TextStyle(
                            color: Colors.white,
                            fontWeight: FontWeight.w700,
                            fontSize: 15,
                          ),
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                        ),
                      ),
                      if (user.countryCode != null) ...[
                        const SizedBox(width: 5),
                        Text(_flagEmoji(user.countryCode!),
                            style: const TextStyle(fontSize: 14)),
                      ],
                    ],
                  ),
                  if (user.lastActive != null) ...[
                    const SizedBox(height: 3),
                    Row(
                      children: [
                        Icon(
                          user.isOnline
                              ? Icons.circle
                              : Icons.access_time_rounded,
                          size: 11,
                          color: user.isOnline
                              ? AppTheme.online
                              : AppTheme.textHint,
                        ),
                        const SizedBox(width: 4),
                        Text(
                          user.isOnline ? '正在线上' : _timeAgo(user.lastActive!),
                          style: TextStyle(
                            color: user.isOnline
                                ? AppTheme.online
                                : AppTheme.textHint,
                            fontSize: 12,
                          ),
                        ),
                      ],
                    ),
                  ],
                  if (user.distanceLabel != null) ...[
                    const SizedBox(height: 2),
                    Row(
                      children: [
                        Icon(Icons.location_on_rounded,
                            size: 11, color: AppTheme.textHint),
                        const SizedBox(width: 2),
                        Text(
                          user.distanceLabel!,
                          style: TextStyle(
                              color: AppTheme.textHint, fontSize: 11),
                        ),
                      ],
                    ),
                  ],
                ],
              ),
            ),

            // Looking indicator
            if (user.isOnline)
              Container(
                padding:
                    const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                decoration: BoxDecoration(
                  color: AppTheme.online.withOpacity(0.12),
                  borderRadius: BorderRadius.circular(8),
                  border: Border.all(
                      color: AppTheme.online.withOpacity(0.3)),
                ),
                child: Text(
                  '在线',
                  style: TextStyle(
                    color: AppTheme.online,
                    fontSize: 11,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ),
          ],
        ),
      ),
    );
  }

  String _flagEmoji(String code) {
    if (code.length != 2) return '';
    final base = 0x1F1E6 - 0x41;
    return String.fromCharCode(base + code.codeUnitAt(0)) +
        String.fromCharCode(base + code.codeUnitAt(1));
  }

  String _timeAgo(DateTime dt) {
    final diff = DateTime.now().difference(dt);
    if (diff.inMinutes < 1) return '刚刚';
    if (diff.inMinutes < 60) return '${diff.inMinutes}分钟前';
    if (diff.inHours < 24) return '${diff.inHours}小时前';
    return '${diff.inDays}天前';
  }
}
