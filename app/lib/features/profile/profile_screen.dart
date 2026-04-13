import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../config/theme.dart';
import '../../core/dummy/dummy_data.dart';
import '../../core/providers/auth_provider.dart';
import '../../core/providers/boost_provider.dart';
import '../../shared/widgets/design_system/rainbow_border.dart';
import '../../shared/widgets/looking_for_badge.dart';
import '../gifts/gift_sheet.dart';
import '../dm/send_dm_sheet.dart';
import 'looking_for_sheet.dart';

class ProfileScreen extends ConsumerWidget {
  const ProfileScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final user = kUseDummyData
        ? DummyData.currentUser
        : ref.watch(authStateProvider).user;
    final boost = ref.watch(boostProvider);

    if (user == null) return const Center(child: CircularProgressIndicator());

    return Scaffold(
      appBar: AppBar(
        title: const Text('Profile'),
        actions: [
          IconButton(
            icon: const Icon(Icons.settings_rounded, size: 22),
            onPressed: () => context.push('/settings'),
          ),
        ],
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(24),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // ── Photo strip ──────────────────────────────────────────────────
            if (user.photos.isNotEmpty) ...[
              _PhotoStrip(photos: user.photos),
              const SizedBox(height: 20),
            ] else ...[
              // Fallback avatar with rainbow border
              Center(
                child: RainbowBorder(
                  borderWidth: 3,
                  borderRadius: 60,
                  child: CircleAvatar(
                    radius: 52,
                    backgroundImage: user.avatarUrl != null
                        ? CachedNetworkImageProvider(user.avatarUrl!)
                        : null,
                    backgroundColor: AppColors.bgSurface,
                    child: user.avatarUrl == null
                        ? const Icon(Icons.person_rounded,
                            size: 48, color: AppColors.textHint)
                        : null,
                  ),
                ),
              ),
              const SizedBox(height: 16),
            ],

            // ── Name + premium + boost ───────────────────────────────────────
            Center(
              child: Column(
                children: [
                  // BOOSTED badge (only when boost is active)
                  if (boost.isBoostActive) ...[
                    Container(
                      padding: const EdgeInsets.symmetric(
                          horizontal: 14, vertical: 6),
                      decoration: BoxDecoration(
                        gradient: const LinearGradient(
                          colors: [Color(0xFFFFD740), Color(0xFFFF9800)],
                        ),
                        borderRadius: BorderRadius.circular(20),
                        boxShadow: [
                          BoxShadow(
                            color: AppTheme.boost.withOpacity(0.4),
                            blurRadius: 12,
                          ),
                        ],
                      ),
                      child: const Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Icon(Icons.bolt_rounded,
                              size: 14, color: Colors.black),
                          SizedBox(width: 4),
                          Text('BOOSTED 🔥',
                              style: TextStyle(
                                  fontSize: 12,
                                  fontWeight: FontWeight.w800,
                                  color: Colors.black)),
                        ],
                      ),
                    ),
                    const SizedBox(height: 8),
                  ],
                  Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Text(user.nickname,
                          style: const TextStyle(
                              fontSize: 24, fontWeight: FontWeight.w800)),
                      if (user.isVerified) ...[
                        const SizedBox(width: 6),
                        const Icon(Icons.verified_rounded,
                            size: 22, color: Color(0xFF1976D2)),
                      ],
                    ],
                  ),
                  if (user.lookingFor != null) ...[
                    const SizedBox(height: 8),
                    GestureDetector(
                      onTap: () => showModalBottomSheet(
                        context: context,
                        isScrollControlled: true,
                        backgroundColor: Colors.transparent,
                        builder: (_) =>
                            LookingForSheet(current: user.lookingFor),
                      ),
                      child: LookingForBadge(status: user.lookingFor!),
                    ),
                  ] else ...[
                    const SizedBox(height: 8),
                    GestureDetector(
                      onTap: () => showModalBottomSheet(
                        context: context,
                        isScrollControlled: true,
                        backgroundColor: Colors.transparent,
                        builder: (_) => const LookingForSheet(),
                      ),
                      child: Text('+ 设置正在找',
                          style: TextStyle(
                              color: AppTheme.primary,
                              fontSize: 12,
                              fontWeight: FontWeight.w600)),
                    ),
                  ],
                  if (user.isPremium) ...[
                    const SizedBox(height: 6),
                    Container(
                      padding: const EdgeInsets.symmetric(
                          horizontal: 12, vertical: 4),
                      decoration: BoxDecoration(
                        gradient: const LinearGradient(
                            colors: [Color(0xFFFFD700), Color(0xFFFFA726)]),
                        borderRadius: BorderRadius.circular(12),
                      ),
                      child: const Text('PREMIUM',
                          style: TextStyle(
                              fontSize: 10,
                              fontWeight: FontWeight.w800,
                              color: Colors.black)),
                    ),
                  ],
                ],
              ),
            ),

            const SizedBox(height: 24),

            // ── Bio ───────────────────────────────────────────────────────────
            if (user.bio != null && user.bio!.isNotEmpty)
              Container(
                width: double.infinity,
                padding: const EdgeInsets.all(18),
                decoration: BoxDecoration(
                  color: AppTheme.card,
                  borderRadius: BorderRadius.circular(16),
                ),
                child: Text(user.bio!,
                    style: const TextStyle(fontSize: 15, height: 1.5)),
              ),

            // ── Tags ──────────────────────────────────────────────────────────
            if (user.tags.isNotEmpty) ...[
              const SizedBox(height: 16),
              Wrap(
                spacing: 8,
                runSpacing: 8,
                children: user.tags.map((tag) {
                  return Container(
                    padding: const EdgeInsets.symmetric(
                        horizontal: 14, vertical: 8),
                    decoration: BoxDecoration(
                      color: AppTheme.primary.withOpacity(0.12),
                      borderRadius: BorderRadius.circular(20),
                    ),
                    child: Text(tag,
                        style: TextStyle(
                            fontSize: 13,
                            color: AppTheme.primary,
                            fontWeight: FontWeight.w500)),
                  );
                }).toList(),
              ),
            ],

            const SizedBox(height: 32),

            // ── Action buttons ────────────────────────────────────────────────
            Row(
              children: [
                // Send Gift
                Expanded(
                  child: OutlinedButton.icon(
                    onPressed: () => showModalBottomSheet(
                      context: context,
                      isScrollControlled: true,
                      backgroundColor: Colors.transparent,
                      builder: (_) => GiftSheet(
                        receiverId: user!.id,
                        receiverName: user!.nickname,
                      ),
                    ),
                    icon: const Text('🎁', style: TextStyle(fontSize: 16)),
                    label: const Text('送礼物'),
                  ),
                ),
                const SizedBox(width: 8),
                // Send DM
                Expanded(
                  child: OutlinedButton.icon(
                    onPressed: () => showModalBottomSheet(
                      context: context,
                      isScrollControlled: true,
                      backgroundColor: Colors.transparent,
                      builder: (_) => SendDmSheet(
                        receiverId: user!.id,
                        receiverName: user!.nickname,
                      ),
                    ),
                    icon: const Icon(Icons.mail_rounded, size: 16),
                    label: const Text('私信'),
                  ),
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: OutlinedButton.icon(
                    onPressed: () => context.push('/profile/edit'),
                    icon: const Icon(Icons.edit_rounded, size: 18),
                    label: const Text('编辑'),
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

/// Horizontally scrollable photo strip with a paged PageView for the primary
/// photo and thumbnails below (or a grid when more than 1 photo exists).
class _PhotoStrip extends StatefulWidget {
  final List<String> photos;
  const _PhotoStrip({required this.photos});

  @override
  State<_PhotoStrip> createState() => _PhotoStripState();
}

class _PhotoStripState extends State<_PhotoStrip> {
  late final PageController _pageController;
  int _current = 0;

  @override
  void initState() {
    super.initState();
    _pageController = PageController();
  }

  @override
  void dispose() {
    _pageController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final photos = widget.photos;

    return Column(
      children: [
        // Main photo with page swipe
        ClipRRect(
          borderRadius: BorderRadius.circular(20),
          child: AspectRatio(
            aspectRatio: 3 / 4,
            child: PageView.builder(
              controller: _pageController,
              itemCount: photos.length,
              onPageChanged: (i) => setState(() => _current = i),
              itemBuilder: (_, i) => CachedNetworkImage(
                imageUrl: photos[i],
                fit: BoxFit.cover,
                placeholder: (_, __) =>
                    Container(color: AppTheme.card),
                errorWidget: (_, __, ___) => Container(
                  color: AppTheme.card,
                  child: const Icon(Icons.person_rounded,
                      size: 80, color: Color(0xFF3A3A3A)),
                ),
              ),
            ),
          ),
        ),

        // Dot indicators (only when more than 1 photo)
        if (photos.length > 1) ...[
          const SizedBox(height: 10),
          Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: List.generate(photos.length, (i) {
              final active = i == _current;
              return AnimatedContainer(
                duration: const Duration(milliseconds: 200),
                margin: const EdgeInsets.symmetric(horizontal: 3),
                width: active ? 18 : 6,
                height: 6,
                decoration: BoxDecoration(
                  borderRadius: BorderRadius.circular(3),
                  color: active
                      ? AppTheme.primary
                      : AppTheme.primary.withOpacity(0.25),
                ),
              );
            }),
          ),
          const SizedBox(height: 10),
          // Thumbnail row
          SizedBox(
            height: 60,
            child: ListView.builder(
              scrollDirection: Axis.horizontal,
              itemCount: photos.length,
              itemBuilder: (_, i) {
                final selected = i == _current;
                return GestureDetector(
                  onTap: () {
                    _pageController.animateToPage(
                      i,
                      duration: const Duration(milliseconds: 250),
                      curve: Curves.easeInOut,
                    );
                  },
                  child: AnimatedContainer(
                    duration: const Duration(milliseconds: 200),
                    width: 60,
                    height: 60,
                    margin: const EdgeInsets.only(right: 8),
                    decoration: BoxDecoration(
                      borderRadius: BorderRadius.circular(10),
                      border: Border.all(
                        color: selected
                            ? AppTheme.primary
                            : Colors.transparent,
                        width: 2,
                      ),
                    ),
                    child: ClipRRect(
                      borderRadius: BorderRadius.circular(8),
                      child: CachedNetworkImage(
                        imageUrl: photos[i],
                        fit: BoxFit.cover,
                      ),
                    ),
                  ),
                );
              },
            ),
          ),
        ],
      ],
    );
  }
}
