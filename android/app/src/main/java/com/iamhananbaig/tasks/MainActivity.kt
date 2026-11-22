package com.iamhananbaig.tasks

import android.Manifest
import android.content.Intent
import android.content.pm.PackageManager
import android.content.res.ColorStateList
import android.os.Build
import android.os.Bundle
import android.view.Gravity
import android.view.View
import android.widget.EditText
import android.widget.FrameLayout
import android.widget.ImageView
import android.widget.LinearLayout
import android.widget.ScrollView
import android.widget.TextView
import androidx.core.widget.doAfterTextChanged
import androidx.recyclerview.widget.LinearLayoutManager
import androidx.recyclerview.widget.RecyclerView
import androidx.swiperefreshlayout.widget.SwipeRefreshLayout
import kotlinx.coroutines.async
import kotlinx.coroutines.coroutineScope

/** Home: My tasks · Projects · Alerts · Me, switched by the bottom tab bar. */
class MainActivity : BaseActivity() {
    private enum class Tab(val label: String, val icon: Int) {
        MY_TASKS("My tasks", R.drawable.ic_checklist),
        PROJECTS("Projects", R.drawable.ic_folder),
        ALERTS("Alerts", R.drawable.ic_notifications),
        ME("Me", R.drawable.ic_person),
    }

    private var tab = Tab.MY_TASKS
    private val tabViews = mutableMapOf<Tab, View>()
    private var alertBadge: TextView? = null

    // My tasks filters
    private var reviewMode = false
    private var due = ""

    // Last loaded data per tab, filtered locally by the search box
    private var tasks: List<Task> = emptyList()
    private var projects: List<Project> = emptyList()
    private var alerts: List<Alert> = emptyList()
    private var query = ""
    /** Whether the user may add tasks anywhere (shows the "+" button); loaded once. */
    private var canCreate: Boolean? = null

    private lateinit var page: FrameLayout
    private var list: ListPage? = null

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        if (!requireSession()) return
        setContentView(R.layout.activity_main)
        page = findViewById(R.id.page)
        buildTabs()
        intent.getStringExtra(EXTRA_TAB)?.let { name -> Tab.entries.firstOrNull { it.name == name }?.let { tab = it } }
        show(tab)

