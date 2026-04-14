import 'dart:ui';

import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../config/theme.dart';
import '../../core/providers/private_photos_provider.dart';

/// Shows the private/locked photos section on another user's profile.
///
/// Handles the full state machine:
///   none     → "Request Unlock" button (shows coin cost)
///   pending  → "Waiting for approval…" chip
///   approved → clear photo grid
///   owner    → clear photo grid (own profile)
class PrivatePhotosSection extends ConsumerStatefulWidget {
  final String userId;
  final bool isOwnProfile;
  final int privatePhotoCount; // from UserModel, shown when locked

  const PrivatePhotosSection({
    super.key,
    required this.userId,
    this.isOwnProfile = false,
    this.privatePhotoCount = 0,
  });

  @override
  ConsumerState<PrivatePhotosSection> createState() =>
      _PrivatePhotosSectionState();
}

class _PrivatePhotosSectionState extends ConsumerState<PrivatePhotosSection> {
  bool _requesting = false;

  @override
  void initState() {
    super.initState();
    Future.microtask(() =>
        ref.read(privatePhotoAccessProvider.notifier).load(widget.userId));
  }

  @override
  Widget build(BuildContext context) {
    final accessMap = ref.watch(privatePhotoAccessProvider);
    final access = accessMap[widget.userId] ?? const PrivatePhotoAccess();

    if (access.isLoading) {
      return const Padding(
        padding: EdgeInsets.symmetric(vertical: 16),
        child: Center(child: CircularProgressIndicator(strokeWidth: 2)),
      );
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        // Header
        Row(
          children: [
            const Icon(Icons.lock_rounded,
                size: 16, color: Color(0xFFFFD700)),
            const SizedBox(width: 6),
            const Text(
              '私密照片',
              style: TextStyle(
                  fontSize: 15,
                  fontWeight: FontWeight.w700,
                  color: Colors.white),
            ),
            const Spacer(),
            if (access.status == 'approved' || access.status == 'owner')
              Container(
                padding:
                    const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                decoration: BoxDecoration(
                  color: AppTheme.online.withOpacity(0.15),
                  borderRadius: BorderRadius.circular(8),
                  border: Border.all(color: AppTheme.online, width: 1),
                ),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    const Icon(Icons.lock_open_rounded,
                        size: 12, color: AppTheme.online),
                    const SizedBox(width: 4),
                    Text(
                      '已解锁',
                      style:
                          const TextStyle(color: AppTheme.online, fontSize: 11),
                    ),
                  ],
                ),
              ),
          ],
        ),
        const SizedBox(height: 12),

        // Content based on status
        _buildContent(context, access),
      ],
    );
  }

  Widget _buildContent(BuildContext context, PrivatePhotoAccess access) {
    if (access.status == 'approved' || access.status == 'owner') {
      if (access.photos.isEmpty) {
        return _emptyText('暂无私密照片');
      }
      return _photoGrid(access.photos, blurred: false);
    }

    if (access.status == 'pending') {
      return _pendingBanner();
    }

    // none — show blurred placeholders + request button
    if (widget.privatePhotoCount == 0) {
      return _emptyText('没有私密照片');
    }

    return Column(
      children: [
        _lockedPlaceholderGrid(widget.privatePhotoCount),
        const SizedBox(height: 12),
        SizedBox(
          width: double.infinity,
          child: ElevatedButton.icon(
            onPressed: _requesting ? null : _sendRequest,
            icon: _requesting
                ? const SizedBox(
                    width: 14,
                    height: 14,
                    child: CircularProgressIndicator(
                        strokeWidth: 2, color: Colors.white),
                  )
                : const Icon(Icons.lock_open_rounded, size: 16),
            label: const Text('申请查看  · 10 coins'),
            style: ElevatedButton.styleFrom(
              backgroundColor: const Color(0xFF333333),
              foregroundColor: const Color(0xFFFFD700),
              side: const BorderSide(color: Color(0xFFFFD700), width: 1),
              padding: const EdgeInsets.symmetric(vertical: 12),
            ),
          ),
        ),
      ],
    );
  }

  Widget _photoGrid(List<String> photos, {required bool blurred}) {
    return GridView.builder(
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
        crossAxisCount: 3,
        crossAxisSpacing: 4,
        mainAxisSpacing: 4,
        childAspectRatio: 1,
      ),
      itemCount: photos.length,
      itemBuilder: (_, i) {
        return ClipRRect(
          borderRadius: BorderRadius.circular(8),
          child: Stack(
            fit: StackFit.expand,
            children: [
              CachedNetworkImage(
                imageUrl: photos[i],
                fit: BoxFit.cover,
                placeholder: (_, __) => Container(color: AppTheme.card),
                errorWidget: (_, __, ___) => Container(
                  color: AppTheme.card,
                  child: const Icon(Icons.image_rounded, color: Colors.white30),
                ),
              ),
              if (blurred)
                BackdropFilter(
                  filter: ImageFilter.blur(sigmaX: 18, sigmaY: 18),
                  child: Container(color: Colors.black26),
                ),
              if (blurred)
                const Center(
                  child: Icon(Icons.lock_rounded,
                      color: Color(0xFFFFD700), size: 28),
                ),
            ],
          ),
        );
      },
    );
  }

  Widget _lockedPlaceholderGrid(int count) {
    final displayCount = count.clamp(1, 6);
    return GridView.builder(
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
        crossAxisCount: 3,
        crossAxisSpacing: 4,
        mainAxisSpacing: 4,
        childAspectRatio: 1,
      ),
      itemCount: displayCount,
      itemBuilder: (_, __) {
        return ClipRRect(
          borderRadius: BorderRadius.circular(8),
          child: Container(
            color: const Color(0xFF2A2A2A),
            child: const Center(
              child: Icon(Icons.lock_rounded,
                  color: Color(0xFFFFD700), size: 28),
            ),
          ),
        );
      },
    );
  }

  Widget _pendingBanner() {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
      decoration: BoxDecoration(
        color: const Color(0xFF1A2A1A),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppTheme.online.withOpacity(0.4), width: 1),
      ),
      child: Row(
        children: [
          const SizedBox(
            width: 16,
            height: 16,
            child: CircularProgressIndicator(
                strokeWidth: 2, color: AppTheme.online),
          ),
          const SizedBox(width: 10),
          Text(
            '等待对方同意…',
            style:
                TextStyle(color: AppTheme.online, fontWeight: FontWeight.w600),
          ),
        ],
      ),
    );
  }

  Widget _emptyText(String msg) {
    return Text(msg,
        style: TextStyle(color: AppTheme.textHint, fontSize: 13));
  }

  Future<void> _sendRequest() async {
    setState(() => _requesting = true);
    final ok = await ref
        .read(privatePhotoAccessProvider.notifier)
        .request(widget.userId);
    if (mounted) {
      setState(() => _requesting = false);
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content:
              Text(ok ? '已发送申请' : '发送失败，请检查金币余额'),
          backgroundColor: ok ? AppTheme.surface : AppTheme.error,
        ),
      );
    }
  }
}

