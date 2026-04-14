import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';

import '../../config/theme.dart';
import '../../core/models/event.dart';
import '../../core/providers/events_provider.dart';

class EventsScreen extends ConsumerWidget {
  const EventsScreen({super.key});

  static const _categories = [
    ('all', '全部'),
    ('makan', '聚餐'),
    ('party', '派对'),
    ('sports', '运动'),
    ('hangout', '闲逛'),
    ('other', '其他'),
  ];

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final state = ref.watch(eventsProvider);

    return Scaffold(
      appBar: AppBar(
        title: const Text('活动'),
        actions: [
          IconButton(
            icon: const Icon(Icons.calendar_month_rounded, size: 24),
            tooltip: 'Calendar view',
            onPressed: () => context.push('/events/calendar'),
          ),
          IconButton(
            icon: const Icon(Icons.add_rounded, size: 24),
            onPressed: () => context.push('/events/create'),
          ),
        ],
      ),
      body: Column(
        children: [
          // ── Category chips ───────────────────────────────────────────────
          SizedBox(
            height: 44,
            child: ListView.separated(
              scrollDirection: Axis.horizontal,
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
              itemCount: _categories.length,
              separatorBuilder: (_, __) => const SizedBox(width: 8),
              itemBuilder: (_, i) {
                final cat = _categories[i];
                final selected = state.selectedCategory == cat.$1;
                return GestureDetector(
                  onTap: () => ref
                      .read(eventsProvider.notifier)
                      .fetchEvents(category: cat.$1),
                  child: AnimatedContainer(
                    duration: const Duration(milliseconds: 150),
                    padding: const EdgeInsets.symmetric(
                        horizontal: 14, vertical: 4),
                    decoration: BoxDecoration(
                      color: selected
                          ? AppTheme.primary
                          : AppTheme.card,
                      borderRadius: BorderRadius.circular(20),
                    ),
                    child: Text(
                      cat.$2,
                      style: TextStyle(
                        color: selected
                            ? Colors.white
                            : AppTheme.textSecondary,
                        fontWeight: selected
                            ? FontWeight.w700
                            : FontWeight.normal,
                        fontSize: 13,
                      ),
                    ),
                  ),
                );
              },
            ),
          ),

          // ── Event list ───────────────────────────────────────────────────
          Expanded(
            child: state.isLoading
                ? const Center(child: CircularProgressIndicator())
                : state.events.isEmpty
                    ? _buildEmpty(context)
                    : RefreshIndicator(
                        color: AppTheme.primary,
                        onRefresh: () => ref
                            .read(eventsProvider.notifier)
                            .fetchEvents(),
                        child: ListView.builder(
                          padding: const EdgeInsets.fromLTRB(16, 8, 16, 16),
                          itemCount: state.events.length,
                          itemBuilder: (_, i) =>
                              _EventCard(event: state.events[i]),
                        ),
                      ),
          ),
        ],
      ),
    );
  }

  Widget _buildEmpty(BuildContext context) => Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Text('🎉', style: TextStyle(fontSize: 52)),
            const SizedBox(height: 12),
            const Text('暂无活动',
                style: TextStyle(fontSize: 16, fontWeight: FontWeight.w600)),
            const SizedBox(height: 6),
            Text('成为第一个创建活动的人！',
                style: TextStyle(
                    color: AppTheme.textSecondary, fontSize: 13)),
            const SizedBox(height: 16),
            ElevatedButton.icon(
              onPressed: () => context.push('/events/create'),
              icon: const Icon(Icons.add_rounded, size: 18),
              label: const Text('创建活动'),
            ),
          ],
        ),
      );
}

// ── Event Card ────────────────────────────────────────────────────────────────

