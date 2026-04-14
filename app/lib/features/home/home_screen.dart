import 'dart:async';
import 'dart:ui';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../config/theme.dart';
import '../../core/api/socket_service.dart';
import '../../core/l10n/app_strings.dart';
import '../../core/providers/locale_provider.dart';
import '../../core/providers/call_provider.dart';
import '../call/incoming_call_screen.dart';
import '../discover/fullscreen_discover_screen.dart';
import '../location/location_hub_screen.dart';
import '../matches/matches_screen.dart';
import '../chat/chat_list_screen.dart';
import '../moments/moments_feed_screen.dart';
import '../saw_you/saw_you_screen.dart';
import '../profile/profile_screen.dart';
import '../places/places_screen.dart';

class HomeScreen extends ConsumerStatefulWidget {
  const HomeScreen({super.key});

  @override
  ConsumerState<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends ConsumerState<HomeScreen> {
  int _tab = 0;
  StreamSubscription? _incomingCallSub;

  @override
  void initState() {
    super.initState();
    // Listen for incoming calls globally
    WidgetsBinding.instance.addPostFrameCallback((_) {
      final socket = ref.read(socketServiceProvider);
      _incomingCallSub = socket.onIncomingCall.listen((_) {
        if (mounted) {
          Navigator.of(context).push(MaterialPageRoute(
            fullscreenDialog: true,
            builder: (_) => const IncomingCallScreen(),
          ));
        }
      });
    });
  }

  @override
  void dispose() {
    _incomingCallSub?.cancel();
    super.dispose();
  }

  static const _screens = [
    FullscreenDiscoverScreen(),
    LocationHubScreen(),
    MatchesScreen(),
    ChatListScreen(),
    MomentsFeedScreen(),
    PlacesScreen(),
    SawYouScreen(),
    ProfileScreen(),
  ];

  @override
  Widget build(BuildContext context) {
    final locale = ref.watch(localeProvider);

    // On the fullscreen discover tab (index 0) the nav is fully transparent
    // so the photo bleeds underneath. On all other tabs it's a frosted-glass
    // panel that sits on top of opaque content. extendBody: true lets the
    // Scaffold body paint behind the nav bar area on all tabs.
    final isFullscreen = _tab == 0;

    return Scaffold(
      extendBody: true,
      body: IndexedStack(index: _tab, children: _screens),
      bottomNavigationBar: ClipRect(
        child: BackdropFilter(
          filter: ImageFilter.blur(sigmaX: 20, sigmaY: 20),
          child: Container(
            decoration: BoxDecoration(
              color: isFullscreen
                  ? Colors.black.withOpacity(0.45)
                  : AppColors.bgCard.withOpacity(0.92),
              border: Border(
                top: BorderSide(
                    color: isFullscreen
                        ? Colors.white.withOpacity(0.10)
                        : AppColors.pink500.withOpacity(0.15),
                    width: 0.5),
              ),
            ),
        child: BottomNavigationBar(
          currentIndex: _tab,
          onTap: (i) => setState(() => _tab = i),
          backgroundColor: Colors.transparent,
          elevation: 0,
          selectedItemColor: isFullscreen ? Colors.white : AppTheme.primary,
          unselectedItemColor: isFullscreen
              ? Colors.white.withOpacity(0.5)
              : AppTheme.textHint,
          items: [
            BottomNavigationBarItem(
              icon: const Icon(Icons.local_fire_department_rounded),
              label: 'discover'.tr(locale),
            ),
            BottomNavigationBarItem(
              icon: const Icon(Icons.explore_rounded),
              label: 'location'.tr(locale),
            ),
            BottomNavigationBarItem(
              icon: const Icon(Icons.favorite_rounded),
              label: 'matches'.tr(locale),
            ),
            BottomNavigationBarItem(
              icon: Stack(
                clipBehavior: Clip.none,
                children: [
                  const Icon(Icons.chat_bubble_rounded),
                  Positioned(
                    right: -4,
                    top: -4,
                    child: Container(
                      width: 8,
                      height: 8,
                      decoration: const BoxDecoration(
                        shape: BoxShape.circle,
                        color: AppTheme.primary,
                      ),
                    ),
                  ),
                ],
              ),
              label: 'chat'.tr(locale),
            ),
            BottomNavigationBarItem(
              icon: const Icon(Icons.photo_library_rounded),
              label: 'moments'.tr(locale),
            ),
            BottomNavigationBarItem(
              icon: const Icon(Icons.storefront_rounded),
              label: '找店',
            ),
            BottomNavigationBarItem(
              icon: const Icon(Icons.remove_red_eye_rounded),
              label: 'sawYou'.tr(locale),
            ),
            BottomNavigationBarItem(
              icon: const Icon(Icons.person_rounded),
              label: 'profile'.tr(locale),
            ),
          ],
        ),
          ),
        ),
      ),
    );
  }
}
