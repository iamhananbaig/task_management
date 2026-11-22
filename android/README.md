# Tasks — Android app

Native Kotlin app (Android 8+, minSdk 26), built the same way as mess_soft's Android app: plain
Android Views, `org.json`, coroutines, RecyclerView — no Compose, no Retrofit. Release APK ≈ 0.5 MB.
It talks to the same `/api/v1` as the web app (no backend changes).

| Screen | What it does |
|---|---|
| Sign in | Email, password, server address (the web app's address); new accounts set their own password first |
| My tasks | Assigned to me, grouped Overdue / Today / Next 7 days / Later / No date (or one filter), or To review. Each card has its next move as a button (Start, Submit for review, Approve); **swipe a card right** for the same. Search (🔍), **+** for a new task (pick the project; the last one is remembered) |
| Projects → project | Tasks grouped by status; Everyone / Mine / Unassigned; search; **+** new task |
| Task | Status and moves in a bar at the bottom, always in reach. People / priority / tags folded into one line (tap to edit). Description, checklist (add several items in a row; long-press to remove), files (take photo, attach file, tap to open, long-press to remove), comments; ⋯ watch, email reminder, move to bin |
| Move sheet | Opens for Submit for review, moves that need a reason or a document, and finishing with open checklist items: tick the remaining items, attach evidence and add a note in one place |
| Period | A routine run (e.g. *November 2026 · Month-end close*): progress and its tasks |
| Alerts | Notifications grouped by day, unread highlighted; tap opens the task / period and marks it read; ✓ marks all read |
| Me | Profile, change password, check for updates, sign out |

Lists keep what they last loaded when the phone is offline and say so in a banner.

**Phone notifications:** a background check (WorkManager, about every 15 minutes — Android's
minimum) shows new alerts as notifications; tapping one opens the task. Instant push would need
Firebase Cloud Messaging (a Firebase project + an FCM channel on the server) — not set up yet.

## Build & install

Needs Android Studio's JDK and the Android SDK. From this folder:

```bash
export JAVA_HOME=/opt/android-studio/jbr
./gradlew assembleDebug
adb install -r app/build/outputs/apk/debug/app-debug.apk
```

The debug build installs as **Tasks (debug)** (`com.iamhananbaig.tasks.debug`) next to the release app
and allows plain HTTP; release builds are HTTPS-only (except `localhost`).

## Testing against a local backend

Phone on USB (or the emulator):

```bash
cd ../backend && php artisan serve --port=8001
adb reverse tcp:8001 tcp:8001          # the phone's localhost:8001 → this computer
```

Sign in with server address `http://localhost:8001`. Over Wi-Fi instead: run
`php artisan serve --host=0.0.0.0 --port=8001`, allow the port in the firewall, and use
`http://<computer's LAN IP>:8001` (debug build only).

## Releases and updates (same as mess_soft)

GitHub Actions (`.github/workflows/android-release.yml`) builds, signs and publishes a release when
an `android-vX.Y[.Z]` tag is pushed; the tag message becomes the "what's new" text:

```bash
git tag -a android-v1.1 -m "What changed"
git push origin android-v1.1
```

The app updates itself from those releases (`Updater.kt`): checks on start (at most every 6 hours)
and from Me → Check for updates, downloads the APK, verifies size and SHA-256, opens the installer.

**Signing key (one-time).** Create it outside the repo and back it up — updates signed with any other
key can't be installed over the app:

```bash
mkdir -p ~/.android-keys
keytool -genkeypair -v -keystore ~/.android-keys/tasks.jks -alias tasks -keyalg RSA -keysize 4096 -validity 36500
printf 'storeFile=%s\nstorePassword=PASSWORD\nkeyAlias=tasks\nkeyPassword=PASSWORD\n' ~/.android-keys/tasks.jks > ~/.android-keys/tasks.properties
chmod 600 ~/.android-keys/tasks.*
```

Then add two repository secrets: `ANDROID_KEYSTORE_BASE64` (`base64 -w0 ~/.android-keys/tasks.jks`)
and `ANDROID_KEYSTORE_PASSWORD`. Local signed build: `./gradlew assembleRelease`.

## Files

| File | What |
|---|---|
| `LoginActivity.kt` / `PasswordActivity.kt` | Sign-in + server address; set / change password |
| `MainActivity.kt` | Tabs: My tasks, Projects, Alerts, Me |
| `ProjectActivity.kt` / `RunActivity.kt` / `ListScreen.kt` | Project tasks by status; routine period; shared list screen |
| `TaskActivity.kt` / `NewTaskActivity.kt` | Task detail and actions; new task |
| `Rows.kt` | List rows: task / project cards, alerts, headers |
| `AlertsWorker.kt` | Background alerts check → phone notifications |
| `Api.kt` / `Session.kt` / `Models.kt` / `Format.kt` | JSON client (incl. upload / download), saved session, API shapes, dates |
| `BaseActivity.kt` / `Ui.kt` | Screen base (insets, top bar, sheets, pickers), design helpers (from mess_soft) |
| `Updater.kt` | Self-update from GitHub Releases |
