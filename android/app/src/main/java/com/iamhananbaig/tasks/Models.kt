package com.iamhananbaig.tasks

import org.json.JSONArray
import org.json.JSONObject

/** Shapes returned by /api/v1 (see backend app/Http/Resources). Only the fields the app uses. */

data class Person(val id: Int, val name: String, val email: String, val projectRole: String?) {
    companion object {
        fun from(json: JSONObject?): Person? = json?.takeIf { it.has("id") }?.let {
            Person(it.optInt("id"), it.optString("name"), it.optString("email"), it.optStringOrNull("project_role"))
        }
    }
}

data class Status(val id: Int, val name: String, val color: String, val type: String) {
    val isDone get() = type == "done"
    companion object {
        fun from(json: JSONObject?): Status? = json?.takeIf { it.has("id") }?.let {
            Status(it.optInt("id"), it.optString("name"), it.optString("color", "gray"), it.optString("type"))
        }
    }
}

data class Move(val id: Int, val label: String, val toStatusId: Int, val requiresComment: Boolean, val requiresAttachment: Boolean, val toType: String? = null) {
    /** Send back, pull back, reopen…: shown as a secondary action. */
    val isBackward get() = Regex("back|reopen|reject|return", RegexOption.IGNORE_CASE).containsMatchIn(label)
}

data class Tag(val id: Int, val name: String, val color: String, val groupId: Int, val active: Boolean = true)

data class Attachment(val id: Int, val name: String, val mimeType: String?, val size: Long, val by: String?, val createdAt: String)

data class ChecklistItem(val id: Int, val title: String, val done: Boolean)

data class Task(
    val id: Int,
    val reference: String,
    val title: String,
    val description: String?,
    val projectId: Int,
    val projectName: String,
    val projectColor: String,
    val status: Status?,
    val priority: String,
    val assignee: Person?,
    val reviewer: Person?,
    val creator: Person?,
    val dueDate: String?,
    val completedAt: String?,
    val tags: List<Tag>,
    val run: Pair<Int, String>?,
    val checklistTotal: Int,
    val checklistDone: Int,
    val commentsCount: Int,
    val attachmentsCount: Int,
    val moves: List<Move>,
    // detail only
    val checklist: List<ChecklistItem>,
    val attachments: List<Attachment>,
    val watching: Boolean,
    val canUpdate: Boolean,
    val canDelete: Boolean,
    val canComment: Boolean,
    val canRemind: Boolean,
) {
    val isDone get() = status?.isDone == true

    /** Checklist items not yet ticked (detail has the items, list rows only the counts). */
    val openChecklist get() = if (checklist.isNotEmpty()) checklist.count { !it.done } else maxOf(0, checklistTotal - checklistDone)
    val fileCount get() = if (attachments.isNotEmpty()) attachments.size else attachmentsCount

    /** The main forward move (Start, Submit for review, Approve), for one-tap buttons and swipes. */
    val primaryMove get() = moves.firstOrNull { !it.isBackward }

    /**
     * Whether a move should open the move sheet instead of happening at once: a required reason or
     * document, every hand-over for review, and finishing with open checklist items. Same rule as the web.
     */
    fun needsMoveSheet(move: Move): Boolean = move.requiresComment ||
        (move.requiresAttachment && fileCount == 0) ||
        move.toType == "review" ||
        (move.toType == "done" && openChecklist > 0)

    companion object {
        fun from(j: JSONObject): Task {
            val project = j.optJSONObject("project") ?: JSONObject()
            val can = j.optJSONObject("can")
            return Task(
                id = j.optInt("id"),
                reference = j.optString("reference"),
                title = j.optString("title"),
                description = j.optStringOrNull("description"),
                projectId = project.optInt("id"),
                projectName = project.optString("name"),
                projectColor = project.optString("color", "gray"),
                status = Status.from(j.optJSONObject("status")),
                priority = j.optString("priority", "medium"),
                assignee = Person.from(j.optJSONObject("assignee")),
                reviewer = Person.from(j.optJSONObject("reviewer")),
                creator = Person.from(j.optJSONObject("creator")),
                dueDate = j.optStringOrNull("due_date"),
                completedAt = j.optStringOrNull("completed_at"),
                tags = j.optJSONArray("tags").objects().map { Tag(it.optInt("id"), it.optString("name"), it.optString("color", "gray"), it.optInt("tag_group_id")) },
                run = j.optJSONObject("routine_run")?.let { it.optInt("id") to it.optString("name") },
                checklistTotal = j.optInt("checklist_total"),
                checklistDone = j.optInt("checklist_done"),
                commentsCount = j.optInt("comments_count"),
                attachmentsCount = j.optInt("attachments_count"),
                moves = j.optJSONArray("available_transitions").objects().map {
                    Move(it.optInt("id"), it.optString("label"), it.optInt("to_status_id"), it.optBoolean("requires_comment"), it.optBoolean("requires_attachment"), it.optString("to_type").takeIf { t -> t.isNotEmpty() && t != "null" })
                },
                checklist = j.optJSONArray("checklist").objects().map { ChecklistItem(it.optInt("id"), it.optString("title"), it.optBoolean("is_done")) },
                attachments = j.optJSONArray("attachments").objects().map {
                    Attachment(it.optInt("id"), it.optString("original_name"), it.optStringOrNull("mime_type"), it.optLong("size"),
                        it.optJSONObject("user")?.optString("name"), it.optString("created_at"))
                },
                watching = j.optBoolean("is_watching"),
                canUpdate = can?.optBoolean("update") == true,
                canDelete = can?.optBoolean("delete") == true,
                canComment = can?.optBoolean("comment") == true,
                canRemind = can?.optBoolean("remind") == true,
            )
        }
    }
}

