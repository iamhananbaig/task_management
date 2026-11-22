package com.iamhananbaig.tasks

import android.os.Bundle
import android.view.View
import android.widget.LinearLayout
import androidx.recyclerview.widget.LinearLayoutManager
import androidx.recyclerview.widget.RecyclerView
import androidx.swiperefreshlayout.widget.SwipeRefreshLayout

/** A signed-in list screen (activity_page): top bar, filter chips, pull-to-refresh rows, state view. */
abstract class ListScreen : BaseActivity() {
    protected lateinit var filters: LinearLayout
    protected lateinit var refresh: SwipeRefreshLayout
    protected lateinit var state: StateView
    protected val adapter = RowAdapter(onTask = { openTask(it.id) }, onMove = { task, move -> quickMove(task, move) { reload(quiet = true) } })
    private var loadedOnce = false

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        if (!requireSession()) return
        setContentView(R.layout.activity_page)
        filters = findViewById(R.id.filters)
        refresh = findViewById<SwipeRefreshLayout>(R.id.refresh).apply {
            setColorSchemeColors(getColor(R.color.primary))
            setOnRefreshListener { reload(quiet = true) }
        }
        state = StateView(findViewById(android.R.id.content))
        findViewById<RecyclerView>(R.id.list).apply {
            layoutManager = LinearLayoutManager(this@ListScreen)
            adapter = this@ListScreen.adapter
            swipeToMove(this@ListScreen.adapter) { task, move -> quickMove(task, move) { reload(quiet = true) } }
        }
        setUp()
        state.loading("Loading…")
        reload()
    }

    override fun onResume() {
        super.onResume()
        if (loadedOnce) reload(quiet = true)
    }

    protected fun showFilters() { findViewById<View>(R.id.filtersScroll).visibility = View.VISIBLE }

    /** The round "+" button over the list. */
    protected fun showFab(description: String, onClick: () -> Unit) = findViewById<View>(R.id.fab).apply {
        visibility = View.VISIBLE
        contentDescription = description
        setOnClickListener { onClick() }
    }

    /** Top bar, filters. Called once before the first load. */
    protected abstract fun setUp()

    /** Fetch and return the rows (throws ApiException). */
    protected abstract suspend fun fetch(): List<Row>

    protected open val emptyTitle = "Nothing here"
    protected open val emptyMessage: String? = null

    protected fun reload(quiet: Boolean = false) {
        if (!::state.isInitialized) return
        call("Couldn't load", busyLine = quiet) {
            try {
                val rows = fetch()
                loadedOnce = true
                adapter.rows = rows
                if (rows.isEmpty()) state.empty(R.drawable.ic_checklist, emptyTitle, emptyMessage) else state.hide()
            } catch (e: ApiException) {
                if (adapter.rows.isEmpty() && e.status != 401) state.error(e) { state.loading("Loading…"); reload() } else throw e
            } finally {
                refresh.isRefreshing = false
            }
        }
    }
}
