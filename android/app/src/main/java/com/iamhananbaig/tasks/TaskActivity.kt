package com.iamhananbaig.tasks

import android.app.DatePickerDialog
import android.content.ActivityNotFoundException
import android.content.Intent
import android.content.res.ColorStateList
import android.graphics.Paint
import android.net.Uri
import android.os.Bundle
import android.provider.OpenableColumns
import android.view.Gravity
import android.widget.CheckBox
import android.widget.ImageView
import android.widget.LinearLayout
import androidx.activity.result.contract.ActivityResultContracts
import androidx.core.content.FileProvider
import androidx.swiperefreshlayout.widget.SwipeRefreshLayout
import org.json.JSONArray
import org.json.JSONObject
import java.io.File
import java.time.LocalDate

/** Everything about one task: workflow moves, people, dates, tags, checklist, files, comments. */
class TaskActivity : BaseActivity() {
    companion object { const val ID = "task_id" }

    private val currentTaskId by lazy { intent.getIntExtra(ID, 0) }
    private lateinit var content: LinearLayout
    private lateinit var refresh: SwipeRefreshLayout
    private lateinit var state: StateView
    private var task: Task? = null
    private var comments: List<JSONObject> = emptyList()
    private var tagGroups: List<JSONObject>? = null
    private var cameraFile: File? = null

    private val pickFile = registerForActivityResult(ActivityResultContracts.OpenDocument()) { uri -> uri?.let { upload(it) } }
    private val takePhoto = registerForActivityResult(ActivityResultContracts.TakePicture()) { saved ->
        val file = cameraFile
        if (saved && file != null) upload(FileProvider.getUriForFile(this, "$packageName.files", file), "photo-${System.currentTimeMillis()}.jpg", "image/jpeg")
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        if (!requireSession()) return
        setContentView(R.layout.activity_detail)
        topBar("Task")
        content = findViewById(R.id.content)
        state = StateView(findViewById(android.R.id.content))
        refresh = findViewById<SwipeRefreshLayout>(R.id.refresh).apply {
            setColorSchemeColors(getColor(R.color.primary))
            setOnRefreshListener { load(quiet = true) }
        }
        addTopAction(R.drawable.ic_more_vert, "Task actions") { task?.let { menu(it) } }
        state.loading("Loading…")
        load()
    }

    private fun load(quiet: Boolean = false): Unit = call("Couldn't load", busyLine = quiet) {
        try {
            val loaded = Task.from(api.get("/tasks/$currentTaskId").getJSONObject("data"))
            comments = api.get("/tasks/$currentTaskId/comments").optJSONArray("data").objects()
            if (loaded.canUpdate && tagGroups == null) tagGroups = api.get("/tags").optJSONArray("data").objects()
            task = loaded
            render(loaded)
            state.hide()
        } catch (e: ApiException) {
            if (task == null && e.status != 401) state.error(e) { state.loading("Loading…"); load() } else throw e
        } finally {
            refresh.isRefreshing = false
        }
    }

    /** Saves a change and reloads; list screens refresh when they come back. */
    private fun change(failTitle: String = "Not saved", block: suspend () -> Unit): Unit = call(failTitle) {
        block()
        AppState.dirty = true
        load(quiet = true)
    }

    private fun update(fields: JSONObject): Unit = change { api.put("/tasks/$currentTaskId", fields) }

    // ── Layout ──