data class Project(
    val id: Int,
    val name: String,
    val key: String,
    val color: String,
    val restricted: Boolean,
    val open: Int,
    val done: Int,
    val overdue: Int,
    val statuses: List<Status>,
    val members: List<Person>,
    val canCreateTasks: Boolean,
) {
    companion object {
        fun from(j: JSONObject) = Project(
            id = j.optInt("id"),
            name = j.optString("name"),
            key = j.optString("key"),
            color = j.optString("color", "gray"),
            restricted = j.optBoolean("is_restricted"),
            open = j.optInt("open_tasks_count"),
            done = j.optInt("done_tasks_count"),
            overdue = j.optInt("overdue_tasks_count"),
            statuses = j.optJSONArray("statuses").objects().mapNotNull { Status.from(it) },
            members = j.optJSONArray("members").objects().mapNotNull { Person.from(it) },
            canCreateTasks = j.optJSONObject("can")?.optBoolean("create_tasks") == true,
        )
    }
}

data class Alert(val id: String, val kind: String, val title: String, val body: String, val taskId: Int, val runId: Int, val read: Boolean, val createdAt: String) {
    companion object {
        fun from(j: JSONObject): Alert {
            val data = j.optJSONObject("data") ?: JSONObject()
            return Alert(j.optString("id"), data.optString("kind"), data.optString("title"), data.optString("body"),
                data.optInt("task_id"), data.optInt("run_id"), !j.isNull("read_at"), j.optString("created_at"))
        }
    }
}

val PRIORITIES = listOf("urgent" to "Urgent", "high" to "High", "medium" to "Medium", "low" to "Low")
fun priorityLabel(value: String) = PRIORITIES.firstOrNull { it.first == value }?.second ?: value

fun JSONArray?.objects(): List<JSONObject> =
    if (this == null) emptyList() else (0 until length()).mapNotNull { optJSONObject(it) }

fun JSONObject.optStringOrNull(key: String): String? =
    if (isNull(key)) null else optString(key).takeIf { it.isNotEmpty() }
