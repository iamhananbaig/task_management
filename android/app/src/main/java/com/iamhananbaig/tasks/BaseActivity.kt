package com.iamhananbaig.tasks

import android.content.Intent
import android.content.res.ColorStateList
import android.graphics.drawable.GradientDrawable
import android.os.Build
import android.text.InputFilter
import android.text.InputType
import android.view.Gravity
import android.view.View
import android.view.ViewGroup
import android.view.inputmethod.InputMethodManager
import android.widget.EditText
import android.widget.FrameLayout
import android.widget.LinearLayout
import android.widget.ProgressBar
import android.widget.TextView
import android.widget.Toast
import androidx.activity.ComponentActivity
import androidx.core.view.ViewCompat
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsCompat
import androidx.lifecycle.lifecycleScope
import kotlinx.coroutines.launch

/** Set when something changed that list screens should reload on return (task moved, edited…). */
object AppState {
    var dirty = false
}

/**
 * Every screen: edge-to-edge window with system-bar and keyboard insets, the app font,
 * the shared top bar, and dialogs (bottom sheets and pop-ups). Same as mess_soft's.
 */
abstract class ScreenActivity : ComponentActivity() {
    private var windowReady = false

    override fun onContentChanged() {
        super.onContentChanged()
        if (windowReady) return
        windowReady = true
        WindowCompat.setDecorFitsSystemWindows(window, false)
        if (Build.VERSION.SDK_INT < 27) window.navigationBarColor = getColor(R.color.ink)
        val content = findViewById<ViewGroup>(android.R.id.content)
        content.setBackgroundColor(getColor(R.color.surface))
        ViewCompat.setOnApplyWindowInsetsListener(content) { v, insets ->
            val bars = insets.getInsets(WindowInsetsCompat.Type.systemBars() or WindowInsetsCompat.Type.displayCutout())
            val ime = insets.getInsets(WindowInsetsCompat.Type.ime())
            v.setPadding(bars.left, bars.top, bars.right, maxOf(bars.bottom, ime.bottom))
            WindowInsetsCompat.CONSUMED
        }
        Fonts.install(window.decorView)
    }

    // ── Top bar (view_topbar) ──

    protected fun topBar(title: String, back: Boolean = true) {
        findViewById<TextView>(R.id.title).text = title
        val backButton = findViewById<View>(R.id.back)
        if (back) backButton.setOnClickListener { onBackPressedDispatcher.onBackPressed() }
        else {
            backButton.visibility = View.GONE
            findViewById<View>(R.id.titleBox).setPadding(dp(14), 0, dp(8), 0)
        }
    }

    protected fun topSummary(text: CharSequence?) {
        findViewById<TextView>(R.id.summary).apply {
            this.text = text
            visibility = if (text.isNullOrEmpty()) View.GONE else View.VISIBLE
        }
    }

    protected fun addTopAction(icon: Int, description: String, onClick: () -> Unit): FrameLayout =
        topAction(icon, description, onClick).also { findViewById<LinearLayout>(R.id.actions).addView(it) }

    protected fun clearTopActions() = findViewById<LinearLayout>(R.id.actions).removeAllViews()

    /** The thin loading line under the top bar, for refreshes over content already shown. */
    protected fun busy(on: Boolean) {
        findViewById<ProgressBar>(R.id.progress)?.visibility = if (on) View.VISIBLE else View.INVISIBLE
    }

    // ── Dialogs ──

    protected fun showError(title: String, message: String?) {
        Sheet(this, centered = true).title(title).message(message ?: "").apply { button("OK", ButtonKind.SECONDARY) }.show()
    }

    protected fun confirm(title: String, message: String, action: String, danger: Boolean = false, onConfirm: () -> Unit) {
        Sheet(this, centered = true).title(title).message(message).apply {
            buttonPair("Cancel", action, if (danger) ButtonKind.DANGER else ButtonKind.PRIMARY, onPrimary = onConfirm)
        }.show()
    }