    private fun render(t: Task) {
        topBar(t.reference)
        content.removeAllViews()

        // Project · reference, title, status / due / period
        content.addView(LinearLayout(this).apply {
            gravity = Gravity.CENTER_VERTICAL
            addView(dot(t.projectColor), LinearLayout.LayoutParams(dp(8), dp(8)).apply { marginEnd = dp(8) })
            addView(text("${t.projectName} · ${t.reference}", 13f, R.color.muted))
        })
        content.addView(text(t.title, 22f, bold = true).apply {
            setPadding(0, dp(6), 0, dp(8))
            if (t.canUpdate) setOnClickListener {
                askText("Title", "Title", "Save", required = true, initial = t.title) { update(JSONObject().put("title", it)) }
            }
        })
        content.addView(flow(this, buildList {
            t.status?.let { add(colorPill(it.name, it.color)) }
            t.dueDate?.let { add(dueText(this@TaskActivity, it, t.isDone)) }
            t.run?.let { (id, name) ->
                add(text(name, 13f, R.color.primary, bold = true).apply {
                    setOnClickListener { startActivity(Intent(this@TaskActivity, RunActivity::class.java).putExtra(RunActivity.ID, id)) }
                })
            }
        }))

        moves(t)
        fields(t)
        description(t)
        checklist(t)
        files(t)
        commentsSection(t)
        Fonts.apply(content)
    }

    private fun section(title: String) = content.addView(label(title.uppercase()).apply { setPadding(0, dp(22), 0, dp(8)) })

    private fun card() = LinearLayout(this).apply {
        orientation = LinearLayout.VERTICAL
        setBackgroundResource(R.drawable.card)
        setPadding(dp(4), dp(2), dp(4), dp(2))
    }

    // ── Workflow moves ──

    private fun moves(t: Task) {
        val box = LinearLayout(this).apply { orientation = LinearLayout.VERTICAL; setPadding(0, dp(16), 0, 0) }
        content.addView(box)
        if (t.moves.isEmpty()) {
            box.addView(text("No moves available to you at this step.", 14f, R.color.muted))
            return
        }
        val hasFiles = t.attachments.isNotEmpty()
        val backward = Regex("back|reopen|reject|return", RegexOption.IGNORE_CASE)
        t.moves.forEach { move ->
            val blocked = move.requiresAttachment && !hasFiles
            val kind = if (backward.containsMatchIn(move.label)) ButtonKind.SECONDARY else ButtonKind.PRIMARY
            box.addView(button(move.label, kind) { makeMove(t, move) }.apply { isEnabled = !blocked; alpha = if (blocked) 0.45f else 1f },
                lp(height = dp(if (kind == ButtonKind.PRIMARY) 52 else 48)).apply { topMargin = dp(8) })
            if (blocked) box.addView(text("Attach the supporting document (Files below) before “${move.label}”.", 13f, R.color.warning).apply { setPadding(0, dp(4), 0, 0) })
        }
    }

    private fun makeMove(t: Task, move: Move) {
        fun send(comment: String?) = change("Not moved") {
            api.post("/tasks/${t.id}/transitions/${move.id}", JSONObject().put("comment", comment ?: JSONObject.NULL))
            toast(move.label)
        }
        if (move.requiresComment) askText(move.label, "Reason", move.label, required = true, subtitle = "${t.reference} · ${t.title}") { send(it) }
        else send(null)
    }

    // ── Fields ──

