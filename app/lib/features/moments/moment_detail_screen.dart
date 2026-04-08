import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../config/theme.dart';
import '../../core/api/moments_service.dart';
import '../../core/models/moment.dart';
import '../../core/providers/auth_provider.dart';
import '../../core/providers/moments_provider.dart';

class MomentDetailScreen extends ConsumerStatefulWidget {
  final Moment moment;
  const MomentDetailScreen({super.key, required this.moment});

  @override
  ConsumerState<MomentDetailScreen> createState() =>
      _MomentDetailScreenState();
}

class _MomentDetailScreenState extends ConsumerState<MomentDetailScreen> {
  final _commentC = TextEditingController();
  final _scrollC = ScrollController();
  late Moment _moment;
  List<MomentComment> _comments = [];
  bool _loadingComments = false;
  bool _postingComment = false;
  String? _replyToId;
  String? _replyToName;

  @override
  void initState() {
    super.initState();
    _moment = widget.moment;
    _comments = widget.moment.comments;
    if (_comments.isEmpty) _loadComments();
  }

  @override
  void dispose() {
    _commentC.dispose();
    _scrollC.dispose();
    super.dispose();
  }

  Future<void> _loadComments() async {
    setState(() => _loadingComments = true);
    try {
      final svc = MomentsService(ref.read(apiClientProvider));
      _comments = await svc.getComments(_moment.id);
    } catch (_) {}
    if (mounted) setState(() => _loadingComments = false);
  }

  Future<void> _postComment() async {
    final text = _commentC.text.trim();
    if (text.isEmpty) return;

    setState(() => _postingComment = true);
    try {
      final svc = MomentsService(ref.read(apiClientProvider));
      final comment = await svc.addComment(
        _moment.id,
        text,
        parentCommentId: _replyToId,
      );
      _comments.add(comment);
      _moment = _moment.copyWith(commentsCount: _moment.commentsCount + 1);
      ref
          .read(momentsProvider.notifier)
          .addCommentToMoment(_moment.id, comment);
      _commentC.clear();
      _replyToId = null;
      _replyToName = null;
      _scrollC.animateTo(
        _scrollC.position.maxScrollExtent + 80,
        duration: const Duration(milliseconds: 300),
        curve: Curves.easeOut,
      );
    } catch (_) {}
    if (mounted) setState(() => _postingComment = false);
  }

