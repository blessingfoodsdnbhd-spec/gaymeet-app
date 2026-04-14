import 'dart:ui' as ui;

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';

import '../../config/theme.dart';
import '../../core/api/saw_you_service.dart';
import '../../core/providers/saw_you_provider.dart';
import '../../core/providers/subscription_provider.dart';

// ── Report reasons ────────────────────────────────────────────────────────────

const _reportReasons = [
  ('Inappropriate content', 'inappropriate'),
  ('Harassment', 'harassment'),
  ('Spam', 'spam'),
  ('Fake / Scam', 'fake'),
  ('Other', 'other'),
];

// ── Screen ────────────────────────────────────────────────────────────────────

class PlateInboxScreen extends ConsumerWidget {
  const PlateInboxScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final state = ref.watch(sawYouInboxProvider);
    final isPremium = ref.watch(subscriptionProvider).isPremium;

    return Scaffold(
      backgroundColor: const Color(0xFF0D0D1A),
      appBar: AppBar(
        backgroundColor: const Color(0xFF0D0D1A),
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text('Plate Inbox',
                style: TextStyle(fontWeight: FontWeight.w800, fontSize: 18)),
            if (state.inbox?.plateNumber != null)
              Text(
                state.inbox!.plateNumber!,
                style: const TextStyle(
                  color: Color(0xFFBB86FC),
                  fontSize: 12,
                  fontWeight: FontWeight.w700,
                  letterSpacing: 2,
                ),
              ),
          ],
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh_rounded),
            onPressed: () => ref.read(sawYouInboxProvider.notifier).fetch(),
          ),
          IconButton(
            icon: const Icon(Icons.directions_car_rounded),
            onPressed: () => context.push('/saw-you/claim'),
            tooltip: 'Manage plate',
          ),
        ],
      ),
      body: RefreshIndicator(
        color: AppTheme.primary,
        onRefresh: () => ref.read(sawYouInboxProvider.notifier).fetch(),
        child: _buildBody(context, ref, state, isPremium),
      ),
    );
  }

  Widget _buildBody(
    BuildContext context,
    WidgetRef ref,
    SawYouInboxState state,
    bool isPremium,
  ) {
    if (state.isLoading && state.inbox == null) {
      return const Center(child: CircularProgressIndicator());
    }

    final inbox = state.inbox;

    if (inbox == null || inbox.plateNumber == null) {
      return _NoPlateClaimed(onClaim: () => context.push('/saw-you/claim'));
    }

    if (inbox.messages.isEmpty) {
      return _EmptyInbox(plateNumber: inbox.plateNumber!);
    }

    return ListView.builder(
      padding: const EdgeInsets.only(top: 8, bottom: 24),
      itemCount: inbox.messages.length,
      itemBuilder: (_, i) => _MessageCard(
        message: inbox.messages[i],
        isPremium: isPremium,
        onReport: (reason) =>
            ref.read(sawYouInboxProvider.notifier).reportMessage(
                  inbox.messages[i].id,
                  reason,
                ),
        onBlock: () => ref
            .read(sawYouInboxProvider.notifier)
            .blockSender(inbox.messages[i].id),
        onUpgrade: () => context.push('/premium'),
      ),
    );
  }
}

// ── Message card ──────────────────────────────────────────────────────────────

class _MessageCard extends StatelessWidget {
  final PlateMessage message;
  final bool isPremium;
  final ValueChanged<String> onReport;
  final VoidCallback onBlock;
  final VoidCallback onUpgrade;

  const _MessageCard({
    required this.message,
    required this.isPremium,
    required this.onReport,
    required this.onBlock,
    required this.onUpgrade,
  });

  void _showMenu(BuildContext context) {
    showModalBottomSheet(
      context: context,
      backgroundColor: AppTheme.card,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (_) => _MessageMenu(
        onReport: () {
          Navigator.pop(context);
          _showReportSheet(context);
        },
        onBlock: () {
          Navigator.pop(context);
          onBlock();
        },
      ),
    );
  }

  void _showReportSheet(BuildContext context) {
    showModalBottomSheet(
      context: context,
      backgroundColor: AppTheme.card,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (_) => _ReportSheet(onReport: onReport),
    );
  }