    private fun fields(t: Task) {
        section("Details")
        val box = card()
        content.addView(box)
        fun row(label: String, value: String, onTap: (() -> Unit)?) {
            box.addView(LinearLayout(this).apply {
                gravity = Gravity.CENTER_VERTICAL
                minimumHeight = dp(50)
                setPadding(dp(10), 0, dp(10), 0)
                if (onTap != null) { setBackgroundResource(R.drawable.ripple_row); setOnClickListener { onTap() } }
                addView(text(label, 15f, R.color.muted), lp(0, weight = 1f))
                addView(text(value, 15f, bold = true).apply { maxLines = 1 })
                if (onTap != null) addView(ImageView(context).apply {
                    setImageResource(R.drawable.ic_chevron_right)
                    imageTintList = ColorStateList.valueOf(getColor(R.color.muted))
                }, LinearLayout.LayoutParams(dp(20), dp(20)).apply { marginStart = dp(4) })
            })
        }
        val edit = t.canUpdate
        row("Assignee", t.assignee?.name ?: "Unassigned", if (edit) ({ pickPerson(t, "assignee_id", t.assignee) }) else null)
        row("Reviewer", t.reviewer?.name ?: "No reviewer", if (edit) ({ pickPerson(t, "reviewer_id", t.reviewer) }) else null)
        row("Priority", priorityLabel(t.priority), if (edit) ({
            choose("Priority", PRIORITIES, t.priority) { update(JSONObject().put("priority", it)) }
        }) else null)
        row("Due", t.dueDate?.let { Format.date(it) } ?: "None", if (edit) ({ pickDue(t) }) else null)
        row("Created by", t.creator?.name ?: "—", null)

        val groups = tagGroups.orEmpty()
        if (edit && groups.isNotEmpty()) {
            groups.forEach { group ->
                val groupId = group.optInt("id")
                val selected = t.tags.firstOrNull { it.groupId == groupId }
                row(group.optString("name"), selected?.name ?: "—") {
                    val options = listOf("" to "—") + group.optJSONArray("tags").objects()
                        .filter { it.optBoolean("is_active") || it.optInt("id") == selected?.id }
                        .map { it.optInt("id").toString() to it.optString("name") }
                    choose(group.optString("name"), options, selected?.id?.toString() ?: "") { value ->
                        val others = t.tags.filter { it.groupId != groupId }.map { it.id }
                        update(JSONObject().put("tag_ids", JSONArray(if (value.isEmpty()) others else others + value.toInt())))
                    }
                }
            }
        } else if (t.tags.isNotEmpty()) {
            content.addView(flow(this, t.tags.map { colorPill(it.name, it.color, small = true) }), lp().apply { topMargin = dp(8) })
        }
    }

    private fun pickPerson(t: Task, field: String, current: Person?): Unit = call("Couldn't load members") {
        val members = api.get("/projects/${t.projectId}/members").optJSONArray("data").objects().mapNotNull { Person.from(it) }
        val options = listOf("" to "Nobody") + members.map { it.id.toString() to (if (it.id == session.userId) "Me (${it.name})" else it.name) }
        choose(if (field == "assignee_id") "Assignee" else "Reviewer", options, current?.id?.toString() ?: "") { value ->
            update(JSONObject().put(field, if (value.isEmpty()) JSONObject.NULL else value.toInt()))
        }
    }

    private fun pickDue(t: Task) {
        val start = t.dueDate?.let { LocalDate.parse(it.take(10)) } ?: LocalDate.now()
        DatePickerDialog(this, { _, year, month, day ->
            update(JSONObject().put("due_date", LocalDate.of(year, month + 1, day).toString()))
        }, start.year, start.monthValue - 1, start.dayOfMonth).apply {
            if (t.dueDate != null) setButton(DatePickerDialog.BUTTON_NEUTRAL, "No due date") { _, _ -> update(JSONObject().put("due_date", JSONObject.NULL)) }
        }.show()
    }

    // ── Description ──

    private fun description(t: Task) {
        if (!t.canUpdate && t.description.isNullOrBlank()) return
        section("Description")
        content.addView(text(t.description?.takeIf { it.isNotBlank() } ?: "Add details…", 16f, if (t.description.isNullOrBlank()) R.color.muted else R.color.text).apply {
            setBackgroundResource(R.drawable.card)
            setPadding(dp(14), dp(12), dp(14), dp(12))
            setLineSpacing(0f, 1.15f)
            if (t.canUpdate) setOnClickListener {
                askText("Description", "Details", "Save", required = false, initial = t.description.orEmpty()) {
                    update(JSONObject().put("description", it.ifEmpty { JSONObject.NULL }))
                }
            }
        })
    }

    // ── Checklist ──

