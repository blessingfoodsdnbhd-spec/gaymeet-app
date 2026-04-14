import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../config/theme.dart';
import '../../core/models/sticker.dart';
import '../../core/providers/stickers_provider.dart';

/// Bottom sheet sticker picker.
/// Call via showModalBottomSheet and await result (returns [Sticker] or null).
class StickerPicker extends ConsumerStatefulWidget {
  const StickerPicker({super.key});

  @override
  ConsumerState<StickerPicker> createState() => _StickerPickerState();
}

class _StickerPickerState extends ConsumerState<StickerPicker> {
  int _selectedPackIndex = 0;

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(stickersProvider);
    final owned = state.ownedPacks;

    return Container(
      height: 280,
      decoration: const BoxDecoration(
        color: AppTheme.surface,
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      child: Column(
        children: [
          // Drag handle
          Center(
            child: Container(
              width: 40,
              height: 4,
              margin: const EdgeInsets.only(top: 12, bottom: 8),
              decoration: BoxDecoration(
                color: AppTheme.textHint,
                borderRadius: BorderRadius.circular(2),
              ),
            ),
          ),

          if (owned.isEmpty) ...[
            Expanded(
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Text('还没有贴图包',
                      style:
                          TextStyle(color: AppTheme.textSecondary)),
                  const SizedBox(height: 12),
                  ElevatedButton(
                    onPressed: () {
                      Navigator.pop(context);
                      context.push('/stickers');
                    },
                    child: const Text('去商店获取'),
                  ),
                ],
              ),
            ),
          ] else ...[
            // Pack tabs
            SizedBox(
              height: 44,
              child: ListView.builder(
                scrollDirection: Axis.horizontal,
                padding: const EdgeInsets.symmetric(horizontal: 12),
                itemCount: owned.length + 1, // +1 for store button
                itemBuilder: (_, i) {
                  if (i == owned.length) {
                    // Store button
                    return GestureDetector(
                      onTap: () {
                        Navigator.pop(context);
                        context.push('/stickers');
                      },
                      child: Container(
                        width: 40,
                        height: 40,
                        margin: const EdgeInsets.only(right: 8),
                        decoration: BoxDecoration(
                          color: AppTheme.card,
                          borderRadius: BorderRadius.circular(10),
                        ),
                        child: Icon(Icons.add_rounded,
                            color: AppTheme.textHint, size: 20),
                      ),
                    );
                  }
                  final selected = i == _selectedPackIndex;
                  return GestureDetector(
                    onTap: () =>
                        setState(() => _selectedPackIndex = i),
                    child: AnimatedContainer(
                      duration: const Duration(milliseconds: 150),
                      width: 40,
                      height: 40,
                      margin: const EdgeInsets.only(right: 8),
                      decoration: BoxDecoration(
                        color: selected
                            ? AppTheme.primary.withValues(alpha: 0.2)
                            : AppTheme.card,
                        borderRadius: BorderRadius.circular(10),
                        border: selected
                            ? Border.all(
                                color: AppTheme.primary, width: 1.5)
                            : null,
                      ),
                      child: Center(
                        child: Text(owned[i].coverEmoji,
                            style:
                                const TextStyle(fontSize: 20)),
                      ),
                    ),
                  );
                },
              ),
            ),
            const SizedBox(height: 8),

            // Sticker grid
            Expanded(
              child: _selectedPackIndex < owned.length
                  ? _StickerGrid(
                      pack: owned[_selectedPackIndex],
                      onSelect: (sticker) =>
                          Navigator.of(context).pop(sticker),
                    )
                  : const SizedBox.shrink(),
            ),
          ],
        ],
      ),
    );
  }
}

class _StickerGrid extends StatelessWidget {
  final StickerPack pack;
  final ValueChanged<Sticker> onSelect;
  const _StickerGrid({required this.pack, required this.onSelect});

  @override
  Widget build(BuildContext context) {
    return GridView.builder(
      padding: const EdgeInsets.symmetric(horizontal: 12),
      gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
        crossAxisCount: 5,
        mainAxisSpacing: 8,
        crossAxisSpacing: 8,
      ),
      itemCount: pack.stickers.length,
      itemBuilder: (_, i) {
        final sticker = pack.stickers[i];
        return GestureDetector(
          onTap: () => onSelect(sticker),
          child: Container(
            decoration: BoxDecoration(
              color: AppTheme.card,
              borderRadius: BorderRadius.circular(10),
            ),
            child: Center(
              child: Text(sticker.emoji,
                  style: const TextStyle(fontSize: 28)),
            ),
          ),
        );
      },
    );
  }
}
