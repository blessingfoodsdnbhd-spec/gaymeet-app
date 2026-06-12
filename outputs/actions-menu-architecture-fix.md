# 长按消息菜单（actions menu）架构审查 + 根因分析 + 修复方案

> 状态：**仅分析，未改任何代码**。等你确认方案后再实施。
> 范围：Android「编辑 / emoji 反应 / 复制」三个动作长按后菜单飞到顶部 + 编辑弹键盘时输入框飞走。iOS 正常，不动 iOS。

---

## 0. 最重要的发现（请先看这一节）

**你要我设计的「统一架构修复」其实已经在 `main` 上了，但当前分支没有。**

| | 当前分支 `build52-ios62` | `origin/main` |
|---|---|---|
| HEAD | `64cd037`（Merge #226） | `9b65046`（Merge #227） |
| 版本 | **Build 56**（buildNumber 66 / versionCode 56） | **Build 57**（buildNumber 67 / versionCode 57） |
| keyboard-controller | ❌ 没装 | ✅ `react-native-keyboard-controller ^1.21.11` |
| 根 `KeyboardProvider` | ❌ 无 | ✅ `App.tsx` 顶层 `<KeyboardProvider statusBarTranslucent navigationBarTranslucent>` |
| `Sheet.tsx` 键盘避让 | iOS-only `avoidKeyboard`（Android 上是 no-op） | 两端自动，走 `useReanimatedKeyboardAnimation()`，`avoidKeyboard` 已废弃为 no-op |

关键事实：
- `git log origin/main..HEAD` **为空** → 当前分支是 `main` 的**严格祖先**。`main` = 当前分支 + 3 个 keyboard-controller 提交（`0ad9165` / `4821258` / `9b65046`，即 PR #227 = Build 57）。
- 当前分支 `git status` 里那个未跟踪的 `app-rn/build-1781279316679.ipa`，是从这个 **Build 56** 分支本地打的。
- 也就是说：**如果你测的「Build 58」是从这个分支（或这个 .ipa）出来的，那它根本不含 #227 的架构修复**——bug 当然还在。这不是「修了没用」，是「修复压根没进这个包」。

> ### ⚠️ 实施前必须先回答一个问题
> **你测的 Android「Build 58」到底是从哪个 commit / 哪个分支打的？**
> - 如果是从 `build52-ios62` / Build 56 / 那个本地 .ipa 出来的 → **不需要写任何新代码**，直接从 `main`（含 #227）重新打包即可，bug 大概率消失。这是最省事、风险最低的路。
> - 如果确实是从 `main`（Build 57，含 #227）打的、bug 仍在 → 说明 #227 对「Modal 内的编辑子表单」这一路没覆盖到，需要走下面第 4 节的深层修复。
>
> 在确认这点之前贸然重写 Sheet 架构，很可能是在修一个其实已经修好、只是没打进包的东西。

---

## 1. 完整事件链 + Modal 时序图（当前分支 Build 56 视角）

三个动作共享**同一个** actions Sheet。文件：`app-rn/src/screens/chats/ChatDetailScreen.tsx`。

### 1.1 长按触发
- 触发器：RN 原生 `Pressable` 的 `onLongPress`（**不是** PanResponder / gesture-handler）。
  - 文本气泡：`<Pressable onLongPress={onLongPress} delayLongPress={350}>`（`:1127` / `:1167`）
  - 图片：`<ImageBubble onLongPress={onLongPress}>`（`:1114`，ImageBubble 内部自己是 Pressable）
  - 位置：`<LocationBubble onLongPress={onLongPress}>`（`:1122`）
- 长按时长：自定义 **350ms**（`delayLongPress={350}`），比系统默认 ~500ms 短。
- **无触觉反馈**：`onLongPress`（`:1091`）里没有 `Vibration` / `Haptics`，所以触觉不参与时序。
- `onLongPress` 做两件事（`:1091-1099`）：
  1. `Keyboard.dismiss()` —— 异步开始收起 composer 键盘（动画约 250ms）
  2. `setActionsFor(msg)` —— **同一个同步 tick** 立刻挂载 actions Sheet 的 Modal

### 1.2 actions menu 的 UI 容器
- 是**共享的 `Sheet`**（`app-rn/src/components/Sheet.tsx`），底层是 RN `<Modal transparent animationType="none" statusBarTranslucent>`。`:1385`
- emoji 反应行（`REACTION_EMOJIS` + `⊕`）和 编辑/复制/删除按钮 **在同一个容器、同一个 Sheet 里**，上下两段（反应行在上 `:1396`，ActionRow 在下 `:1432+`）。
- `⊕`（更多 emoji）按钮 → 关掉 actions Sheet → 开**另一个** Sheet（`emojiPickerFor`，`:1500`）。即**第二个 Modal**。