    /** A pop-up with a spinner, for short waits that block the screen. */
    protected fun progressPopup(message: String): Pair<Sheet, TextView> {
        val sheet = Sheet(this, centered = true).cancelable(false)
        val label = text(message, 16f)
        sheet.body.addView(LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER_VERTICAL
            addView(ProgressBar(context).apply { indeterminateTintList = ColorStateList.valueOf(getColor(R.color.primary)) }, lp(dp(32), dp(32)).apply { marginEnd = dp(16) })
            addView(label, lp(0, weight = 1f))
        })
        return sheet.show() to label
    }

    /** Options as rows in a bottom sheet; the current one is ticked. */
    protected fun choose(title: String, options: List<Pair<String, String>>, current: String?, onPick: (String) -> Unit) {
        val sheet = Sheet(this).title(title)
        options.forEach { (value, label) ->
            sheet.body.addView(menuRow(if (value == current) R.drawable.ic_check else 0, label, color = if (value == current) R.color.primary else R.color.text) {
                sheet.dismiss()
                if (value != current) onPick(value)
            })
        }
        sheet.button("Cancel", ButtonKind.SECONDARY)
        sheet.show()
    }

    /** A sheet with a text box: comments on moves, reminder notes, new checklist items. */
    protected fun askText(title: String, hint: String, action: String, required: Boolean, subtitle: String? = null, initial: String = "", extra: android.view.View? = null, onSubmit: (String) -> Unit) {
        val sheet = Sheet(this).title(title, subtitle)
        val input = field(if (required) "$hint (required)" else hint, InputType.TYPE_CLASS_TEXT or InputType.TYPE_TEXT_FLAG_MULTI_LINE or InputType.TYPE_TEXT_FLAG_CAP_SENTENCES, 5000).apply {
            minLines = 3
            gravity = Gravity.TOP
        }
        input.setText(initial)
        input.setSelection(initial.length)
        sheet.body.addView(input)
        extra?.let { sheet.body.addView(it, lp().apply { topMargin = dp(12) }) }
        sheet.buttonPair("Cancel", action) {
            val value = input.text.toString().trim()
            if (required && value.isEmpty()) toast("$hint is required") else onSubmit(value)
        }
        sheet.show()
        input.requestFocus()
        sheet.dialog.window?.setSoftInputMode(android.view.WindowManager.LayoutParams.SOFT_INPUT_STATE_VISIBLE)
    }

    protected fun field(hint: String, inputType: Int = InputType.TYPE_CLASS_TEXT, maxLength: Int = 255) = EditText(this).apply {
        this.hint = hint
        textSize = 17f
        this.inputType = inputType
        isSingleLine = inputType and InputType.TYPE_TEXT_FLAG_MULTI_LINE == 0
        filters = arrayOf(InputFilter.LengthFilter(maxLength))
        setBackgroundResource(R.drawable.field)
        setPadding(dp(14), dp(12), dp(14), dp(12))
        minHeight = dp(52)
        layoutParams = lp()
    }

    protected fun label(value: String) = text(value, 14f, R.color.muted, bold = true).apply { setPadding(0, dp(14), 0, dp(6)) }

    /** Filter chip; selected chips are filled. */
    protected fun chip(label: String, selected: Boolean, onClick: () -> Unit): TextView = TextView(this).apply {
        text = label
        textSize = 15f
        gravity = Gravity.CENTER
        minHeight = dp(38)
        setPadding(dp(16), 0, dp(16), 0)
        setBackgroundResource(R.drawable.pill)
        isSelected = selected
        setTextColor(if (selected) getColor(R.color.surface) else getColor(R.color.text))
        setOnClickListener { onClick() }
        layoutParams = LinearLayout.LayoutParams(ViewGroup.LayoutParams.WRAP_CONTENT, ViewGroup.LayoutParams.WRAP_CONTENT).apply { marginEnd = dp(8) }
    }

    protected fun toast(msg: String) = Toast.makeText(this, msg, Toast.LENGTH_SHORT).show()

    protected fun hideKeyboard() {
        val imm = getSystemService(InputMethodManager::class.java)
        currentFocus?.let { imm.hideSoftInputFromWindow(it.windowToken, 0); it.clearFocus() }
    }
}

/** Signed-in screens: session, API, sign-out on 401, app updates. */
abstract class BaseActivity : ScreenActivity() {
    protected lateinit var session: Session
    protected lateinit var api: Api

    /** Call first in onCreate; false means there's no session and the activity is closing. */
    protected fun requireSession(): Boolean {
        session = Session(this)
        if (session.token == null) {
            goToLogin()
            return false
        }
        if (session.mustChangePassword && this !is PasswordActivity) {
            startActivity(Intent(this, PasswordActivity::class.java).putExtra(PasswordActivity.FORCED, true))
            finish()
            return false
        }
        api = Api(session)
        return true
    }

    /**
     * Runs an API call; a failure shows the server's reason ("Only the reviewer can …"), and a 401
     * goes back to sign-in. [busyLine] shows the loading line under the top bar meanwhile.
     */
    protected fun call(failTitle: String = "Not done", busyLine: Boolean = true, block: suspend () -> Unit) {
        lifecycleScope.launch {
            if (busyLine) busy(true)
            try {
                block()
            } catch (e: ApiException) {
                if (!handleAuth(e)) showError(failTitle, e.message)
            } finally {
                if (busyLine) busy(false)
            }
        }
    }

    // ── App updates (GitHub Releases, as in mess_soft) ──

    /** Automatic checks ([manual] = false) run at most every 6 hours and stay silent unless there is an update. */
    protected fun checkForUpdates(manual: Boolean) {
        val now = System.currentTimeMillis()
        if (!manual && now - session.lastUpdateCheck < 6 * 60 * 60 * 1000L) return
        val progress = if (manual) progressPopup("Checking for updates…").first else null
        lifecycleScope.launch {
            val installed = Updater.installedVersion(this@BaseActivity)
            try {
                val latest = Updater.latest()
                session.lastUpdateCheck = now
                progress?.dismiss()
                if (latest != null && Updater.isNewer(latest.version, installed)) offerUpdate(latest, installed)
                else if (manual) showError("You're up to date", "Version $installed is the latest.")
            } catch (e: Exception) {
                progress?.dismiss()
                if (manual) showError("Couldn't check for updates", "${e.message ?: "No connection"}\n\nInstalled version: $installed")
            }
        }
    }

