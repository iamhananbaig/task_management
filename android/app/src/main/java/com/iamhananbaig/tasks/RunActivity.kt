package com.iamhananbaig.tasks

/** One period of a routine ("November 2026 · Month-end close"): progress and its tasks. */
class RunActivity : ListScreen() {
    companion object { const val ID = "run_id" }

    private val runId by lazy { intent.getIntExtra(ID, 0) }

    override val emptyTitle = "No tasks in this period"

    override fun setUp() = topBar("Period")

    override suspend fun fetch(): List<Row> {
        val run = api.get("/runs/$runId").getJSONObject("data")
        val progress = run.optJSONObject("progress")
        topBar(run.optString("name"))
        val total = progress?.optInt("total") ?: 0
        val done = progress?.optInt("done") ?: 0
        topSummary("$done/$total done · ${progress?.optInt("review")} in review · ${progress?.optInt("overdue")} overdue")
        val tasks = api.get("/tasks", mapOf("routine_run_id" to runId, "per_page" to 200, "sort" to "due_date")).optJSONArray("data").objects().map { Task.from(it) }
        return listOf(Row.Note("${run.optJSONObject("project")?.optString("name")} · ${Format.date(run.optString("period_start"))} – ${Format.date(run.optString("period_end"))}")) +
            tasks.map { Row.TaskItem(it, showProject = false) }
    }
}
