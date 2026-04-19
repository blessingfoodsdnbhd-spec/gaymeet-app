import WidgetKit
import SwiftUI

// MARK: - Shared UserDefaults keys
private let suiteName = "group.com.meetupnearby.app"
private let keyNearbyOnline = "widget_nearbyOnline"
private let keyClosestKm    = "widget_closestKm"
private let keyRecentChats  = "widget_recentChats"

// MARK: - Data models
struct ChatEntry: Codable {
    let matchId: String
    let userId: String
    let nickname: String
    let avatarUrl: String?
    let isOnline: Bool
    let lastMessage: String
}

// MARK: - Timeline Entry
struct MeYouEntry: TimelineEntry {
    let date: Date
    let nearbyOnline: Int
    let closestKm: Int?
    let recentChats: [ChatEntry]
}

// MARK: - Provider (shared)
struct MeYouProvider: TimelineProvider {
    func placeholder(in context: Context) -> MeYouEntry {
        MeYouEntry(date: Date(), nearbyOnline: 12, closestKm: 3, recentChats: [])
    }

    func getSnapshot(in context: Context, completion: @escaping (MeYouEntry) -> Void) {
        completion(loadEntry())
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<MeYouEntry>) -> Void) {
        let entry = loadEntry()
        let next = Calendar.current.date(byAdding: .minute, value: 15, to: Date())!
        completion(Timeline(entries: [entry], policy: .after(next)))
    }

    private func loadEntry() -> MeYouEntry {
        let defaults = UserDefaults(suiteName: suiteName)
        let nearbyOnline = defaults?.integer(forKey: keyNearbyOnline) ?? 0
        let closestKm: Int? = {
            guard let v = defaults?.object(forKey: keyClosestKm) as? Int else { return nil }
            return v
        }()
        var chats: [ChatEntry] = []
        if let data = defaults?.data(forKey: keyRecentChats),
           let decoded = try? JSONDecoder().decode([ChatEntry].self, from: data) {
            chats = decoded
        }
        return MeYouEntry(date: Date(), nearbyOnline: nearbyOnline, closestKm: closestKm, recentChats: chats)
    }
}

// MARK: - Nearby Radar Widget
struct NearbyRadarWidgetView: View {
    let entry: MeYouEntry
    @Environment(\.widgetFamily) var family

    var body: some View {
        ZStack {
            LinearGradient(
                colors: [Color(red: 0.05, green: 0.05, blue: 0.15),
                         Color(red: 0.0, green: 0.1, blue: 0.2)],
                startPoint: .topLeading, endPoint: .bottomTrailing
            )
            VStack(alignment: .leading, spacing: 4) {
                HStack(spacing: 6) {
                    Circle()
                        .fill(Color(red: 0, green: 1, blue: 0.8))
                        .frame(width: 8, height: 8)
                    Text("MeYou")
                        .font(.caption2)
                        .foregroundColor(Color(red: 0, green: 1, blue: 0.8))
                }
                Spacer()
                Text("\(entry.nearbyOnline)")
                    .font(.system(size: family == .systemSmall ? 40 : 52, weight: .bold))
                    .foregroundColor(.white)
                Text("附近在线")
                    .font(.caption)
                    .foregroundColor(Color.white.opacity(0.7))
                if let km = entry.closestKm {
                    Text("最近 \(km) km")
                        .font(.caption2)
                        .foregroundColor(Color(red: 0, green: 1, blue: 0.8).opacity(0.8))
                }
            }
            .padding(14)
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .leading)
        }
        .widgetURL(URL(string: "meyou://nearby"))
    }
}

struct NearbyRadarWidget: Widget {
    let kind = "NearbyRadarWidget"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: MeYouProvider()) { entry in
            NearbyRadarWidgetView(entry: entry)
        }
        .configurationDisplayName("附近在线")
        .description("显示附近在线用户数量")
        .supportedFamilies([.systemSmall, .systemMedium])
    }
}

// MARK: - Recent Chats Widget
struct RecentChatsWidgetView: View {
    let entry: MeYouEntry

    var body: some View {
        ZStack {
            LinearGradient(
                colors: [Color(red: 0.05, green: 0.05, blue: 0.15),
                         Color(red: 0.0, green: 0.08, blue: 0.18)],
                startPoint: .topLeading, endPoint: .bottomTrailing
            )
            if entry.recentChats.isEmpty {
                VStack(spacing: 8) {
                    Image(systemName: "bubble.left.and.bubble.right")
                        .font(.title2)
                        .foregroundColor(Color.white.opacity(0.4))
                    Text("暂无消息")
                        .font(.caption)
                        .foregroundColor(Color.white.opacity(0.4))
                }
            } else {
                VStack(alignment: .leading, spacing: 0) {
                    HStack(spacing: 6) {
                        Circle()
                            .fill(Color(red: 0, green: 1, blue: 0.8))
                            .frame(width: 7, height: 7)
                        Text("最近消息")
                            .font(.caption2)
                            .foregroundColor(Color(red: 0, green: 1, blue: 0.8))
                    }
                    .padding(.bottom, 8)

                    ForEach(entry.recentChats.prefix(3), id: \.matchId) { chat in
                        Link(destination: URL(string: "meyou://chat/\(chat.userId)")!) {
                            HStack(spacing: 10) {
                                ZStack(alignment: .bottomTrailing) {
                                    Circle()
                                        .fill(Color.white.opacity(0.15))
                                        .frame(width: 34, height: 34)
                                        .overlay(
                                            Text(String(chat.nickname.prefix(1)).uppercased())
                                                .font(.system(size: 14, weight: .semibold))
                                                .foregroundColor(.white)
                                        )
                                    if chat.isOnline {
                                        Circle()
                                            .fill(Color(red: 0, green: 1, blue: 0.8))
                                            .frame(width: 9, height: 9)
                                            .offset(x: 1, y: 1)
                                    }
                                }
                                VStack(alignment: .leading, spacing: 2) {
                                    Text(chat.nickname)
                                        .font(.caption)
                                        .fontWeight(.semibold)
                                        .foregroundColor(.white)
                                        .lineLimit(1)
                                    Text(chat.lastMessage.isEmpty ? "发消息打招呼" : chat.lastMessage)
                                        .font(.caption2)
                                        .foregroundColor(Color.white.opacity(0.55))
                                        .lineLimit(1)
                                }
                                Spacer()
                            }
                            .padding(.vertical, 5)
                        }
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
        StaticConfiguration(kind: kind, provider: MeYouProvider()) { entry in
            RecentChatsWidgetView(entry: entry)
        }
        .configurationDisplayName("最近消息")
        .description("显示最近的聊天对话")
        .supportedFamilies([.systemMedium])
    }
}