        AlertsWorker.schedule(this)
        if (Build.VERSION.SDK_INT >= 33 && checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
            requestPermissions(arrayOf(Manifest.permission.POST_NOTIFICATIONS), 1)
        }
        checkForUpdates(manual = false)
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        intent.getStringExtra(EXTRA_TAB)?.let { name -> Tab.entries.firstOrNull { it.name == name }?.let { show(it) } }
    }

    override fun onResume() {
        super.onResume()
        // Coming back from a task: show its new status, counts and badges
        if (::page.isInitialized && page.childCount > 0) load(quiet = true)
    }

    private fun buildTabs() {
        val bar = findViewById<LinearLayout>(R.id.tabs)
        Tab.entries.forEach { t ->
            val item = LinearLayout(this).apply {
                orientation = LinearLayout.VERTICAL
                gravity = Gravity.CENTER
                setBackgroundResource(R.drawable.ripple_row)
                contentDescription = t.label
                setOnClickListener { show(t) }
            }
            val iconBox = FrameLayout(this)
            iconBox.addView(ImageView(this).apply { setImageResource(t.icon); tag = "icon" }, FrameLayout.LayoutParams(dp(24), dp(24), Gravity.CENTER))
            if (t == Tab.ALERTS) {
                alertBadge = text("", 10f, R.color.surface, bold = true).apply {
                    gravity = Gravity.CENTER
                    minWidth = dp(16)
                    setPadding(dp(4), 0, dp(4), 0)
                    setBackgroundResource(R.drawable.qty_badge)
                    backgroundTintList = ColorStateList.valueOf(getColor(R.color.danger))
                    visibility = View.GONE
                }
                iconBox.addView(alertBadge, FrameLayout.LayoutParams(FrameLayout.LayoutParams.WRAP_CONTENT, dp(16), Gravity.TOP or Gravity.END))
            }
            item.addView(iconBox, LinearLayout.LayoutParams(dp(56), dp(28)))
            item.addView(text(t.label, 12f, bold = true).apply { tag = "label"; gravity = Gravity.CENTER }, LinearLayout.LayoutParams(LinearLayout.LayoutParams.WRAP_CONTENT, LinearLayout.LayoutParams.WRAP_CONTENT))
            bar.addView(item, LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.MATCH_PARENT, 1f))
            tabViews[t] = item
        }
    }

    private fun show(next: Tab) {
        tab = next
        tabViews.forEach { (t, v) ->
            val color = getColor(if (t == next) R.color.primary else R.color.muted)
            v.findViewWithTag<ImageView>("icon").imageTintList = ColorStateList.valueOf(color)
            v.findViewWithTag<TextView>("label").setTextColor(color)
        }
        clearTopActions()
        topSummary(null)
        topBar(next.label, back = false)
        page.removeAllViews()
        list = null
        when (next) {
            Tab.ME -> showMe()
            else -> {
                val view = layoutInflater.inflate(R.layout.page_list, page, false)
                page.addView(view)
                list = ListPage(view)
                query = ""
                if (next == Tab.ALERTS) addTopAction(R.drawable.ic_check, "Mark all read") { markAllRead() }
                if (next == Tab.MY_TASKS || next == Tab.PROJECTS) addTopAction(R.drawable.ic_search, "Search") { toggleSearch() }
                if (next == Tab.MY_TASKS) buildTaskFilters()
                list?.fab?.visibility = if (canCreate == true && next != Tab.ALERTS) View.VISIBLE else View.GONE
                list?.state?.loading("Loading…")
                load()
            }
        }
        Fonts.apply(page)
    }

    /** The list part of a tab: filters, pull-to-refresh, rows, and the loading / empty / error state. */
    private inner class ListPage(root: View) {
        val filters: LinearLayout = root.findViewById(R.id.filters)
        val filtersScroll: View = root.findViewById(R.id.filtersScroll)
        val refresh: SwipeRefreshLayout = root.findViewById<SwipeRefreshLayout>(R.id.refresh).apply {
            setColorSchemeColors(getColor(R.color.primary))
            setOnRefreshListener { load(quiet = true) }
        }
        val adapter = RowAdapter(
            onTask = { openTask(it.id) },
            onProject = { startActivity(Intent(this@MainActivity, ProjectActivity::class.java).putExtra(ProjectActivity.ID, it.id)) },
            onAlert = { openAlert(it) },
            onMove = { task, move -> quickMove(task, move) { load(quiet = true) } },
        )
        val state = StateView(root)
        val search: EditText = root.findViewById(R.id.search)
        val offline: TextView = root.findViewById(R.id.offline)
        val fab: View = root.findViewById(R.id.fab)

        init {
            root.findViewById<RecyclerView>(R.id.list).apply {
                layoutManager = LinearLayoutManager(this@MainActivity)
                adapter = this@ListPage.adapter
                swipeToMove(this@ListPage.adapter) { task, move -> quickMove(task, move) { load(quiet = true) } }
            }
            search.doAfterTextChanged {
                query = it?.toString().orEmpty().trim()
                showRows()
            }
            fab.setOnClickListener { newTask() }
        }
    }

    private fun buildTaskFilters() {
        val page = list ?: return
        page.filtersScroll.visibility = View.VISIBLE
        page.filters.removeAllViews()
        page.filters.addView(chip("Assigned to me", !reviewMode) { reviewMode = false; buildTaskFilters(); load() })
        page.filters.addView(chip("To review", reviewMode) { reviewMode = true; buildTaskFilters(); load() })
        if (!reviewMode) {
            page.filters.addView(View(this), LinearLayout.LayoutParams(dp(1), dp(24)).apply { marginEnd = dp(8) })
            listOf("" to "All", "overdue" to "Overdue", "today" to "Today", "week" to "Next 7 days", "none" to "No date").forEach { (value, label) ->
                page.filters.addView(chip(label, due == value) { due = value; buildTaskFilters(); load() })
            }
        }
        Fonts.apply(page.filters)
    }

    private fun load(quiet: Boolean = false) {
        val current = tab
        if (current == Tab.ME) return
        val page = list ?: return
        call("Couldn't load", busyLine = quiet) {
            try {
                coroutineScope {
                    val unread = async { api.get("/notifications", mapOf("unread" to true)).optInt("unread") }
                    val creatable = if (canCreate == null && current != Tab.PROJECTS) async {
                        api.get("/projects").optJSONArray("data").objects().any { Project.from(it).canCreateTasks }
                    } else null
                    when (current) {
                        Tab.MY_TASKS -> tasks = loadMyTasks()
                        Tab.PROJECTS -> projects = api.get("/projects").optJSONArray("data").objects().map { Project.from(it) }
                            .also { all -> canCreate = all.any { it.canCreateTasks } }
                        Tab.ALERTS -> alerts = api.get("/notifications").optJSONArray("data").objects().map { Alert.from(it) }
                        Tab.ME -> Unit
                    }
                    creatable?.let { canCreate = it.await() }
                    setAlertBadge(unread.await())
                }
                if (tab != current) return@call
                page.offline.visibility = View.GONE
                page.fab.visibility = if (canCreate == true && current != Tab.ALERTS) View.VISIBLE else View.GONE
                showRows()
            } catch (e: ApiException) {
                when {
                    e.status == 401 -> throw e
                    page.adapter.rows.isEmpty() -> page.state.error(e) { page.state.loading("Loading…"); load() }
                    // Keep showing what was loaded; say so instead of a pop-up
                    e.status == 0 -> page.offline.apply {
                        text = "Offline — showing what was loaded earlier. Pull down to try again."
                        visibility = View.VISIBLE
                    }
                    else -> throw e
                }
            } finally {
                page.refresh.isRefreshing = false
            }
        }
    }

    /** Builds the current tab's rows from the loaded data and the search text. */
    private fun showRows() {
        val page = list ?: return
        val q = query.lowercase()
        fun matches(vararg fields: String?) = q.isEmpty() || fields.any { it?.lowercase()?.contains(q) == true }

        val rows: List<Row> = when (tab) {
            Tab.MY_TASKS -> {
                val shown = tasks.filter { matches(it.title, it.reference, it.projectName) }
                when {
                    reviewMode -> shown.map { Row.TaskItem(it, showProject = true, showAssignee = true) }
                    due.isEmpty() -> groupByDue(shown)
                    else -> shown.map { Row.TaskItem(it, showProject = true, showAssignee = false) }
                }
            }
            Tab.PROJECTS -> projects.filter { matches(it.name, it.key) }.map { Row.ProjectItem(it) }
            Tab.ALERTS -> alerts.groupBy { dayGroup(it.createdAt) }.flatMap { (label, items) -> listOf(Row.Header(label)) + items.map { Row.AlertItem(it) } }
            Tab.ME -> emptyList()
        }
        page.adapter.rows = rows
        if (rows.isNotEmpty()) return page.state.hide()

        when {
            query.isNotEmpty() -> page.state.empty(R.drawable.ic_search, "No matches", "Nothing matches “$query”.")
            tab == Tab.MY_TASKS && reviewMode -> page.state.empty(R.drawable.ic_checklist, "Nothing to review", "Tasks submitted to you for review appear here, with Approve and Send back.")
            tab == Tab.MY_TASKS && due.isNotEmpty() -> page.state.empty(R.drawable.ic_checklist, "No tasks match", "Try another filter.", "Show all") { due = ""; buildTaskFilters(); load() }
            tab == Tab.MY_TASKS -> page.state.empty(R.drawable.ic_check_circle, "You're all caught up", "No open tasks are assigned to you.",
                if (canCreate == true) "New task" else null) { newTask() }
            tab == Tab.PROJECTS -> page.state.empty(R.drawable.ic_folder, "No projects", "Ask a manager to add you to a project.")
            else -> page.state.empty(R.drawable.ic_notifications, "You're all caught up", null)
        }
    }

    /** "Today", "Yesterday", "Earlier this week", "Older" (by the phone's date). */
    private fun dayGroup(iso: String): String {
        val day = runCatching { java.time.OffsetDateTime.parse(iso).atZoneSameInstant(java.time.ZoneId.systemDefault()).toLocalDate() }.getOrNull()
            ?: return "Older"
        val days = java.time.temporal.ChronoUnit.DAYS.between(day, java.time.LocalDate.now())
        return when {
            days <= 0 -> "Today"
            days == 1L -> "Yesterday"
            days < 7 -> "Earlier this week"
            else -> "Older"
        }
    }

    private fun toggleSearch() {
        val page = list ?: return
        val search = page.search
        if (search.visibility == View.VISIBLE) {
            search.setText("")
            search.visibility = View.GONE
            hideKeyboard()
        } else {
            search.hint = if (tab == Tab.PROJECTS) "Search projects" else "Search tasks"
            search.visibility = View.VISIBLE
            search.requestFocus()
            getSystemService(android.view.inputmethod.InputMethodManager::class.java).showSoftInput(search, 0)
        }
    }

    private suspend fun loadMyTasks(): List<Task> = coroutineScope {
        val dashboard = async { api.get("/dashboard").optJSONObject("counts") }
        val query = if (reviewMode) mapOf("reviewer" to "me", "status_type" to "review", "per_page" to 200)
            else mapOf("assignee" to "me", "due" to due, "sort" to "due_date", "per_page" to 200)
        val loaded = api.get("/tasks", query).optJSONArray("data").objects().map { Task.from(it) }
        dashboard.await()?.let { c ->
            topSummary("${c.optInt("open")} open · ${c.optInt("overdue")} overdue · ${c.optInt("to_review")} to review")
        }
        loaded
    }

    private fun setAlertBadge(count: Int) {
        alertBadge?.apply {
            text = if (count > 99) "99+" else count.toString()
            visibility = if (count > 0) View.VISIBLE else View.GONE
        }
    }

    private fun openAlert(alert: Alert) {
        if (!alert.read) call(busyLine = false) { api.post("/notifications/${alert.id}/read") }
        when {
            alert.taskId > 0 -> openTask(alert.taskId)
            alert.runId > 0 -> startActivity(Intent(this, RunActivity::class.java).putExtra(RunActivity.ID, alert.runId))
        }
    }

    private fun markAllRead(): Unit = call {
        api.post("/notifications/read-all")
        load(quiet = true)
    }

    private fun showMe() {
        val scroll = ScrollView(this)
        val box = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(dp(16), dp(16), dp(16), dp(24))
        }
        scroll.addView(box)
        page.addView(scroll)

        box.addView(LinearLayout(this).apply {
            gravity = Gravity.CENTER_VERTICAL
            setBackgroundResource(R.drawable.card)
            setPadding(dp(14), dp(14), dp(14), dp(14))
            addView(avatar(session.userName, 48), LinearLayout.LayoutParams(dp(48), dp(48)).apply { marginEnd = dp(14) })
            addView(LinearLayout(context).apply {
                orientation = LinearLayout.VERTICAL
                addView(text(session.userName, 18f, bold = true))
                addView(text(session.email, 14f, R.color.muted))
                addView(text(session.roles.ifEmpty { "No role" }.replaceFirstChar { it.uppercase() }, 13f, R.color.muted))
            }, lp(0, weight = 1f))
        })

        box.addView(label("Account").apply { setPadding(0, dp(20), 0, dp(6)) })
        box.addView(menuRow(R.drawable.ic_lock, "Change password") { startActivity(Intent(this, PasswordActivity::class.java)) })
        box.addView(menuRow(R.drawable.ic_system_update, "Check for updates", detail = "v${Updater.installedVersion(this)}") { checkForUpdates(manual = true) })
        box.addView(menuRow(R.drawable.ic_logout, "Sign out", color = R.color.danger) {
            confirm("Sign out?", "This phone stops showing your notifications.", "Sign out", danger = true) { signOut() }
        })

        box.addView(label("About").apply { setPadding(0, dp(20), 0, dp(6)) })
        box.addView(text("Server: ${session.server}", 13f, R.color.muted))
        box.addView(text("Alerts are checked about every 15 minutes in the background.", 13f, R.color.muted).apply { setPadding(0, dp(4), 0, 0) })
    }

    private fun signOut(): Unit = call {
        try { api.post("/logout") } catch (_: ApiException) { /* signed out locally either way */ }
        AlertsWorker.cancel(this)
        session.signOut()
        goToLogin()
    }

    companion object {
        const val EXTRA_TAB = "tab"
    }
}
