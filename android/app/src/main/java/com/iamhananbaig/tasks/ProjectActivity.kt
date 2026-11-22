package com.iamhananbaig.tasks

import android.content.Intent

/** A project's tasks grouped by status (the board as a list). Everyone / Mine / Unassigned; + new task. */
class ProjectActivity : ListScreen() {
    companion object { const val ID = "project_id" }

    private val projectId by lazy { intent.getIntExtra(ID, 0) }
    private var assignee = ""
    private var project: Project? = null

    override val emptyTitle = "No tasks"

    override fun setUp() {
        topBar("Project")
        showFilters()
        buildFilters()
    }

    private fun buildFilters() {
        filters.removeAllViews()
        listOf("" to "Everyone", "me" to "Mine", "none" to "Unassigned").forEach { (value, label) ->
            filters.addView(chip(label, assignee == value) { assignee = value; buildFilters(); reload() })
        }
        Fonts.apply(filters)
    }

    override suspend fun fetch(): List<Row> {
        val p = Project.from(api.get("/projects/$projectId").getJSONObject("data"))
        project = p
        topBar(p.name)
        topSummary("${p.key} · ${p.done} of ${p.open + p.done} done" + if (p.overdue > 0) " · ${p.overdue} overdue" else "")
        clearTopActions()
        if (p.canCreateTasks) addTopAction(R.drawable.ic_add, "New task") {
            startActivity(Intent(this, NewTaskActivity::class.java).putExtra(NewTaskActivity.PROJECT_ID, p.id))
        }
        val tasks = api.get("/projects/$projectId/tasks", mapOf("assignee" to assignee)).optJSONArray("data").objects().map { Task.from(it) }
        return p.statuses.flatMap { status ->
            val inStatus = tasks.filter { it.status?.id == status.id }
            if (inStatus.isEmpty()) emptyList() else listOf(Row.Header(status.name, inStatus.size, status.color)) + inStatus.map { Row.TaskItem(it, showProject = false) }
        }
    }
}
