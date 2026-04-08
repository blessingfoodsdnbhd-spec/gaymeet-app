import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../config/theme.dart';
import '../../core/providers/dm_provider.dart';
import '../../core/providers/auth_provider.dart';
import '../../core/providers/gifts_provider.dart';

class SendDmSheet extends ConsumerStatefulWidget {
  final String receiverId;
  final String receiverName;

  const SendDmSheet({
    super.key,
    required this.receiverId,
    required this.receiverName,
  });

  @override
  ConsumerState<SendDmSheet> createState() => _SendDmSheetState();
}

class _SendDmSheetState extends ConsumerState<SendDmSheet> {
  final _ctrl = TextEditingController();
  bool _sending = false;

  @override
  void dispose() {
    _ctrl.dispose();
    super.dispose();
  }

  int get _cost {
    final user = ref.read(authStateProvider).user;
    return (user?.isPremium ?? false) ? 10 : 20;
  }

  int get _balance {
    return ref.read(giftsProvider).coinBalance;
  }

  Future<void> _send() async {
    final content = _ctrl.text.trim();
    if (content.isEmpty) return;

    if (_balance < _cost) {
      Navigator.of(context).pop();
      context.push('/coins');
      return;
    }

    setState(() => _sending = true);
    final ok = await ref.read(dmProvider.notifier).send(
          receiverId: widget.receiverId,
          content: content,
        );

    if (!mounted) return;
    if (ok) {
      Navigator.of(context).pop(true);
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('私信已发送给 ${widget.receiverName}'),
          backgroundColor: const Color(0xFF4CAF50),
        ),
      );
    } else {
      setState(() => _sending = false);
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('发送失败，请检查余额')),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final canAfford = _balance >= _cost;

    return Padding(
      padding: EdgeInsets.only(
          bottom: MediaQuery.of(context).viewInsets.bottom),
      child: Container(
        decoration: const BoxDecoration(
          color: AppTheme.surface,
          borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
        ),
        padding: EdgeInsets.fromLTRB(
            20, 16, 20, MediaQuery.of(context).padding.bottom + 20),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Center(
              child: Container(
                width: 40,
                height: 4,
                margin: const EdgeInsets.only(bottom: 16),
                decoration: BoxDecoration(
                    color: AppTheme.textHint,
                    borderRadius: BorderRadius.circular(2)),
              ),
            ),

            // Title
            Row(
              children: [
                const Text('发送私信',
                    style: TextStyle(
                        fontSize: 17, fontWeight: FontWeight.w700)),
                const Spacer(),
                // Coin cost badge
                Container(
                  padding: const EdgeInsets.symmetric(
                      horizontal: 10, vertical: 4),
                  decoration: BoxDecoration(
                    color: canAfford
                        ? AppTheme.primary.withOpacity(0.12)
                        : Colors.red.withOpacity(0.12),
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Text('🪙',
                          style: const TextStyle(fontSize: 13)),
                      const SizedBox(width: 3),
                      Text(
                        '$_cost 金币',
                        style: TextStyle(
                          fontSize: 12,
                          fontWeight: FontWeight.w700,
                          color: canAfford ? AppTheme.primary : Colors.red,
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),

            const SizedBox(height: 6),
            Text(
              '发送给 ${widget.receiverName}',
              style: TextStyle(color: AppTheme.textSecondary, fontSize: 13),
            ),

            // Balance info
            const SizedBox(height: 12),
            Row(
              children: [
                Icon(Icons.account_balance_wallet_rounded,
                    size: 14, color: AppTheme.textHint),
                const SizedBox(width: 4),
                Text(
                  '余额：$_balance 🪙',
                  style: TextStyle(
                      color: canAfford ? AppTheme.textSecondary : Colors.red,
                      fontSize: 12),
                ),
                if (!canAfford) ...[
                  const SizedBox(width: 8),
                  GestureDetector(
                    onTap: () {
                      Navigator.of(context).pop();
                      context.push('/coins');
                    },
                    child: Text(
                      '充值金币 →',
                      style: TextStyle(
                          color: AppTheme.primary,
                          fontSize: 12,
                          fontWeight: FontWeight.w600),
                    ),
                  ),
                ],
              ],
            ),

            const SizedBox(height: 16),

            // Input field
            TextField(
              controller: _ctrl,
              maxLength: 200,
              maxLines: 4,
              minLines: 3,
              decoration: const InputDecoration(
                hintText: '写下你想说的话...',
                counterText: '',
              ),
              onChanged: (_) => setState(() {}),
            ),

            const SizedBox(height: 6),
            Align(
              alignment: Alignment.centerRight,
              child: Text(
                '${_ctrl.text.length}/200',
                style:
                    TextStyle(color: AppTheme.textHint, fontSize: 11),
              ),
            ),

            const SizedBox(height: 16),

            SizedBox(
              width: double.infinity,
              child: ElevatedButton(
                onPressed: _sending || _ctrl.text.trim().isEmpty
                    ? null
                    : (!canAfford
                        ? () {
                            Navigator.of(context).pop();
                            context.push('/coins');
                          }
                        : _send),
                child: _sending
                    ? const SizedBox(
                        width: 18,
                        height: 18,
                        child:
                            CircularProgressIndicator(strokeWidth: 2))
                    : Text(canAfford
                        ? '发送 ($_cost 🪙)'
                        : '余额不足，去充值'),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
