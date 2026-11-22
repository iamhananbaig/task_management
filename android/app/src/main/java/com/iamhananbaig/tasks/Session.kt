package com.iamhananbaig.tasks

import android.content.Context

/** Signed-in user and server address, kept across app restarts (app-private preferences). */
class Session(context: Context) {
    private val prefs = context.applicationContext.getSharedPreferences("session", Context.MODE_PRIVATE)

    var server: String
        get() = prefs.getString("server", "") ?: ""
        set(value) = prefs.edit().putString("server", value).apply()

    var email: String
        get() = prefs.getString("email", "") ?: ""
        set(value) = prefs.edit().putString("email", value).apply()

    val token: String? get() = prefs.getString("token", null)
    val userId: Int get() = prefs.getInt("user_id", 0)
    val userName: String get() = prefs.getString("user_name", "") ?: ""
    val roles: String get() = prefs.getString("roles", "") ?: ""
    val permissions: Set<String> get() = prefs.getStringSet("permissions", emptySet()) ?: emptySet()

    /** Must set their own password before using the app (new account / admin reset). */
    var mustChangePassword: Boolean
        get() = prefs.getBoolean("must_change_password", false)
        set(value) = prefs.edit().putBoolean("must_change_password", value).apply()

    /** Newest notification already shown on the phone (ISO time), so each shows once. */
    var lastAlertSeen: String
        get() = prefs.getString("last_alert_seen", "") ?: ""
        set(value) = prefs.edit().putString("last_alert_seen", value).apply()

    /** When the app last asked GitHub for an update (ms). */
    var lastUpdateCheck: Long
        get() = prefs.getLong("last_update_check", 0)
        set(value) = prefs.edit().putLong("last_update_check", value).apply()

    val apiBase: String get() = server.trimEnd('/') + "/api/v1"

    fun can(permission: String) = permission in permissions

    /** Stores the /user payload (from sign-in, /user or a password change). */
    fun saveUser(user: org.json.JSONObject) {
        val perms = user.optJSONArray("permissions")?.let { a -> (0 until a.length()).map { a.getString(it) }.toSet() } ?: emptySet()
        val roleNames = user.optJSONArray("roles").objects().joinToString(", ") { it.optString("name") }
        prefs.edit()
            .putInt("user_id", user.optInt("id"))
            .putString("user_name", user.optString("name"))
            .putString("roles", roleNames)
            .putStringSet("permissions", perms)
            .putBoolean("must_change_password", user.optBoolean("must_change_password"))
            .apply()
    }

    fun signIn(token: String, user: org.json.JSONObject) {
        prefs.edit().putString("token", token).apply()
        saveUser(user)
    }

    fun signOut() {
        prefs.edit().remove("token").remove("user_id").remove("user_name").remove("roles").remove("permissions")
            .remove("must_change_password").remove("last_alert_seen").apply()
    }

    companion object {
        /** "tasks.example.com" → "https://tasks.example.com"; drops a trailing /api/v1 or slash. */
        fun normalizeServer(input: String): String {
            var s = input.trim().trimEnd('/')
            if (s.isEmpty()) return s
            if (!s.startsWith("http://", ignoreCase = true) && !s.startsWith("https://", ignoreCase = true)) s = "https://$s"
            return s.removeSuffix("/api/v1").removeSuffix("/api").trimEnd('/')
        }
    }
}