### 1.3 四个动作分别打开什么

| 动作 | 代码位置 | 关闭方式 | 后续 | 是否弹键盘 | 嵌套 |
|---|---|---|---|---|---|
| **编辑** | `:1436` | `closeActionsThen(...)` | 开 edit Sheet（第 2 个 Modal，含 TextInput） | ✅ 是（延迟 350ms focus） | Modal #2 |
| **复制** | `:1449` | `setActionsFor(null)`（即时） | `Clipboard.setStringAsync` + `Alert.alert`（`:878`） | ❌ 否 | 无 Modal（Alert 是原生） |
| **删除** | `:1461` | `setActionsFor(null)`（即时） | `Alert.alert` 确认（`:884`，原生 dialog） | ❌ 否 | 无 Modal |
| **emoji 反应（行内）** | `:1402` | `setActionsFor(null)`（即时） | `onReact` 乐观更新 | ❌ 否 | 无 |
| **+ 更多 emoji** | `:1418` | `closeActionsThen(...)` | 开 emoji picker Sheet（第 2 个 Modal，无 TextInput） | ❌ 否 | Modal #2 |
| **举报/拉黑** | `:1474` | `setActionsFor(null)` | `showSafetyMenu`（另一个 Modal/原生） | ❌ 否 | Modal #2 |

### 1.4 共享的时序 helper（当前分支）

`closeActionsThen`（`ChatDetailScreen.tsx:248-268`）：
```
pendingActionRef = next
setActionsFor(null)                       // 开始关 actions Modal
setTimeout(runPending, iOS 320ms / Android 160ms)   // 之后才开第二个 Modal
```
- **只覆盖「编辑」和「+ emoji picker」两个动作**（它俩要开第二个 Modal）。
- 复制 / 删除 / 行内 emoji / 举报 **不走** `closeActionsThen`，直接 `setActionsFor(null)` 后即时执行——因为它们要么不开 Modal（复制/删除/行内 emoji），要么是别的入口（举报）。

edit 的 focus（`:214-221`）：actions 关掉 → edit Sheet 开 → **再等 350ms** 才 `editInputRef.focus()`（避开 Sheet 的 320ms 开场动画，等卡片落定后键盘才升）。

### 1.5 时序图（当前分支，最坏情况：长按时 composer 键盘是开着的）

```
t=0     用户在输入框打字（composer 键盘 UP）
t=0     长按消息 → Keyboard.dismiss()（键盘开始下滑，~250ms）
t=0     同 tick → setActionsFor(msg) → actions Modal 挂载
        ↑↑↑ Modal 窗口在「键盘还在动画收起」的瞬间被创建/测量
        ↑↑↑ 编辑/emoji/复制 三个动作都在这个被错误定位的 Sheet 里
t≈?     Android 在 edge-to-edge 下对这个 Modal 窗口做 pan → Sheet 飞到顶部 ❌
---- 若点「编辑」 ----
t=A     closeActionsThen → setActionsFor(null)（actions Modal 开始拆）
t=A+160 runPending → setEditingMsg(m) → edit Modal 挂载（第 2 个 Modal）
t=A+160+350  editInputRef.focus() → edit Sheet 的键盘升起
        ↑↑↑ edit Modal 是独立 Dialog 窗口；键盘升起时 Android 再次 pan 这个窗口
        ↑↑↑ 当前分支 avoidKeyboard 是 iOS-only → Android 端零补偿 → 输入框飞走 ❌
```

---

## 2. 统一根因（一句话）

**每个 Sheet 都是一个 RN `<Modal>` = 一个独立的 Android Dialog 窗口。在 Android 15 强制 edge-to-edge（targetSdk 35）+ 新架构（Fabric）下，这个 Dialog 窗口不会乖乖跟随宿主 Activity 的 `windowSoftInputMode=adjustResize`；只要这个窗口被重新测量——① 键盘正在显示/收起，或 ② 同时有另一个 Modal 在挂载/拆卸——系统就会 PAN（整体上移）这个窗口，而 Sheet 卡片是 `position:absolute; bottom:0`，于是整张卡片跟着窗口飞到顶部。**

为什么「编辑/emoji/复制」三个都中招，即使复制/删除根本不弹键盘：
- 它们**共用同一个 actions Sheet**。真正出问题的是 **actions Sheet 自己在「长按瞬间 composer 键盘还在动画」时挂载就被 pan 了**（§1.5 的 t≈? 那一步）。一旦这张共享卡片本身飞到顶，里面三个按钮自然全都不可用。这解释了为什么三个看似无关的动作表现一样。
- 编辑额外还有第二处飞（edit 子 Sheet 自己的键盘升起，§1.5 t=A+160+350）。