    private fun offerUpdate(release: Updater.Release, installed: String) {
        val size = "%.1f".format(java.util.Locale.US, release.size / 1_048_576.0)
        val sheet = Sheet(this).title("Version ${release.version} is available", "You have $installed · $size MB download")
        if (release.notes.isNotEmpty()) sheet.message(release.notes.take(1500))
        sheet.button("Update now") { downloadAndInstall(release) }
        sheet.button("Later", ButtonKind.SECONDARY)
        sheet.show()
    }

    private fun downloadAndInstall(release: Updater.Release) {
        val (popup, label) = progressPopup("Downloading ${release.version}… 0%")
        lifecycleScope.launch {
            try {
                val apk = Updater.download(this@BaseActivity, release) { percent -> label.text = "Downloading ${release.version}… $percent%" }
                popup.dismiss()
                Updater.install(this@BaseActivity, apk)
            } catch (e: Exception) {
                popup.dismiss()
                Sheet(this@BaseActivity, centered = true).title("Update failed").message(e.message ?: "Download failed").apply {
                    buttonPair("Close", "Retry") { downloadAndInstall(release) }
                }.show()
            }
        }
    }

    // ── Session ──

    /** 401 → the token was revoked or expired (or the account deactivated): back to sign-in. */
    protected fun handleAuth(e: ApiException): Boolean {
        if (e.status != 401) return false
        session.signOut()
        toast("Signed out. Please sign in again.")
        goToLogin()
        return true
    }

    protected fun goToLogin() {
        startActivity(Intent(this, LoginActivity::class.java).addFlags(Intent.FLAG_ACTIVITY_CLEAR_TASK or Intent.FLAG_ACTIVITY_NEW_TASK))
        finish()
    }

    protected fun openTask(id: Int) = startActivity(Intent(this, TaskActivity::class.java).putExtra(TaskActivity.ID, id))

    /**
     * A move from a list (card button or swipe). Simple moves happen at once; moves that need a
     * reason, evidence or a hand-over note open the task with its move sheet.
     */
    protected fun quickMove(task: Task, move: Move, afterMove: () -> Unit) {
        if (task.needsMoveSheet(move)) {
            startActivity(Intent(this, TaskActivity::class.java).putExtra(TaskActivity.ID, task.id).putExtra(TaskActivity.MOVE, move.id))
            return
        }
        call("Not moved") {
            api.post("/tasks/${task.id}/transitions/${move.id}", org.json.JSONObject().put("comment", org.json.JSONObject.NULL))
            AppState.dirty = true
            toast("${task.reference}: ${move.label} ✓")
            afterMove()
        }
    }

    /** New task: in [projectId], or (0) the user picks the project on the form. */
    protected fun newTask(projectId: Int = 0) =
        startActivity(Intent(this, NewTaskActivity::class.java).putExtra(NewTaskActivity.PROJECT_ID, projectId))
}

// ── Colour helpers (status / tag / project swatches) ──

private val SWATCHES = setOf("gray", "blue", "sky", "green", "amber", "orange", "red", "purple", "pink")

fun android.content.Context.swatch(name: String?, part: String): Int {
    val key = if (name in SWATCHES) name else "gray"
    return getColor(resources.getIdentifier("sw_${key}_$part", "color", packageName))
}

/** Status / tag name on its colour (text is always shown, never colour alone). */
fun android.content.Context.colorPill(label: String, color: String?, small: Boolean = false) = TextView(this).apply {
    text = label
    textSize = if (small) 11f else 12f
    setTypeface(android.graphics.Typeface.DEFAULT, android.graphics.Typeface.BOLD)
    setTextColor(swatch(color, "fg"))
    background = GradientDrawable().apply { cornerRadius = dp(5).toFloat(); setColor(swatch(color, "bg")) }
    setPadding(dp(7), dp(2), dp(7), dp(2))
}

fun android.content.Context.dot(color: String?, size: Int = 8) = View(this).apply {
    background = GradientDrawable().apply { shape = GradientDrawable.OVAL; setColor(swatch(color, "dot")) }
    layoutParams = LinearLayout.LayoutParams(dp(size), dp(size))
}

/** Initials in a circle. */
fun android.content.Context.avatar(name: String?, size: Int = 26) = TextView(this).apply {
    text = Format.initials(name)
    textSize = size * 0.4f
    gravity = Gravity.CENTER
    setTypeface(android.graphics.Typeface.DEFAULT, android.graphics.Typeface.BOLD)
    setTextColor(getColor(R.color.muted))
    background = GradientDrawable().apply { shape = GradientDrawable.OVAL; setColor(getColor(R.color.bg)); setStroke(dp(1), getColor(R.color.border)) }
    layoutParams = LinearLayout.LayoutParams(dp(size), dp(size))
    contentDescription = name
}