  @override
  Widget build(BuildContext context) {
    final isBlurred = !message.isFullContent && !isPremium;
    final fmt = DateFormat('MMM d, h:mm a');

    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 14, vertical: 6),
      decoration: BoxDecoration(
        color: message.isRead
            ? const Color(0xFF12121F)
            : const Color(0xFF1E1A35),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(
          color: message.isRead
              ? const Color(0xFF2A2A4A)
              : const Color(0xFF7B2FBE).withOpacity(0.5),
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Header
          Padding(
            padding:
                const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
            child: Row(
              children: [
                Container(
                  width: 36,
                  height: 36,
                  decoration: BoxDecoration(
                    gradient: const LinearGradient(
                      colors: [Color(0xFF7B2FBE), Color(0xFF4A0080)],
                    ),
                    shape: BoxShape.circle,
                  ),
                  child: const Center(
                    child: Text('🕵️',
                        style: TextStyle(fontSize: 18)),
                  ),
                ),
                const SizedBox(width: 10),
                Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Anonymous',
                      style: TextStyle(
                        color: const Color(0xFFBB86FC),
                        fontWeight: FontWeight.w700,
                        fontSize: 13,
                      ),
                    ),
                    Text(
                      fmt.format(message.createdAt.toLocal()),
                      style: TextStyle(
                          color: AppTheme.textHint, fontSize: 11),
                    ),
                  ],
                ),
                const Spacer(),
                if (!message.isRead)
                  Container(
                    width: 8,
                    height: 8,
                    margin: const EdgeInsets.only(right: 10),
                    decoration: const BoxDecoration(
                      shape: BoxShape.circle,
                      color: Color(0xFFBB86FC),
                    ),
                  ),
                if (!message.isReported)
                  GestureDetector(
                    onTap: () => _showMenu(context),
                    child: Icon(Icons.more_vert_rounded,
                        color: AppTheme.textHint, size: 20),
                  ),
              ],
            ),
          ),

          // Message content (blurred if not premium and truncated)
          Padding(
            padding:
                const EdgeInsets.only(left: 16, right: 16, bottom: 14),
            child: isBlurred
                ? Stack(
                    children: [
                      ClipRRect(
                        borderRadius: BorderRadius.circular(8),
                        child: BackdropFilter(
                          filter: ui.ImageFilter.blur(sigmaX: 6, sigmaY: 6),
                          child: Container(
                            width: double.infinity,
                            padding: const EdgeInsets.all(12),
                            color: const Color(0xFF1A1A2E),
                            child: Text(
                              message.content,
                              style: TextStyle(
                                  color: AppTheme.textPrimary,
                                  fontSize: 15,
                                  height: 1.5),
                            ),
                          ),
                        ),
                      ),
                      Positioned.fill(
                        child: GestureDetector(
                          onTap: onUpgrade,
                          child: Container(
                            decoration: BoxDecoration(
                              color: Colors.black.withOpacity(0.3),
                              borderRadius: BorderRadius.circular(8),
                            ),
                            child: Column(
                              mainAxisAlignment: MainAxisAlignment.center,
                              children: [
                                const Icon(Icons.lock_rounded,
                                    color: Colors.white, size: 22),
                                const SizedBox(height: 4),
                                Text(
                                  'Unlock with Premium',
                                  style: TextStyle(
                                    color: Colors.white,
                                    fontWeight: FontWeight.w700,
                                    fontSize: 13,
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ),
                      ),
                    ],
                  )
                : Container(
                    width: double.infinity,
                    padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(
                      color: const Color(0xFF1A1A2E),
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: Text(
                      message.content,
                      style: TextStyle(
                          color: AppTheme.textPrimary,
                          fontSize: 15,
                          height: 1.5),
                    ),
                  ),
          ),

          // Reported badge
          if (message.isReported)
            Padding(
              padding: const EdgeInsets.only(left: 16, right: 16, bottom: 12),
              child: Row(
                children: [
                  Icon(Icons.flag_rounded,
                      color: AppTheme.error, size: 14),
                  const SizedBox(width: 5),
                  Text('Reported',
                      style:
                          TextStyle(color: AppTheme.error, fontSize: 12)),
                ],
              ),
            ),
        ],
      ),
    );
  }
}

// ── Menus and sheets ──────────────────────────────────────────────────────────

class _MessageMenu extends StatelessWidget {
  final VoidCallback onReport;
  final VoidCallback onBlock;
  const _MessageMenu({required this.onReport, required this.onBlock});

  @override
  Widget build(BuildContext context) {
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        const SizedBox(height: 8),
        Container(
          width: 40, height: 4,
          decoration: BoxDecoration(
            color: AppTheme.textHint,
            borderRadius: BorderRadius.circular(2),
          ),
        ),
        ListTile(
          leading: Icon(Icons.flag_rounded, color: AppTheme.error),
          title: Text('Report',
              style: TextStyle(color: AppTheme.textPrimary)),
          onTap: onReport,
        ),
        ListTile(
          leading: Icon(Icons.block_rounded, color: AppTheme.error),
          title: Text('Block sender',
              style: TextStyle(color: AppTheme.textPrimary)),
          subtitle: Text('Hide all messages from this person',
              style: TextStyle(color: AppTheme.textHint, fontSize: 12)),
          onTap: onBlock,
        ),
        const SizedBox(height: 8),
      ],
    );
  }
}