当前分支已有的所有修复都是**时序创可贴**，治标不治本：
- `statusBarTranslucent`（#225，Build 56）——只修了「静态状态栏高度偏移」那一种飞，修不了键盘/窗口重测引起的 pan。
- `Keyboard.dismiss()` 后同 tick 开 Sheet（#220）——dismiss 是异步的，根本没等键盘真的收完。
- `closeActionsThen` 160/320ms defer（#181/#218）——靠猜动画时长，本质 flaky；且 `onDismiss` 在 Fabric 上不可靠（#218 注释自己写了）。
- edit focus 延迟 350ms——同样是猜时长。
- `avoidKeyboard` 是 iOS-only（`Sheet.tsx:85` 的 `Platform.OS !== 'ios'` 守卫）→ **Android 编辑表单完全没有键盘避让**，注释里「Android Modal 窗口会自己 resize」在 edge-to-edge 下是**错的**，它是 pan 不是 resize。

---

## 3. `main`（#227 / Build 57）已经做了什么 + 它的潜在缺口

#227 已经做了**正是这套架构级修复**（已合并到 main，但不在当前分支）：
- 装了 `react-native-keyboard-controller`，根部包了 `<KeyboardProvider statusBarTranslucent navigationBarTranslucent>`（`App.tsx:131`）。
- `Sheet.tsx` 改为**两端自动键盘避让**：用 `useReanimatedKeyboardAnimation()` 拿键盘高度（负值），直接加到卡片 `translateY` 上；`KeyboardProvider` 设 `decorFitsSystemWindows(false)` 让窗口本身不再 resize/pan，卡片靠 transform 自己补偿。`avoidKeyboard` prop 废弃为 no-op。

**它对 composer fly-to-top（#227 的主目标）肯定有效**——因为 composer 在屏幕主窗口里，不在 Modal 里。

**但有一个未验证的缺口**，可能正是「即使是 main 的包、编辑仍飞」的原因（如果你的 Build 58 真是从 main 打的）：
- `Sheet.tsx:80-88` 的注释声称：根 `KeyboardProvider` 自带一个 **`ModalAttachedWatcher`**，会检测 RN `<Modal>` 弹出、把 callback 挂到 **Modal 自己的窗口**上、并设成 `SOFT_INPUT_ADJUST_NOTHING`，从而让 `useReanimatedKeyboardAnimation` 在 Modal 内也能拿到键盘高度。
- **我在整个 `app-rn/src` 里 grep 不到任何 `ModalAttachedWatcher` / `setInputMode` / `AndroidSoftInputModes` / 自定义 watcher 组件**——也就是说这完全**依赖 keyboard-controller 库本身能跨进 RN Modal 窗口**这个能力。
- 这正是 keyboard-controller 历史上的**已知痛点**：它的键盘监听默认挂在主 Activity 窗口，RN `<Modal>` 是另一个 Dialog 窗口；库对 Modal 的支持是版本敏感的。如果在 `^1.21.11` + RN 0.76.5 + 新架构下这个 Modal 跨窗口没生效，那么 **edit Sheet（在 Modal 里）的键盘高度读到的是 0，卡片不会上移，输入框仍会被键盘挡住或飞走**——而 composer（不在 Modal 里）却是好的。

> 结论：#227 大概率修好了 composer，但**对「Modal 内含 TextInput 的 Sheet」（编辑消息）这一路可能仍有缺口**。这需要在真机上对 main 的包验证。

---

## 4. 修复方案（按推荐顺序，从低风险到大改）

### 方案 0 —— 先确认 + 重打包（**强烈建议第一步，可能零代码**）
1. 确认 Build 58 的来源 commit（`git log` / EAS build 记录 / CI）。
2. 如果它 ≤ Build 56（不含 #227）→ 直接 **merge `main` 进发布分支 或 从 `main` 重新打包**，先在真机复测。很可能 emoji/复制/长按飞顶问题直接消失（那本来就是 #227 修的）。
3. 只有当「确认是 main 的包、编辑仍飞」时，才进入下面的方案。

**风险**：极低。**代价**：一次重打包。

### 方案 A —— 在 #227 基础上，显式锁住 Modal 窗口的 softInputMode（**推荐的真正代码修复**）
针对 §3 的缺口，不再赌库能不能跨 Modal 窗口，而是**主动**控制：
- 在 edit Sheet（以及任何 Modal 内含 TextInput 的 Sheet）mount 时，用 keyboard-controller 的 `KeyboardController.setInputMode(AndroidSoftInputModes.SOFT_INPUT_ADJUST_NOTHING)`，unmount 时 `setDefaultMode()` 还原。`ADJUST_NOTHING` = 系统不再 pan/resize 这个窗口，卡片完全靠 reanimated transform 自己抬。
- 让 `Sheet` 的键盘避让在 Android 上也真正生效（确认 `useReanimatedKeyboardAnimation` 在 `setInputMode` 之后于 Modal 内能读到非 0 高度；若仍读不到，则在 Sheet 内补一个 `KeyboardController` 事件监听把高度喂给 `kb` shared value）。
- 顺手把「长按瞬间」的竞态做实：把 `onLongPress` 里的 `Keyboard.dismiss()` + `setActionsFor` 改成**先等 `keyboardDidHide` 再挂 Sheet**（或在已上键盘时延一帧），避免 actions Sheet 在键盘动画中挂载被 pan。

