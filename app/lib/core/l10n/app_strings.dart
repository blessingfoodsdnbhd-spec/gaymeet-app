import '../providers/locale_provider.dart';

/// Simple map-based localization. No code-gen needed.
class AppStrings {
  static const Map<String, Map<AppLocale, String>> _s = {
    // Navigation
    'discover': {AppLocale.zh: '发现', AppLocale.en: 'Discover', AppLocale.ms: 'Temui'},
    'nearby': {AppLocale.zh: '附近', AppLocale.en: 'Nearby', AppLocale.ms: 'Berdekatan'},
    'matches': {AppLocale.zh: '配对', AppLocale.en: 'Matches', AppLocale.ms: 'Padanan'},
    'chat': {AppLocale.zh: '聊天', AppLocale.en: 'Chat', AppLocale.ms: 'Sembang'},
    'moments': {AppLocale.zh: '动态', AppLocale.en: 'Moments', AppLocale.ms: 'Momen'},
    'sawYou': {AppLocale.zh: 'Saw You', AppLocale.en: 'Saw You', AppLocale.ms: 'Saw You'},
    'profile': {AppLocale.zh: '个人', AppLocale.en: 'Profile', AppLocale.ms: 'Profil'},
    'location': {AppLocale.zh: '位置', AppLocale.en: 'Location', AppLocale.ms: 'Lokasi'},

    // Auth
    'login': {AppLocale.zh: '登录', AppLocale.en: 'Login', AppLocale.ms: 'Log Masuk'},
    'register': {AppLocale.zh: '注册', AppLocale.en: 'Register', AppLocale.ms: 'Daftar'},
    'logout': {AppLocale.zh: '退出登录', AppLocale.en: 'Log Out', AppLocale.ms: 'Log Keluar'},
    'email': {AppLocale.zh: '邮箱', AppLocale.en: 'Email', AppLocale.ms: 'E-mel'},
    'password': {AppLocale.zh: '密码', AppLocale.en: 'Password', AppLocale.ms: 'Kata Laluan'},

    // Actions
    'send': {AppLocale.zh: '发送', AppLocale.en: 'Send', AppLocale.ms: 'Hantar'},
    'cancel': {AppLocale.zh: '取消', AppLocale.en: 'Cancel', AppLocale.ms: 'Batal'},
    'confirm': {AppLocale.zh: '确认', AppLocale.en: 'Confirm', AppLocale.ms: 'Sahkan'},
    'save': {AppLocale.zh: '保存', AppLocale.en: 'Save', AppLocale.ms: 'Simpan'},
    'search': {AppLocale.zh: '搜索', AppLocale.en: 'Search', AppLocale.ms: 'Cari'},
    'back': {AppLocale.zh: '返回', AppLocale.en: 'Back', AppLocale.ms: 'Kembali'},
    'done': {AppLocale.zh: '完成', AppLocale.en: 'Done', AppLocale.ms: 'Selesai'},
    'edit': {AppLocale.zh: '编辑', AppLocale.en: 'Edit', AppLocale.ms: 'Edit'},
    'delete': {AppLocale.zh: '删除', AppLocale.en: 'Delete', AppLocale.ms: 'Padam'},
    'share': {AppLocale.zh: '分享', AppLocale.en: 'Share', AppLocale.ms: 'Kongsi'},
    'retry': {AppLocale.zh: '重试', AppLocale.en: 'Retry', AppLocale.ms: 'Cuba Lagi'},

    // Social
    'like': {AppLocale.zh: '喜欢', AppLocale.en: 'Like', AppLocale.ms: 'Suka'},
    'block': {AppLocale.zh: '屏蔽', AppLocale.en: 'Block', AppLocale.ms: 'Sekat'},
    'report': {AppLocale.zh: '举报', AppLocale.en: 'Report', AppLocale.ms: 'Lapor'},
    'unmatch': {AppLocale.zh: '取消配对', AppLocale.en: 'Unmatch', AppLocale.ms: 'Nyahpadanan'},
    'follow': {AppLocale.zh: '关注', AppLocale.en: 'Follow', AppLocale.ms: 'Ikut'},
    'message': {AppLocale.zh: '发消息', AppLocale.en: 'Message', AppLocale.ms: 'Mesej'},
    'sendGift': {AppLocale.zh: '送礼物', AppLocale.en: 'Send Gift', AppLocale.ms: 'Hantar Hadiah'},

    // Premium
    'upgrade': {AppLocale.zh: '升级', AppLocale.en: 'Upgrade', AppLocale.ms: 'Naik Taraf'},
    'premium': {AppLocale.zh: 'Premium', AppLocale.en: 'Premium', AppLocale.ms: 'Premium'},
    'freePlan': {AppLocale.zh: '免费版', AppLocale.en: 'Free Plan', AppLocale.ms: 'Pelan Percuma'},

    // Settings
    'settings': {AppLocale.zh: '设置', AppLocale.en: 'Settings', AppLocale.ms: 'Tetapan'},
    'privacy': {AppLocale.zh: '隐私', AppLocale.en: 'Privacy', AppLocale.ms: 'Privasi'},
    'language': {AppLocale.zh: '语言', AppLocale.en: 'Language', AppLocale.ms: 'Bahasa'},
    'theme': {AppLocale.zh: '主题', AppLocale.en: 'Theme', AppLocale.ms: 'Tema'},
    'notifications': {AppLocale.zh: '通知', AppLocale.en: 'Notifications', AppLocale.ms: 'Pemberitahuan'},
    'account': {AppLocale.zh: '账户', AppLocale.en: 'Account', AppLocale.ms: 'Akaun'},

    // Profile
    'bio': {AppLocale.zh: '简介', AppLocale.en: 'Bio', AppLocale.ms: 'Bio'},
    'photos': {AppLocale.zh: '照片', AppLocale.en: 'Photos', AppLocale.ms: 'Foto'},
    'tags': {AppLocale.zh: '标签', AppLocale.en: 'Tags', AppLocale.ms: 'Tag'},
    'height': {AppLocale.zh: '身高', AppLocale.en: 'Height', AppLocale.ms: 'Tinggi'},
    'weight': {AppLocale.zh: '体重', AppLocale.en: 'Weight', AppLocale.ms: 'Berat'},
    'age': {AppLocale.zh: '年龄', AppLocale.en: 'Age', AppLocale.ms: 'Umur'},

    // Looking for
    'lookingFor': {AppLocale.zh: '正在找', AppLocale.en: 'Looking For', AppLocale.ms: 'Mencari'},
    'lookingForChat': {AppLocale.zh: '聊天', AppLocale.en: 'Chat', AppLocale.ms: 'Sembang'},
    'lookingForDate': {AppLocale.zh: '约会', AppLocale.en: 'Date', AppLocale.ms: 'Temu Janji'},
    'lookingForFriends': {AppLocale.zh: '交友', AppLocale.en: 'Friends', AppLocale.ms: 'Kawan'},
    'lookingForGym': {AppLocale.zh: '健身', AppLocale.en: 'Gym', AppLocale.ms: 'Gim'},
    'lookingForMakan': {AppLocale.zh: '约饭', AppLocale.en: 'Makan', AppLocale.ms: 'Makan'},
    'lookingForTravel': {AppLocale.zh: '旅行', AppLocale.en: 'Travel', AppLocale.ms: 'Perjalanan'},
    'lookingForRelationship': {AppLocale.zh: '认真交往', AppLocale.en: 'Relationship', AppLocale.ms: 'Hubungan'},

    // Events
    'events': {AppLocale.zh: '活动', AppLocale.en: 'Events', AppLocale.ms: 'Acara'},
    'join': {AppLocale.zh: '参加', AppLocale.en: 'Join', AppLocale.ms: 'Sertai'},
    'free': {AppLocale.zh: '免费', AppLocale.en: 'Free', AppLocale.ms: 'Percuma'},
    'full': {AppLocale.zh: '名额已满', AppLocale.en: 'Full', AppLocale.ms: 'Penuh'},

    // Call
    'voiceCall': {AppLocale.zh: '语音通话', AppLocale.en: 'Voice Call', AppLocale.ms: 'Panggilan Suara'},
    'videoCall': {AppLocale.zh: '视频通话', AppLocale.en: 'Video Call', AppLocale.ms: 'Panggilan Video'},
    'callHistory': {AppLocale.zh: '通话记录', AppLocale.en: 'Call History', AppLocale.ms: 'Rekod Panggilan'},
    'missed': {AppLocale.zh: '未接', AppLocale.en: 'Missed', AppLocale.ms: 'Tidak Dijawab'},
    'endCall': {AppLocale.zh: '挂断', AppLocale.en: 'End Call', AppLocale.ms: 'Tamatkan'},

    // Misc
    'online': {AppLocale.zh: '在线', AppLocale.en: 'Online', AppLocale.ms: 'Dalam Talian'},
    'offline': {AppLocale.zh: '离线', AppLocale.en: 'Offline', AppLocale.ms: 'Luar Talian'},
    'loading': {AppLocale.zh: '加载中...', AppLocale.en: 'Loading...', AppLocale.ms: 'Memuatkan...'},
    'noResults': {AppLocale.zh: '暂无结果', AppLocale.en: 'No results', AppLocale.ms: 'Tiada keputusan'},
    'error': {AppLocale.zh: '出错了', AppLocale.en: 'Something went wrong', AppLocale.ms: 'Ralat berlaku'},
    'coins': {AppLocale.zh: '金币', AppLocale.en: 'Coins', AppLocale.ms: 'Syiling'},
    'purchase': {AppLocale.zh: '购买', AppLocale.en: 'Purchase', AppLocale.ms: 'Beli'},

    // Theme
    'darkTheme': {AppLocale.zh: '深色模式', AppLocale.en: 'Dark Mode', AppLocale.ms: 'Mod Gelap'},
    'lightTheme': {AppLocale.zh: '浅色模式', AppLocale.en: 'Light Mode', AppLocale.ms: 'Mod Cerah'},
    'systemTheme': {AppLocale.zh: '跟随系统', AppLocale.en: 'System Default', AppLocale.ms: 'Ikut Sistem'},

    // Health
    'healthReminder': {AppLocale.zh: '健康提醒', AppLocale.en: 'Health Reminder', AppLocale.ms: 'Peringatan Kesihatan'},
    'lastTestDate': {AppLocale.zh: '上次检测日期', AppLocale.en: 'Last Test Date', AppLocale.ms: 'Tarikh Ujian Terakhir'},
    'reminderInterval': {AppLocale.zh: '提醒频率', AppLocale.en: 'Reminder Interval', AppLocale.ms: 'Selang Peringatan'},
  };

  static String get(String key, AppLocale locale) =>
      _s[key]?[locale] ?? _s[key]?[AppLocale.en] ?? key;
}

/// Convenience extension — use: `'discover'.tr(locale)`
extension StringL10n on String {
  String tr(AppLocale locale) => AppStrings.get(this, locale);
}
