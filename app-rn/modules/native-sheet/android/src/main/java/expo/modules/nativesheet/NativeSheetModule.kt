package expo.modules.nativesheet

import android.app.Activity
import android.content.DialogInterface
import android.graphics.Color
import android.os.Handler
import android.os.Looper
import android.util.TypedValue
import android.view.Gravity
import android.widget.LinearLayout
import android.widget.TextView
import androidx.appcompat.app.AlertDialog
import com.google.android.material.bottomsheet.BottomSheetDialog
import expo.modules.kotlin.Promise
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

/**
 * Native dialog/sheet bridge for Android. Uses androidx AlertDialog and Material
 * BottomSheetDialog — both are real native views, NOT React Native <Modal>s, so
 * they are immune to the Android-15 edge-to-edge "fly to the top" bug that
 * afflicts RN's Modal (which opens a separate, mis-positioned window).
 */
class NativeSheetModule : Module() {
  private val main = Handler(Looper.getMainLooper())

  override fun definition() = ModuleDefinition {
    Name("NativeSheet")

    // Native centered alert → resolves the tapped button index (or -1 on dismiss).
    AsyncFunction("presentAlert") { title: String, message: String, buttons: List<Map<String, Any?>>, promise: Promise ->
      main.post {
        val activity = appContext.currentActivity
        if (activity == null) {
          promise.reject("NO_ACTIVITY", "No current activity", null)
          return@post
        }
        val resolved = booleanArrayOf(false)
        fun resolve(i: Int) { if (!resolved[0]) { resolved[0] = true; promise.resolve(i) } }

        val builder = AlertDialog.Builder(activity)
          .setTitle(title)
          .setMessage(message)
        // AlertDialog has at most 3 slots (positive / negative / neutral). Map by
        // style: cancel→negative, destructive→neutral(red), default→positive.
        buttons.forEachIndexed { idx, btn ->
          val label = btn["label"] as? String ?: ""
          val listener = DialogInterface.OnClickListener { _, _ -> resolve(idx) }
          when (btn["style"] as? String) {
            "cancel" -> builder.setNegativeButton(label, listener)
            "destructive" -> builder.setNeutralButton(label, listener)
            else -> builder.setPositiveButton(label, listener)
          }
        }
        builder.setOnDismissListener { resolve(-1) }
        builder.show()
      }
    }

    // Native bottom action sheet (Material) → resolves the tapped option index,
    // or cancelIndex / -1 on dismiss.
    AsyncFunction("presentActionSheet") { title: String?, message: String?, options: List<String>, cancelIndex: Int?, destructiveIndex: Int?, promise: Promise ->
      main.post {
        val activity = appContext.currentActivity
        if (activity == null) {
          promise.reject("NO_ACTIVITY", "No current activity", null)
          return@post
        }
        val resolved = booleanArrayOf(false)
        fun resolve(i: Int) { if (!resolved[0]) { resolved[0] = true; promise.resolve(i) } }

        val dialog = BottomSheetDialog(activity)
        val container = LinearLayout(activity).apply {
          orientation = LinearLayout.VERTICAL
          setPadding(0, dp(activity, 8), 0, dp(activity, 16))
        }
        if (!title.isNullOrEmpty() || !message.isNullOrEmpty()) {
          container.addView(TextView(activity).apply {
            text = listOfNotNull(title?.takeIf { it.isNotEmpty() }, message?.takeIf { it.isNotEmpty() }).joinToString("\n")
            setTextSize(TypedValue.COMPLEX_UNIT_SP, 14f)
            setTextColor(Color.GRAY)
            gravity = Gravity.CENTER
            setPadding(dp(activity, 24), dp(activity, 16), dp(activity, 24), dp(activity, 12))
          })
        }
        options.forEachIndexed { idx, opt ->
          container.addView(TextView(activity).apply {
            text = opt
            setTextSize(TypedValue.COMPLEX_UNIT_SP, 17f)
            gravity = Gravity.CENTER
            setPadding(dp(activity, 24), dp(activity, 16), dp(activity, 24), dp(activity, 16))
            isClickable = true
            if (idx == destructiveIndex) setTextColor(Color.parseColor("#E14B5C"))
            else if (idx == cancelIndex) setTextColor(Color.GRAY)
            setOnClickListener { dialog.dismiss(); resolve(idx) }
          }, LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT))
        }
        dialog.setOnDismissListener { resolve(cancelIndex ?: -1) }
        dialog.setContentView(container)
        dialog.show()
      }
    }
  }

  private fun dp(activity: Activity, value: Int): Int =
    (value * activity.resources.displayMetrics.density).toInt()
}