**风险**：中（依赖 #227 已在分支里；改动集中在 `Sheet.tsx` + `ChatDetailScreen` 长按入口）。**代价**：1 个文件为主 + 长按入口微调。**iOS 影响**：`setInputMode` 是 Android-only，iOS 走原有全局键盘通知，不受影响。

### 方案 B —— 用 `@gorhom/bottom-sheet` 重写共享 `Sheet`（**最彻底，根除根因**）
- gorhom 的 sheet **不用 RN Modal Dialog 窗口**——它通过 portal 在现有 App 根窗口内渲染（reanimated 驱动）。**没有独立窗口 = 没有可被 pan 的窗口**，§2 的根因从源头消失。
- 自带一流键盘处理（`keyboardBehavior` / `android_keyboardInputMode`），编辑表单天然避让。
- 依赖已满足：`gesture-handler ~2.20`、`reanimated ~3.16` 兼容 gorhom v5。需在 `App.tsx` 根加 `BottomSheetModalProvider`。
- **关键收益**：`Sheet` 的对外 API 很小（`open/onClose/children/maxHeight/overlay/onDismiss/avoidKeyboard`），可以**保持同样的 props 做 drop-in 重写**——只改 `Sheet.tsx` 一个文件，**全 App 所有 Sheet 调用点零改动**全部受益；还能逐步删掉 `closeActionsThen` / `navigateAfterSheetClose` / `openSheetAfterKeyboardDismiss` 这堆创可贴。

**风险**：较高（新 native 依赖，需新 EAS build；要回归所有 Sheet 调用点的手势/拖拽关闭/overlay 行为）。**代价**：1 个文件重写 + 根 provider + 全量 Sheet 回归测试。**iOS 影响**：gorhom 两端一致，iOS 也会换实现，需一并回归（用户说 iOS 现在 OK，换实现有回归风险——这是方案 B 的主要顾虑）。

### 方案 C —— react-navigation transparentModal（不推荐）
把每个 sheet 改成 navigator 里的 `presentation: 'transparentModal'` 路由，由导航层管理、不走 RN Modal。也能绕开窗口 pan，但要把 sheet 拆成路由、edit 的 draft 状态要外提，改动面大且别扭，性价比最低。

---

## 5. 我的推荐

1. **先做方案 0**：查清 Build 58 的来源 commit。这一步几乎免费，且很可能直接定位为「修复没打进包」。
2. 若确认是旧包 → 从 `main` 重打，真机复测三个动作。
3. 若 main 的包编辑仍飞 → 做**方案 A**（在 #227 上显式 `SOFT_INPUT_ADJUST_NOTHING` + 长按竞态做实）。改动小、iOS 零影响，精准打在 Modal 缺口上。
4. 把**方案 B（gorhom）当作核选项**：只有当 A 仍压不住、或想从根上消灭整类「Modal 飞顶」bug 时再上。因为它会连 iOS 的 Sheet 实现一起换，对「iOS 现在 OK」是有回归风险的。

> 一句话：**大概率不是要重写架构，而是架构修复（#227）没进你测的那个包。** 先验证这点，再决定要不要写代码。

---

## 6. 读过的文件
- `app-rn/src/screens/chats/ChatDetailScreen.tsx`（长按、四动作、closeActionsThen、edit focus、copy/delete handler、四个 Sheet）
- `app-rn/src/screens/world-chat/WorldChatScreen.tsx`（Plaza 聊天的 actions Sheet：reply/delete/report/block/dm，**无含键盘的 edit 子表单**，故不在本 bug 主路径）
- `app-rn/src/components/Sheet.tsx`（当前分支 vs `origin/main` 逐行 diff）
- `app-rn/src/utils/keyboardSheet.ts`（`openSheetAfterKeyboardDismiss` / `navigateAfterSheetClose`）
- `app-rn/src/App.tsx`（根 providers；当前分支无 KeyboardProvider，main 有）
- `app-rn/app.json`（`softwareKeyboardLayoutMode: resize`、targetSdk 35、newArch on、版本号对比）
- `package.json`（依赖对比：当前分支无 keyboard-controller / gorhom，main 有 keyboard-controller）
