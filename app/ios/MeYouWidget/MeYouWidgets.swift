import WidgetKit
import SwiftUI

private let appGroupID = "group.com.meetupnearby.app"

// MARK: - Shared data

struct ChatContact: Codable, Identifiable {
    var userId: String
    var name: String
    var avatar: String
    var isOnline: Bool
    var unread: Int
    var id: String { userId }
}

// MARK: - iOS version compat

extension View {
    @ViewBuilder
    func widgetBackground(_ color: Color) -> some View {
        if #available(iOS 17, *) {
            self.containerBackground(color, for: .widget)
        } else {
            self.background(color)
        }
    }
}

// MARK: - Color helper

extension Color {
    init(hex: String) {
        let h = hex.trimmingCharacters(in: CharacterSet.alphanumerics.inverted)
        var int: UInt64 = 0
        Scanner(string: h).scanHexInt64(&int)
        let r = Double((int >> 16) & 0xFF) / 255
        let g = Double((int >> 8) & 0xFF) / 255
        let b = Double(int & 0xFF) / 255
        self.init(.sRGB, red: r, green: g, blue: b, opacity: 1)
    }
}

private let accent = Color(hex: "FF2D78")
private let bg     = Color(hex: "0D0D0D")

// MARK: - Nearby Radar Widget

struct NearbyEntry: TimelineEntry {
    let date: Date
    let nearbyOnline: Int
    let closestDistance: String
}

struct NearbyProvider: TimelineProvider {
    func placeholder(in context: Context) -> NearbyEntry {
        NearbyEntry(date: .now, nearbyOnline: 5, closestDistance: "120m")
    }
    func getSnapshot(in context: Context, completion: @escaping (NearbyEntry) -> Void) {
        completion(readNearbyEntry())
    }
    func getTimeline(in context: Context, completion: @escaping (Timeline<NearbyEntry>) -> Void) {
        let entry = readNearbyEntry()
        let next = Calendar.current.date(byAdding: .minute, value: 15, to: entry.date)!
        completion(Timeline(entries: [entry], policy: .after(next)))
    }
    private func readNearbyEntry() -> NearbyEntry {
        let ud = UserDefaults(suiteName: appGroupID)
        let online = ud?.integer(forKey: "nearbyOnline") ?? 0
        let dist   = ud?.string(forKey: "closestDistance") ?? "--"
        return NearbyEntry(date: .now, nearbyOnline: online, closestDistance: dist)
    }
}

struct NearbyWidgetView: View {
    var entry: NearbyEntry
    @Environment(\.widgetFamily) var family

    var body: some View {
        ZStack(alignment: .topLeading) {
            bg.ignoresSafeArea()
            VStack(alignment: .leading, spacing: 6) {
                // Header dot + label
                HStack(spacing: 5) {
                    ZStack {
                        Circle().fill(accent.opacity(0.25)).frame(width: 14, height: 14)
                        Circle().fill(accent).frame(width: 7, height: 7)
                    }
                    Text("MeYou")
                        .font(.system(size: 10, weight: .semibold))
                        .foregroundColor(.white.opacity(0.45))
                }
                Spacer()
                // Count
                Text("\(entry.nearbyOnline)人在线")
                    .font(.system(size: family == .systemSmall ? 22 : 26, weight: .bold))
                    .foregroundColor(.white)
                // Distance
                HStack(spacing: 3) {
                    Image(systemName: "location.fill")
                        .font(.system(size: 10))
                        .foregroundColor(accent)
                    Text(entry.closestDistance)
                        .font(.system(size: 13, weight: .medium))
                        .foregroundColor(accent)
                }
                Spacer()
                // CTA
                Link(destination: URL(string: "meyou://nearby")!) {
                    Text("打开")
                        .font(.system(size: 13, weight: .bold))
                        .foregroundColor(.white)
                        .padding(.horizontal, 14)
                        .padding(.vertical, 7)
                        .background(accent)
                        .clipShape(Capsule())
                }
            }
            .padding(14)
        }
    }
}

struct NearbyRadarWidget: Widget {
    let kind = "NearbyRadarWidget"
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: NearbyProvider()) { entry in
            NearbyWidgetView(entry: entry)
                .widgetBackground(bg)
        }
        .configurationDisplayName("附近在线")
        .description("显示附近在线用户数量")
        .supportedFamilies([.systemSmall, .systemMedium])
    }
}

// MARK: - Recent Chats Widget

struct ChatsEntry: TimelineEntry {
    let date: Date
    let contacts: [ChatContact]
}

