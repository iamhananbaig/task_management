package com.iamhananbaig.tasks

import android.content.Intent
import android.os.Bundle
import android.text.InputType
import android.view.View
import android.widget.Button
import android.widget.LinearLayout
import org.json.JSONObject

/** Change your password (PUT /user/password). FORCED: a new account / admin reset must do this first. */
class PasswordActivity : BaseActivity() {
    companion object { const val FORCED = "forced" }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        if (!requireSession()) return
        val forced = intent.getBooleanExtra(FORCED, false)
        setContentView(R.layout.activity_detail)
        topBar(if (forced) "Set a new password" else "Change password", back = !forced)
        findViewById<View>(R.id.refresh).isEnabled = false

        val content = findViewById<LinearLayout>(R.id.content)
        content.addView(text(
            if (forced) "${session.userName}, your password was set by an administrator. Choose your own before continuing."
            else "Other phones and browsers signed in to your account are signed out.", 15f, R.color.muted))
        val password = InputType.TYPE_CLASS_TEXT or InputType.TYPE_TEXT_VARIATION_PASSWORD
        val current = field("Current password", password)
        val next = field("New password", password)
        val confirm = field("Repeat new password", password)
        content.addView(label("Current password")); content.addView(current)
        content.addView(label("New password")); content.addView(next)
        content.addView(text("At least 10 characters, with letters and numbers.", 13f, R.color.muted).apply { setPadding(0, dp(6), 0, 0) })
        content.addView(label("Repeat new password")); content.addView(confirm)
        if (forced) content.addView(button("Sign out", ButtonKind.SECONDARY) {
            session.signOut(); goToLogin()
        }, lp(height = dp(48)).apply { topMargin = dp(24) })

        findViewById<View>(R.id.bottomBar).visibility = View.VISIBLE
        val save = findViewById<Button>(R.id.bottomButton)
        save.text = if (forced) "Save and continue" else "Change password"
        save.setOnClickListener {
            hideKeyboard()
            if (next.text.toString() != confirm.text.toString()) return@setOnClickListener showError("Check the new password", "The new passwords do not match.")
            save.isEnabled = false
            call("Password not changed") {
                try {
                    val user = api.put("/user/password", JSONObject()
                        .put("current_password", current.text.toString())
                        .put("password", next.text.toString())
                        .put("password_confirmation", confirm.text.toString()))
                    session.saveUser(user)
                    toast("Password changed")
                    if (forced) startActivity(Intent(this, MainActivity::class.java))
                    finish()
                } finally {
                    save.isEnabled = true
                }
            }
        }
    }
}