class _ReportSheet extends StatefulWidget {
  final ValueChanged<String> onReport;
  const _ReportSheet({required this.onReport});

  @override
  State<_ReportSheet> createState() => _ReportSheetState();
}

class _ReportSheetState extends State<_ReportSheet> {
  String? _selected;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.all(20),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Center(
            child: Container(
              width: 40, height: 4,
              decoration: BoxDecoration(
                color: AppTheme.textHint,
                borderRadius: BorderRadius.circular(2),
              ),
            ),
          ),
          const SizedBox(height: 16),
          Text('Report reason',
              style: TextStyle(
                  color: AppTheme.textPrimary,
                  fontSize: 17,
                  fontWeight: FontWeight.w700)),
          const SizedBox(height: 12),
          ..._reportReasons.map((r) => RadioListTile<String>(
                value: r.$2,
                groupValue: _selected,
                onChanged: (v) => setState(() => _selected = v),
                title: Text(r.$1,
                    style: TextStyle(color: AppTheme.textPrimary)),
                activeColor: AppTheme.primary,
                dense: true,
              )),
          const SizedBox(height: 12),
          SizedBox(
            width: double.infinity,
            child: ElevatedButton(
              onPressed: _selected == null
                  ? null
                  : () {
                      Navigator.pop(context);
                      widget.onReport(_selected!);
                    },
              child: const Text('Submit Report'),
            ),
          ),
          const SizedBox(height: 8),
        ],
      ),
    );
  }
}

// ── Empty states ──────────────────────────────────────────────────────────────

class _EmptyInbox extends StatelessWidget {
  final String plateNumber;
  const _EmptyInbox({required this.plateNumber});

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Text('👀', style: TextStyle(fontSize: 56)),
            const SizedBox(height: 16),
            Text(
              'No messages yet',
              style: TextStyle(
                  color: AppTheme.textPrimary,
                  fontSize: 20,
                  fontWeight: FontWeight.w800),
            ),
            const SizedBox(height: 8),
            Text(
              'Share your plate number ($plateNumber) to let people send you anonymous messages.',
              textAlign: TextAlign.center,
              style: TextStyle(
                  color: AppTheme.textSecondary, fontSize: 13, height: 1.5),
            ),
          ],
        ),
      ),
    );
  }
}

class _NoPlateClaimed extends StatelessWidget {
  final VoidCallback onClaim;
  const _NoPlateClaimed({required this.onClaim});

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Text('🚗', style: TextStyle(fontSize: 56)),
            const SizedBox(height: 16),
            Text(
              "You haven't claimed a plate",
              style: TextStyle(
                  color: AppTheme.textPrimary,
                  fontSize: 20,
                  fontWeight: FontWeight.w800),
            ),
            const SizedBox(height: 8),
            Text(
              'Claim your license plate to receive anonymous messages from people who saw you.',
              textAlign: TextAlign.center,
              style: TextStyle(
                  color: AppTheme.textSecondary, fontSize: 13, height: 1.5),
            ),
            const SizedBox(height: 24),
            ElevatedButton.icon(
              onPressed: onClaim,
              icon: const Icon(Icons.directions_car_rounded, size: 18),
              label: const Text('Claim My Plate'),
            ),
          ],
        ),
      ),
    );
  }
}