struct ChatsProvider: TimelineProvider {
    func placeholder(in context: Context) -> ChatsEntry {
        ChatsEntry(date: .now, contacts: [
            ChatContact(userId: "1", name: "Alex", avatar: "", isOnline: true,  unread: 2),
            ChatContact(userId: "2", name: "Sam",  avatar: "", isOnline: false, unread: 0),
            ChatContact(userId: "3", name: "Jay",  avatar: "", isOnline: true,  unread: 1),
        ])
    }
    func getSnapshot(in context: Context, completion: @escaping (ChatsEntry) -> Void) {
        completion(readChatsEntry())
    }
    func getTimeline(in context: Context, completion: @escaping (Timeline<ChatsEntry>) -> Void) {
        let entry = readChatsEntry()
        let next = Calendar.current.date(byAdding: .minute, value: 15, to: entry.date)!
        completion(Timeline(entries: [entry], policy: .after(next)))
    }
    private func readChatsEntry() -> ChatsEntry {
        let ud = UserDefaults(suiteName: appGroupID)
        var contacts: [ChatContact] = []
        if let data = ud?.data(forKey: "recentChats"),
           let decoded = try? JSONDecoder().decode([ChatContact].self, from: data) {
            contacts = Array(decoded.prefix(3))
        }
        return ChatsEntry(date: .now, contacts: contacts)
    }
}

struct AvatarView: View {
    let contact: ChatContact
    var body: some View {
        ZStack(alignment: .bottomTrailing) {
            if let url = URL(string: contact.avatar), !contact.avatar.isEmpty {
                AsyncImage(url: url) { phase in
                    switch phase {
                    case .success(let img): img.resizable().scaledToFill()
                    default: avatarFallback
                    }
                }
                .frame(width: 34, height: 34)
                .clipShape(Circle())
            } else {
                avatarFallback
            }
            if contact.isOnline {
                Circle()
                    .fill(Color.green)
                    .frame(width: 9, height: 9)
                    .overlay(Circle().stroke(bg, lineWidth: 1.5))
                    .offset(x: 1, y: 1)
            }
        }
    }
    private var avatarFallback: some View {
        Circle()
            .fill(accent.opacity(0.25))
            .frame(width: 34, height: 34)
            .overlay(
                Text(String(contact.name.prefix(1)).uppercased())
                    .font(.system(size: 14, weight: .bold))
                    .foregroundColor(accent)
            )
    }
}

struct ContactRow: View {
    let contact: ChatContact
    var body: some View {
        Link(destination: URL(string: "meyou://chat/\(contact.userId)")!) {
            HStack(spacing: 9) {
                AvatarView(contact: contact)
                Text(contact.name)
                    .font(.system(size: 13, weight: .medium))
                    .foregroundColor(.white)
                    .lineLimit(1)
                Spacer()
                if contact.unread > 0 {
                    Text("\(contact.unread)")
                        .font(.system(size: 10, weight: .bold))
                        .foregroundColor(.white)
                        .frame(minWidth: 18, minHeight: 18)
                        .background(accent)
                        .clipShape(Capsule())
                }
            }
        }
    }
}

struct RecentChatsWidgetView: View {
    var entry: ChatsEntry
    var body: some View {
        ZStack {
            bg.ignoresSafeArea()
            Link(destination: URL(string: "meyou://chats")!) {
                VStack(alignment: .leading, spacing: 0) {
                    Text("最近聊天")
                        .font(.system(size: 10, weight: .semibold))
                        .foregroundColor(.white.opacity(0.45))
                        .padding(.bottom, 10)
                    if entry.contacts.isEmpty {
                        Spacer()
                        Text("暂无聊天")
                            .font(.system(size: 13))
                            .foregroundColor(.white.opacity(0.3))
                        Spacer()
                    } else {
                        VStack(alignment: .leading, spacing: 10) {
                            ForEach(entry.contacts) { c in ContactRow(contact: c) }
                        }
                        Spacer()
                    }
                }
                .padding(14)
                .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
            }
        }
    }
}

struct RecentChatsWidget: Widget {
    let kind = "RecentChatsWidget"
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: ChatsProvider()) { entry in
            RecentChatsWidgetView(entry: entry)
                .widgetBackground(bg)
        }
        .configurationDisplayName("最近聊天")
        .description("显示最近的聊天联系人")
        .supportedFamilies([.systemMedium])
    }
}

// MARK: - Bundle entry point

@main
struct MeYouWidgetBundle: WidgetBundle {
    var body: some Widget {
        NearbyRadarWidget()
        RecentChatsWidget()
    }
}
