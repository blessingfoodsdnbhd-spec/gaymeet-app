import ExpoModulesCore
import UIKit

public class NativeSheetModule: Module {
  public func definition() -> ModuleDefinition {
    Name("NativeSheet")

    // Native centered alert. `buttons` is [{ label, style }]; resolves the
    // tapped button index.
    AsyncFunction("presentAlert") { (title: String, message: String, buttons: [[String: Any]], promise: Promise) in
      DispatchQueue.main.async {
        let alert = UIAlertController(title: title, message: message, preferredStyle: .alert)
        var resolved = false
        for (idx, btn) in buttons.enumerated() {
          let label = btn["label"] as? String ?? ""
          let style = Self.actionStyle(btn["style"] as? String)
          alert.addAction(UIAlertAction(title: label, style: style) { _ in
            if !resolved { resolved = true; promise.resolve(idx) }
          })
        }
        Self.present(alert, fallbackResolve: { if !resolved { resolved = true; promise.resolve(-1) } })
      }
    }

    // Native action sheet (bottom). Resolves the tapped option index, or
    // cancelIndex / -1 on dismiss.
    AsyncFunction("presentActionSheet") { (title: String?, message: String?, options: [String], cancelIndex: Int?, destructiveIndex: Int?, promise: Promise) in
      DispatchQueue.main.async {
        let sheet = UIAlertController(title: title, message: message, preferredStyle: .actionSheet)
        var resolved = false
        for (idx, opt) in options.enumerated() {
          var style: UIAlertAction.Style = .default
          if idx == cancelIndex { style = .cancel }
          if idx == destructiveIndex { style = .destructive }
          sheet.addAction(UIAlertAction(title: opt, style: style) { _ in
            if !resolved { resolved = true; promise.resolve(idx) }
          })
        }
        // iPad requires a popover anchor for action sheets.
        if let pop = sheet.popoverPresentationController, let view = Self.keyWindow() {
          pop.sourceView = view
          pop.sourceRect = CGRect(x: view.bounds.midX, y: view.bounds.maxY, width: 0, height: 0)
          pop.permittedArrowDirections = []
        }
        Self.present(sheet, fallbackResolve: { if !resolved { resolved = true; promise.resolve(cancelIndex ?? -1) } })
      }
    }
  }

  private static func actionStyle(_ s: String?) -> UIAlertAction.Style {
    switch s {
    case "cancel": return .cancel
    case "destructive": return .destructive
    default: return .default
    }
  }

  // The app's active key window (replaces the iOS 15-deprecated
  // UIApplication.shared.windows.first).
  private static func keyWindow() -> UIView? {
    return UIApplication.shared.connectedScenes
      .compactMap { $0 as? UIWindowScene }
      .flatMap { $0.windows }
      .first { $0.isKeyWindow }
  }

  // Present from the top-most presented view controller so it shows above any
  // RN screen/modal already on screen.
  private static func present(_ vc: UIViewController, fallbackResolve: @escaping () -> Void) {
    guard var top = keyWindow()?.rootViewController else { fallbackResolve(); return }
    while let presented = top.presentedViewController { top = presented }
    top.present(vc, animated: true)
  }
}