    private fun checklist(t: Task) {
        val canTick = t.canUpdate || t.assignee?.id == session.userId
        if (!t.canUpdate && t.checklist.isEmpty()) return
        section("Checklist" + if (t.checklist.isNotEmpty()) " · ${t.checklist.count { it.done }}/${t.checklist.size}" else "")
        val box = card()
        content.addView(box)
        t.checklist.forEach { item ->
            box.addView(CheckBox(this).apply {
                text = item.title
                textSize = 16f
                isChecked = item.done
                isEnabled = canTick
                minHeight = dp(48)
                buttonTintList = ColorStateList.valueOf(getColor(R.color.primary))
                if (item.done) { paintFlags = paintFlags or Paint.STRIKE_THRU_TEXT_FLAG; setTextColor(getColor(R.color.muted)) }
                setOnCheckedChangeListener { _, checked -> change { api.put("/checklist-items/${item.id}", JSONObject().put("is_done", checked)) } }
                if (t.canUpdate) setOnLongClickListener {
                    confirm("Remove “${item.title}”?", "It is taken off the checklist.", "Remove", danger = true) {
                        change { api.delete("/checklist-items/${item.id}") }
                    }
                    true
                }
            }, lp().apply { marginStart = dp(4) })
        }
        if (t.canUpdate) box.addView(menuRow(R.drawable.ic_add, "Add an item", color = R.color.primary) {
            askText("Checklist item", "Item", "Add", required = true) { change { api.post("/tasks/${t.id}/checklist", JSONObject().put("title", it)) } }
        })
    }

    // ── Files ──

    private fun files(t: Task) {
        section("Files" + if (t.attachments.isNotEmpty()) " · ${t.attachments.size}" else "")
        if (t.attachments.isNotEmpty()) {
            val box = card()
            content.addView(box)
            t.attachments.forEach { file ->
                box.addView(menuRow(R.drawable.ic_file, file.name, detail = Format.size(file.size)) { openAttachment(file) }.apply {
                    if (t.canDelete || t.canComment) setOnLongClickListener {
                        confirm("Remove ${file.name}?", "The file is deleted from the task.", "Remove", danger = true) {
                            change { api.delete("/attachments/${file.id}") }
                        }
                        true
                    }
                })
            }
        } else {
            content.addView(text("No files attached.", 14f, R.color.muted))
        }
        if (t.canComment) content.addView(LinearLayout(this).apply {
            addView(button("Take photo", ButtonKind.SECONDARY) { capturePhoto() }, lp(0, dp(48), 1f).apply { marginEnd = dp(6) })
            addView(button("Attach file", ButtonKind.SECONDARY) { pickFile.launch(arrayOf("*/*")) }, lp(0, dp(48), 1f).apply { marginStart = dp(6) })
        }, lp().apply { topMargin = dp(10) })
    }

    private fun capturePhoto() {
        val file = File(cacheDir, "camera/photo.jpg").apply { parentFile?.mkdirs(); delete() }
        cameraFile = file
        try {
            takePhoto.launch(FileProvider.getUriForFile(this, "$packageName.files", file))
        } catch (e: ActivityNotFoundException) {
            showError("No camera app", "This phone has no camera app to take the photo.")
        }
    }

    private fun upload(uri: Uri, fallbackName: String? = null, fallbackType: String? = null) {
        val name = fallbackName ?: contentResolver.query(uri, arrayOf(OpenableColumns.DISPLAY_NAME), null, null, null)?.use { c ->
            if (c.moveToFirst()) c.getString(0) else null
        } ?: "file"
        val type = fallbackType ?: contentResolver.getType(uri) ?: "application/octet-stream"
        val (popup, _) = progressPopup("Uploading $name…")
        call("Not attached", busyLine = false) {
            try {
                api.upload("/tasks/$currentTaskId/attachments", name, type) { contentResolver.openInputStream(uri) ?: error("Cannot read the file") }
                toast("Attached")
                AppState.dirty = true
                load(quiet = true)
            } finally {
                popup.dismiss()
            }
        }
    }

