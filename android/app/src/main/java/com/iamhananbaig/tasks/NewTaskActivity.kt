package com.iamhananbaig.tasks

import android.app.DatePickerDialog
import android.os.Bundle
import android.text.InputType
import android.view.View
import android.widget.Button
import android.widget.LinearLayout
import android.widget.TextView
import org.json.JSONObject
import java.time.LocalDate

/** New task in a project. It starts in the project's first status. */
class NewTaskActivity : BaseActivity() {
    companion object { const val PROJECT_ID = "project_id" }

    private val projectId by lazy { intent.getIntExtra(PROJECT_ID, 0) }
    private var members: List<Person> = emptyList()
    private var assignee: Int? = null
    private var reviewer: Int? = null
    private var priority = "medium"
    private var due: String? = null

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        if (!requireSession()) return
        setContentView(R.layout.activity_detail)
        topBar("New task")
        findViewById<View>(R.id.refresh).isEnabled = false
        val content = findViewById<LinearLayout>(R.id.content)

        val title = field("What needs doing?", InputType.TYPE_CLASS_TEXT or InputType.TYPE_TEXT_FLAG_CAP_SENTENCES)
        val description = field("Details (optional)", InputType.TYPE_CLASS_TEXT or InputType.TYPE_TEXT_FLAG_MULTI_LINE or InputType.TYPE_TEXT_FLAG_CAP_SENTENCES, 20000).apply { minLines = 3; gravity = android.view.Gravity.TOP }
        content.addView(label("Title")); content.addView(title)
        content.addView(label("Description")); content.addView(description)

        fun pickerRow(labelText: String, value: () -> String, onTap: () -> Unit): TextView {
            content.addView(label(labelText))
            val view = text(value(), 17f).apply {
                setBackgroundResource(R.drawable.field)
                minHeight = dp(52)
                gravity = android.view.Gravity.CENTER_VERTICAL
                setPadding(dp(14), 0, dp(14), 0)
                setOnClickListener { onTap() }
            }
            content.addView(view, lp())
            return view
        }
        fun nameOf(id: Int?) = members.firstOrNull { it.id == id }?.name ?: "Nobody"

        lateinit var assigneeView: TextView
        lateinit var reviewerView: TextView
        lateinit var priorityView: TextView
        lateinit var dueView: TextView
        fun people() = listOf("" to "Nobody") + members.map { it.id.toString() to (if (it.id == session.userId) "Me (${it.name})" else it.name) }
        assigneeView = pickerRow("Assignee", { "…" }) { choose("Assignee", people(), assignee?.toString() ?: "") { assignee = it.toIntOrNull(); assigneeView.text = nameOf(assignee) } }
        reviewerView = pickerRow("Reviewer", { "Nobody" }) { choose("Reviewer", people(), reviewer?.toString() ?: "") { reviewer = it.toIntOrNull(); reviewerView.text = nameOf(reviewer) } }
        priorityView = pickerRow("Priority", { priorityLabel(priority) }) { choose("Priority", PRIORITIES, priority) { priority = it; priorityView.text = priorityLabel(it) } }
        dueView = pickerRow("Due date", { "None" }) {
            val start = due?.let { LocalDate.parse(it) } ?: LocalDate.now()
            DatePickerDialog(this, { _, y, m, d -> due = LocalDate.of(y, m + 1, d).toString(); dueView.text = Format.date(due) }, start.year, start.monthValue - 1, start.dayOfMonth).apply {
                setButton(DatePickerDialog.BUTTON_NEUTRAL, "None") { _, _ -> due = null; dueView.text = "None" }
            }.show()
        }

        call("Couldn't load the project") {
            val project = Project.from(api.get("/projects/$projectId").getJSONObject("data"))
            topSummary(project.name)
            members = project.members
            // Assign to yourself by default when you're a member
            assignee = members.firstOrNull { it.id == session.userId }?.id
            assigneeView.text = nameOf(assignee)
        }

        findViewById<View>(R.id.bottomBar).visibility = View.VISIBLE
        val create = findViewById<Button>(R.id.bottomButton)
        create.text = "Create task"
        create.setOnClickListener {
            val name = title.text.toString().trim()
            if (name.isEmpty()) return@setOnClickListener toast("Enter a title")
            hideKeyboard()
            create.isEnabled = false
            call("Task not created") {
                try {
                    val res = api.post("/projects/$projectId/tasks", JSONObject()
                        .put("title", name)
                        .put("description", description.text.toString().trim().ifEmpty { JSONObject.NULL })
                        .put("priority", priority)
                        .put("assignee_id", assignee ?: JSONObject.NULL)
                        .put("reviewer_id", reviewer ?: JSONObject.NULL)
                        .put("due_date", due ?: JSONObject.NULL))
                    AppState.dirty = true
                    openTask(res.getJSONObject("data").getInt("id"))
                    finish()
                } finally {
                    create.isEnabled = true
                }
            }
        }
    }
}
