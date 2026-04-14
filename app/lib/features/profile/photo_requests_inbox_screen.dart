import 'package:flutter/material.dart';
import '../../config/theme.dart';
import 'private_photos_section.dart';

class PhotoRequestsInboxScreen extends StatelessWidget {
  const PhotoRequestsInboxScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(Icons.lock_rounded, color: Color(0xFFFFD700), size: 18),
            const SizedBox(width: 8),
            const Text('私密照片申请'),
          ],
        ),
      ),
      body: const PhotoRequestInbox(),
    );
  }
}