    private fun openAttachment(file: Attachment) {
        val (popup, _) = progressPopup("Opening ${file.name}…")
        call("Couldn't open the file", busyLine = false) {
            try {
                val safe = file.name.replace(Regex("[^\\w.\\- ]"), "_")
                val local = api.download("/attachments/${file.id}/download", File(cacheDir, "attachments/${file.id}-$safe"))
                val uri = FileProvider.getUriForFile(this, "$packageName.files", local)
                val view = Intent(Intent.ACTION_VIEW).setDataAndType(uri, file.mimeType ?: "*/*").addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
                try {
                    startActivity(view)
                } catch (e: ActivityNotFoundException) {
                    val share = Intent(Intent.ACTION_SEND).setType(file.mimeType ?: "*/*").putExtra(Intent.EXTRA_STREAM, uri).addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
                    startActivity(Intent.createChooser(share, file.name))
                }
            } finally {
                popup.dismiss()
            }
        }
    }

    // ── Comments ──

    private fun commentsSection(t: Task) {
        section("Comments" + if (comments.isNotEmpty()) " · ${comments.size}" else "")
        if (comments.isEmpty()) content.addView(text("No comments yet.", 14f, R.color.muted))
        comments.forEach { c ->
            val user = c.optJSONObject("user")
            content.addView(LinearLayout(this).apply {
                setPadding(0, dp(8), 0, dp(8))
                addView(avatar(user?.optString("name"), 32), LinearLayout.LayoutParams(dp(32), dp(32)).apply { marginEnd = dp(12) })
                addView(LinearLayout(context).apply {
                    orientation = LinearLayout.VERTICAL
                    addView(text("${user?.optString("name") ?: "Deleted user"}  ·  ${Format.ago(c.optString("created_at"))}" + if (!c.isNull("edited_at")) " · edited" else "", 13f, R.color.muted))
                    addView(text(c.optString("body"), 16f).apply { setPadding(0, dp(2), 0, 0); setLineSpacing(0f, 1.1f) })
                }, lp(0, weight = 1f))
            })
        }
        if (t.canComment) content.addView(button("Write a comment", ButtonKind.SECONDARY) {
            askText("Comment", "Comment", "Post", required = true) { change("Not posted") { api.post("/tasks/${t.id}/comments", JSONObject().put("body", it)) } }
        }, lp(height = dp(48)).apply { topMargin = dp(8) })
    }

    // ── ⋯ menu ──

    private fun menu(t: Task) {
        val sheet = Sheet(this).title(t.reference, t.title)
        sheet.body.addView(menuRow(R.drawable.ic_notifications, if (t.watching) "Stop watching" else "Watch for changes") {
            sheet.dismiss()
            change { if (t.watching) api.delete("/tasks/${t.id}/watch") else api.post("/tasks/${t.id}/watch") }
        })
        if (t.canRemind && t.assignee != null) sheet.body.addView(menuRow(R.drawable.ic_mail, "Email reminder…") { sheet.dismiss(); emailReminder(t) })
        if (t.canDelete) sheet.body.addView(menuRow(R.drawable.ic_delete, "Move to bin", color = R.color.danger) {
            sheet.dismiss()
            confirm("Move ${t.reference} to the bin?", "It can be restored from the Bin on the web app.", "Move to bin", danger = true) {
                call { api.delete("/tasks/${t.id}"); AppState.dirty = true; toast("Moved to the bin"); finish() }
            }
        })
        sheet.button("Close", ButtonKind.SECONDARY)
        sheet.show()
    }

    private fun emailReminder(t: Task) {
        val alsoReviewer = t.reviewer?.takeIf { it.id != t.assignee?.id }?.let {
            CheckBox(this).apply { text = "Also email the reviewer (${it.name})"; textSize = 15f; buttonTintList = ColorStateList.valueOf(getColor(R.color.primary)) }
        }
        askText("Email a reminder", "Note (optional)", "Send email", required = false, subtitle = "Emails ${t.assignee?.name} about ${t.reference} now.", extra = alsoReviewer) { note ->
            call("Not sent") {
                val res = api.post("/tasks/${t.id}/email-reminder", JSONObject()
                    .put("note", note.ifEmpty { JSONObject.NULL })
                    .put("include_reviewer", alsoReviewer?.isChecked == true))
                showError("Reminder sent", res.optString("message"))
            }
        }
    }
}
