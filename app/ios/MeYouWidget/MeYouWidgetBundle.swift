import WidgetKit
import SwiftUI

@main
struct MeYouWidgetBundle: WidgetBundle {
    var body: some Widget {
        NearbyRadarWidget()
        RecentChatsWidget()
    }
}