// ── Inbox widget — shown in settings / notifications ─────────────────────────

class PhotoRequestInbox extends ConsumerStatefulWidget {
  const PhotoRequestInbox({super.key});

  @override
  ConsumerState<PhotoRequestInbox> createState() => _PhotoRequestInboxState();
}

class _PhotoRequestInboxState extends ConsumerState<PhotoRequestInbox> {
  @override
  void initState() {
    super.initState();
    Future.microtask(
        () => ref.read(photoRequestsProvider.notifier).fetchInbox());
  }

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(photoRequestsProvider);

    if (state.isLoading) {
      return const Center(child: CircularProgressIndicator(strokeWidth: 2));
    }

    if (state.inbox.isEmpty) {
      return Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(Icons.inbox_rounded, size: 40, color: Color(0xFF3A3A3A)),
            const SizedBox(height: 12),
            Text('没有新的照片申请',
                style:
                    TextStyle(color: AppTheme.textHint, fontSize: 14)),
          ],
        ),
      );
    }

    return ListView.separated(
      padding: const EdgeInsets.all(16),
      itemCount: state.inbox.length,
      separatorBuilder: (_, __) => const SizedBox(height: 12),
      itemBuilder: (_, i) => _InboxCard(request: state.inbox[i]),
    );
  }
}

class _InboxCard extends ConsumerWidget {
  final PhotoRequest request;
  const _InboxCard({required this.request});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: AppTheme.card,
        borderRadius: BorderRadius.circular(14),
      ),
      child: Row(
        children: [
          // Avatar
          CircleAvatar(
            radius: 22,
            backgroundImage: request.requesterAvatarUrl != null
                ? CachedNetworkImageProvider(request.requesterAvatarUrl!)
                : null,
            backgroundColor: AppTheme.surface,
            child: request.requesterAvatarUrl == null
                ? const Icon(Icons.person_rounded, color: Colors.white54)
                : null,
          ),
          const SizedBox(width: 12),

          // Info
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  request.requesterNickname,
                  style: const TextStyle(
                      color: Colors.white,
                      fontWeight: FontWeight.w700,
                      fontSize: 14),
                ),
                const SizedBox(height: 2),
                Text(
                  '申请查看你的私密照片',
                  style:
                      TextStyle(color: AppTheme.textSecondary, fontSize: 12),
                ),
              ],
            ),
          ),

          // Approve / Reject
          Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              _ActionBtn(
                label: '同意',
                color: AppTheme.online,
                onTap: () => _respond(context, ref, 'approved'),
              ),
              const SizedBox(width: 8),
              _ActionBtn(
                label: '拒绝',
                color: AppTheme.error,
                onTap: () => _respond(context, ref, 'rejected'),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Future<void> _respond(
      BuildContext context, WidgetRef ref, String status) async {
    final ok =
        await ref.read(photoRequestsProvider.notifier).respond(request.id, status);
    if (context.mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(ok
              ? (status == 'approved' ? '已同意' : '已拒绝')
              : '操作失败'),
          backgroundColor: AppTheme.surface,
        ),
      );
    }
  }
}

class _ActionBtn extends StatelessWidget {
  final String label;
  final Color color;
  final VoidCallback onTap;
  const _ActionBtn(
      {required this.label, required this.color, required this.onTap});

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
        decoration: BoxDecoration(
          color: color.withOpacity(0.15),
          borderRadius: BorderRadius.circular(8),
          border: Border.all(color: color, width: 1),
        ),
        child: Text(label,
            style: TextStyle(
                color: color, fontSize: 12, fontWeight: FontWeight.w700)),
      ),
    );
  }
}