  void _toggleLike() {
    ref.read(momentsProvider.notifier).toggleLike(_moment.id);
    setState(() {
      _moment = _moment.copyWith(
        isLiked: !_moment.isLiked,
        likeCount:
            _moment.isLiked ? _moment.likeCount - 1 : _moment.likeCount + 1,
      );
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('动态详情')),
      body: Column(
        children: [
          Expanded(
            child: SingleChildScrollView(
              controller: _scrollC,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  // ── Post content ─────────────────────────────────────────
                  Padding(
                    padding: const EdgeInsets.all(16),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        // User row
                        Row(
                          children: [
                            _Avatar(user: _moment.user, size: 44),
                            const SizedBox(width: 12),
                            Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(_moment.user.nickname,
                                    style: const TextStyle(
                                        fontWeight: FontWeight.w700,
                                        fontSize: 15)),
                                Text(_timeAgo(_moment.createdAt),
                                    style: TextStyle(
                                        color: AppTheme.textHint,
                                        fontSize: 12)),
                              ],
                            ),
                          ],
                        ),
                        if (_moment.content.isNotEmpty) ...[
                          const SizedBox(height: 12),
                          Text(_moment.content,
                              style: const TextStyle(
                                  fontSize: 16, height: 1.6)),
                        ],
                        if (_moment.images.isNotEmpty) ...[
                          const SizedBox(height: 12),
                          _buildPhotoGrid(),
                        ],
                        const SizedBox(height: 12),
                        // Like/comment counts
                        Row(
                          children: [
                            GestureDetector(
                              onTap: _toggleLike,
                              child: Row(
                                children: [
                                  Icon(
                                    _moment.isLiked
                                        ? Icons.favorite_rounded
                                        : Icons.favorite_border_rounded,
                                    color: _moment.isLiked
                                        ? AppTheme.primary
                                        : AppTheme.textHint,
                                    size: 20,
                                  ),
                                  const SizedBox(width: 5),
                                  Text('${_moment.likeCount}',
                                      style: TextStyle(
                                          color: _moment.isLiked
                                              ? AppTheme.primary
                                              : AppTheme.textHint,
                                          fontSize: 14)),
                                ],
                              ),
                            ),
                            const SizedBox(width: 20),
                            Icon(Icons.chat_bubble_outline_rounded,
                                color: AppTheme.textHint, size: 18),
                            const SizedBox(width: 5),
                            Text('${_moment.commentsCount}',
                                style: TextStyle(
                                    color: AppTheme.textHint, fontSize: 14)),
                          ],
                        ),
                      ],
                    ),
                  ),

                  const Divider(height: 1, color: Color(0xFF1E1E1E), thickness: 6),

                  // ── Comments ─────────────────────────────────────────────
                  _loadingComments
                      ? const Padding(
                          padding: EdgeInsets.all(24),
                          child: Center(child: CircularProgressIndicator()),
                        )
                      : _comments.isEmpty
                          ? Padding(
                              padding: const EdgeInsets.all(24),
                              child: Center(
                                child: Text('暂无评论，快来第一个评论吧！',
                                    style: TextStyle(
                                        color: AppTheme.textHint,
                                        fontSize: 14)),
                              ),
                            )
                          : ListView.separated(
                              shrinkWrap: true,
                              physics: const NeverScrollableScrollPhysics(),
                              padding: const EdgeInsets.symmetric(
                                  horizontal: 16, vertical: 8),
                              itemCount: _comments.length,
                              separatorBuilder: (_, __) => const Divider(
                                  height: 1, color: Color(0xFF2A2A2A)),
                              itemBuilder: (_, i) =>
                                  _CommentTile(
                                    comment: _comments[i],
                                    onReply: (id, name) {
                                      setState(() {
                                        _replyToId = id;
                                        _replyToName = name;
                                      });
                                      FocusScope.of(context)
                                          .requestFocus(FocusNode());
                                    },
                                  ),
                            ),

                  const SizedBox(height: 80),
                ],
              ),
            ),
          ),

          // ── Comment input ────────────────────────────────────────────────
          Container(
            padding: EdgeInsets.fromLTRB(
                12, 8, 8, MediaQuery.of(context).padding.bottom + 8),
            decoration: BoxDecoration(
              color: AppTheme.surface,
              border: const Border(
                  top: BorderSide(color: Color(0xFF2A2A2A), width: 0.5)),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                if (_replyToName != null)
                  Padding(
                    padding: const EdgeInsets.only(bottom: 4),
                    child: Row(
                      children: [
                        Text('回复 $_replyToName',
                            style: TextStyle(
                                color: AppTheme.primary, fontSize: 12)),
                        const SizedBox(width: 8),
                        GestureDetector(
                          onTap: () => setState(() {
                            _replyToId = null;
                            _replyToName = null;
                          }),
                          child: Icon(Icons.close_rounded,
                              size: 14, color: AppTheme.textHint),
                        ),
                      ],
                    ),
                  ),
                Row(
                  children: [
                    Expanded(
                      child: Container(
                        decoration: BoxDecoration(
                          color: AppTheme.card,
                          borderRadius: BorderRadius.circular(22),
                        ),
                        child: TextField(
                          controller: _commentC,
                          style: const TextStyle(fontSize: 14),
                          decoration: InputDecoration(
                            hintText: '写评论...',
                            hintStyle:
                                TextStyle(color: AppTheme.textHint),
                            border: InputBorder.none,
                            contentPadding: const EdgeInsets.symmetric(
                                horizontal: 16, vertical: 10),
                          ),
                          textInputAction: TextInputAction.send,
                          onSubmitted: (_) => _postComment(),
                        ),
                      ),
                    ),
                    const SizedBox(width: 8),
                    GestureDetector(
                      onTap: _postingComment ? null : _postComment,
                      child: Container(
                        width: 40,
                        height: 40,
                        decoration: BoxDecoration(
                          gradient: AppTheme.brandGradient,
                          shape: BoxShape.circle,
                        ),
                        child: _postingComment
                            ? const Padding(
                                padding: EdgeInsets.all(10),
                                child: CircularProgressIndicator(
                                    strokeWidth: 2,
                                    color: Colors.white))
                            : const Icon(Icons.send_rounded,
                                color: Colors.white, size: 18),
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildPhotoGrid() {
    final imgs = _moment.images;
    if (imgs.length == 1) {
      return ClipRRect(
        borderRadius: BorderRadius.circular(10),
        child: AspectRatio(
          aspectRatio: 4 / 3,
          child: CachedNetworkImage(
              imageUrl: imgs[0], fit: BoxFit.cover),
        ),
      );
    }
    return GridView.builder(
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
          crossAxisCount: 3, mainAxisSpacing: 3, crossAxisSpacing: 3),
      itemCount: imgs.length.clamp(0, 9),
      itemBuilder: (_, i) => ClipRRect(
        borderRadius: BorderRadius.circular(4),
        child: CachedNetworkImage(imageUrl: imgs[i], fit: BoxFit.cover),
      ),
    );
  }

  String _timeAgo(DateTime dt) {
    final diff = DateTime.now().difference(dt);
    if (diff.inMinutes < 1) return '刚刚';
    if (diff.inMinutes < 60) return '${diff.inMinutes}分钟前';
    if (diff.inHours < 24) return '${diff.inHours}小时前';
    return '${dt.month}/${dt.day}';
  }
}

// ── Avatar ────────────────────────────────────────────────────────────────────

class _Avatar extends StatelessWidget {
  final MomentUser user;
  final double size;
  const _Avatar({required this.user, this.size = 36});

  @override
  Widget build(BuildContext context) => Container(
        width: size,
        height: size,
        decoration: const BoxDecoration(shape: BoxShape.circle),
        clipBehavior: Clip.antiAlias,
        child: user.avatarUrl != null
            ? CachedNetworkImage(
                imageUrl: user.avatarUrl!, fit: BoxFit.cover)
            : Container(
                color: AppTheme.card,
                child: const Icon(Icons.person_rounded,
                    color: Color(0xFF3A3A3A))),
      );
}

// ── Comment Tile ──────────────────────────────────────────────────────────────

class _CommentTile extends StatelessWidget {
  final MomentComment comment;
  final void Function(String id, String name) onReply;

  const _CommentTile({required this.comment, required this.onReply});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 10),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _Avatar(user: comment.user, size: 32),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(comment.user.nickname,
                    style: const TextStyle(
                        fontWeight: FontWeight.w600, fontSize: 13)),
                const SizedBox(height: 3),
                Text(comment.content,
                    style: const TextStyle(fontSize: 14, height: 1.4)),
                const SizedBox(height: 5),
                Row(
                  children: [
                    Text(
                      _timeAgo(comment.createdAt),
                      style: TextStyle(
                          color: AppTheme.textHint, fontSize: 11),
                    ),
                    const SizedBox(width: 16),
                    GestureDetector(
                      onTap: () =>
                          onReply(comment.id, comment.user.nickname),
                      child: Text('回复',
                          style: TextStyle(
                              color: AppTheme.textHint, fontSize: 11)),
                    ),
                  ],
                ),
              ],
            ),
          ),
          // Like
          Column(
            children: [
              Icon(
                comment.isLiked
                    ? Icons.favorite_rounded
                    : Icons.favorite_border_rounded,
                color: comment.isLiked ? AppTheme.primary : AppTheme.textHint,
                size: 16,
              ),
              if (comment.likeCount > 0)
                Text('${comment.likeCount}',
                    style:
                        TextStyle(color: AppTheme.textHint, fontSize: 10)),
            ],
          ),
        ],
      ),
    );
  }

  String _timeAgo(DateTime dt) {
    final diff = DateTime.now().difference(dt);
    if (diff.inMinutes < 1) return '刚刚';
    if (diff.inMinutes < 60) return '${diff.inMinutes}分钟前';
    if (diff.inHours < 24) return '${diff.inHours}小时前';
    return '${dt.month}/${dt.day}';
  }
}
