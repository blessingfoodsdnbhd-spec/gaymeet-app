import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../config/theme.dart';
import '../../core/models/group_chat.dart';
import '../../core/providers/groups_provider.dart';

class GroupsScreen extends ConsumerStatefulWidget {
  const GroupsScreen({super.key});

  @override
  ConsumerState<GroupsScreen> createState() => _GroupsScreenState();
}

class _GroupsScreenState extends ConsumerState<GroupsScreen>
    with SingleTickerProviderStateMixin {
  late TabController _tabCtrl;

  @override
  void initState() {
    super.initState();
    _tabCtrl = TabController(length: 2, vsync: this);
  }

  @override
  void dispose() {
    _tabCtrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(groupsProvider);

    return Scaffold(
      appBar: AppBar(
        title: const Text('群组'),
        bottom: TabBar(
          controller: _tabCtrl,
          indicatorColor: AppTheme.primary,
          labelColor: AppTheme.primary,
          unselectedLabelColor: AppTheme.textSecondary,
          tabs: const [Tab(text: '发现'), Tab(text: '我的群组')],
        ),
      ),
      floatingActionButton: FloatingActionButton(
        onPressed: () => context.push('/groups/create'),
        backgroundColor: AppTheme.primary,
        child: const Icon(Icons.add_rounded, color: Colors.white),
      ),
      body: state.isLoading && state.discoverGroups.isEmpty
          ? const Center(child: CircularProgressIndicator())
          : TabBarView(
              controller: _tabCtrl,
              children: [
                _GroupList(
                  groups: state.discoverGroups,
                  emptyMessage: '暂无公开群组',
                  showJoin: true,
                ),
                _GroupList(
                  groups: state.myGroups,
                  emptyMessage: '还没有加入任何群组',
                  showJoin: false,
                ),
              ],
            ),
    );
  }
}

// ── Group list ────────────────────────────────────────────────────────────────

class _GroupList extends ConsumerWidget {
  final List<GroupChat> groups;
  final String emptyMessage;
  final bool showJoin;

  const _GroupList({
    required this.groups,
    required this.emptyMessage,
    required this.showJoin,
  });

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    if (groups.isEmpty) {
      return Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(Icons.group_rounded, size: 52, color: AppTheme.textHint),
            const SizedBox(height: 12),
            Text(emptyMessage,
                style: TextStyle(color: AppTheme.textSecondary, fontSize: 15)),
          ],
        ),
      );
    }

    return RefreshIndicator(
      color: AppTheme.primary,
      onRefresh: () => ref.read(groupsProvider.notifier).fetch(),
      child: ListView.separated(
        padding: const EdgeInsets.symmetric(vertical: 8),
        itemCount: groups.length,
        separatorBuilder: (_, __) => const Divider(height: 1, indent: 16),
        itemBuilder: (_, i) => _GroupTile(
          group: groups[i],
          showJoin: showJoin,
        ),
      ),
    );
  }
}

// ── Group tile ────────────────────────────────────────────────────────────────

class _GroupTile extends ConsumerWidget {
  final GroupChat group;
  final bool showJoin;

  const _GroupTile({required this.group, required this.showJoin});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return ListTile(
      contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
      leading: _GroupAvatar(avatar: group.avatar, name: group.name),
      title: Row(
        children: [
          Expanded(
            child: Text(
              group.name,
              style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 15),
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
            ),
          ),
          if (!group.isPublic)
            const Padding(
              padding: EdgeInsets.only(left: 4),
              child: Icon(Icons.lock_rounded, size: 14, color: Colors.white38),
            ),
        ],
      ),
      subtitle: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          if (group.description.isNotEmpty)
            Text(
              group.description,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: TextStyle(color: AppTheme.textSecondary, fontSize: 12),
            ),
          const SizedBox(height: 2),
          Text(
            '${group.memberCount} 成员',
            style: TextStyle(color: AppTheme.textHint, fontSize: 11),
          ),
        ],
      ),
      trailing: showJoin && !group.isMember
          ? _JoinButton(groupId: group.id)
          : const Icon(Icons.chevron_right_rounded, color: Colors.white38),
      onTap: () => context.push('/groups/${group.id}', extra: group),
    );
  }
}

class _GroupAvatar extends StatelessWidget {
  final String? avatar;
  final String name;

  const _GroupAvatar({this.avatar, required this.name});

  @override
  Widget build(BuildContext context) {
    if (avatar != null) {
      return CircleAvatar(
        radius: 26,
        backgroundImage: NetworkImage(avatar!),
        backgroundColor: AppTheme.card,
      );
    }
    return CircleAvatar(
      radius: 26,
      backgroundColor: AppTheme.primary.withOpacity(0.2),
      child: Text(
        name.isNotEmpty ? name[0].toUpperCase() : '?',
        style: TextStyle(
          color: AppTheme.primary,
          fontWeight: FontWeight.w700,
          fontSize: 18,
        ),
      ),
    );
  }
}

class _JoinButton extends ConsumerStatefulWidget {
  final String groupId;
  const _JoinButton({required this.groupId});

  @override
  ConsumerState<_JoinButton> createState() => _JoinButtonState();
}

class _JoinButtonState extends ConsumerState<_JoinButton> {
  bool _loading = false;

  @override
  Widget build(BuildContext context) {
    return _loading
        ? const SizedBox(
            width: 24,
            height: 24,
            child: CircularProgressIndicator(strokeWidth: 2),
          )
        : TextButton(
            onPressed: _join,
            style: TextButton.styleFrom(
              foregroundColor: AppTheme.primary,
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
              side: BorderSide(color: AppTheme.primary, width: 1),
              shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(8)),
            ),
            child: const Text('加入', style: TextStyle(fontSize: 13)),
          );
  }

  Future<void> _join() async {
    setState(() => _loading = true);
    final ok = await ref.read(groupsProvider.notifier).joinGroup(widget.groupId);
    if (mounted) {
      setState(() => _loading = false);
      if (!ok) {
        ScaffoldMessenger.of(context)
            .showSnackBar(const SnackBar(content: Text('加入失败，请重试')));
      }
    }
  }
}