class _EventCard extends StatelessWidget {
  final AppEvent event;
  const _EventCard({required this.event});

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: () => context.push('/events/${event.id}', extra: event),
      child: Container(
        margin: const EdgeInsets.only(bottom: 16),
        decoration: BoxDecoration(
          color: AppTheme.card,
          borderRadius: BorderRadius.circular(16),
        ),
        clipBehavior: Clip.antiAlias,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // ── Cover image / gradient header ────────────────────────────
            Stack(
              children: [
                Container(
                  height: 140,
                  decoration: BoxDecoration(
                    gradient: event.coverImage != null
                        ? null
                        : _categoryGradient(event.category),
                    image: event.coverImage != null
                        ? DecorationImage(
                            image: NetworkImage(event.coverImage!),
                            fit: BoxFit.cover,
                          )
                        : null,
                  ),
                  child: event.coverImage == null
                      ? Center(
                          child: Text(
                            _categoryEmoji(event.category),
                            style: const TextStyle(fontSize: 48),
                          ),
                        )
                      : Container(
                          decoration: const BoxDecoration(
                            gradient: LinearGradient(
                              begin: Alignment.topCenter,
                              end: Alignment.bottomCenter,
                              colors: [Colors.transparent, Colors.black54],
                            ),
                          ),
                        ),
                ),
                // Price badge
                Positioned(
                  top: 10,
                  right: 10,
                  child: Container(
                    padding: const EdgeInsets.symmetric(
                        horizontal: 10, vertical: 4),
                    decoration: BoxDecoration(
                      color: event.isFree
                          ? const Color(0xFF4CAF50)
                          : AppTheme.primary,
                      borderRadius: BorderRadius.circular(20),
                    ),
                    child: Text(
                      event.isFree
                          ? '免费'
                          : 'RM ${event.price.toStringAsFixed(0)}',
                      style: const TextStyle(
                          color: Colors.white,
                          fontSize: 11,
                          fontWeight: FontWeight.w700),
                    ),
                  ),
                ),
                // Category chip
                Positioned(
                  top: 10,
                  left: 10,
                  child: Container(
                    padding: const EdgeInsets.symmetric(
                        horizontal: 8, vertical: 3),
                    decoration: BoxDecoration(
                      color: Colors.black54,
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: Text(
                      _categoryLabel(event.category),
                      style: const TextStyle(
                          color: Colors.white, fontSize: 10),
                    ),
                  ),
                ),
              ],
            ),

            // ── Content ──────────────────────────────────────────────────
            Padding(
              padding: const EdgeInsets.all(14),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    event.title,
                    style: const TextStyle(
                        fontSize: 15, fontWeight: FontWeight.w700),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                  const SizedBox(height: 6),
                  Row(
                    children: [
                      Icon(Icons.calendar_today_rounded,
                          size: 13, color: AppTheme.primary),
                      const SizedBox(width: 5),
                      Text(
                        DateFormat('M月d日 HH:mm').format(event.date),
                        style: TextStyle(
                            color: AppTheme.primary,
                            fontSize: 12,
                            fontWeight: FontWeight.w600),
                      ),
                    ],
                  ),
                  const SizedBox(height: 4),
                  Row(
                    children: [
                      Icon(Icons.location_on_rounded,
                          size: 13, color: AppTheme.textHint),
                      const SizedBox(width: 4),
                      Expanded(
                        child: Text(
                          event.venue.isEmpty ? event.address : event.venue,
                          style: TextStyle(
                              color: AppTheme.textSecondary, fontSize: 12),
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 10),
                  Row(
                    children: [
                      Icon(Icons.people_rounded,
                          size: 13, color: AppTheme.textHint),
                      const SizedBox(width: 4),
                      Text(
                        '${event.currentAttendees}/${event.maxAttendees} 人参加',
                        style: TextStyle(
                            color: AppTheme.textHint, fontSize: 12),
                      ),
                      const Spacer(),
                      if (event.isAttending)
                        Container(
                          padding: const EdgeInsets.symmetric(
                              horizontal: 8, vertical: 3),
                          decoration: BoxDecoration(
                            color: const Color(0xFF4CAF50).withValues(alpha: 0.15),
                            borderRadius: BorderRadius.circular(8),
                          ),
                          child: const Text('已参加',
                              style: TextStyle(
                                  color: Color(0xFF4CAF50), fontSize: 11)),
                        ),
                      if (event.isFull && !event.isAttending)
                        Container(
                          padding: const EdgeInsets.symmetric(
                              horizontal: 8, vertical: 3),
                          decoration: BoxDecoration(
                            color: AppTheme.textHint.withValues(alpha: 0.12),
                            borderRadius: BorderRadius.circular(8),
                          ),
                          child: Text('已满',
                              style: TextStyle(
                                  color: AppTheme.textHint, fontSize: 11)),
                        ),
                    ],
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  LinearGradient _categoryGradient(String cat) {
    switch (cat) {
      case 'makan':
        return const LinearGradient(
            colors: [Color(0xFF8B1A1A), Color(0xFFD4380D)]);
      case 'party':
        return const LinearGradient(
            colors: [Color(0xFF4A0E82), Color(0xFFAD4ECC)]);
      case 'sports':
        return const LinearGradient(
            colors: [Color(0xFF004D8C), Color(0xFF0095FF)]);
      default:
        return AppTheme.brandGradient;
    }
  }

  String _categoryEmoji(String cat) {
    switch (cat) {
      case 'makan': return '🍜';
      case 'party': return '🎉';
      case 'sports': return '💪';
      case 'hangout': return '☕';
      default: return '📅';
    }
  }

  String _categoryLabel(String cat) {
    switch (cat) {
      case 'makan': return '聚餐';
      case 'party': return '派对';
      case 'sports': return '运动';
      case 'hangout': return '闲逛';
      default: return '活动';
    }
  }
}
