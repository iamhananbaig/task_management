package com.iamhananbaig.tasks

import android.content.Context
import android.content.res.ColorStateList
import android.graphics.Paint
import android.view.Gravity
import android.view.View
import android.view.ViewGroup
import android.widget.ImageView
import android.widget.LinearLayout
import android.widget.ProgressBar
import android.widget.TextView
import androidx.recyclerview.widget.RecyclerView

/** What a list shows: section headers, task cards, project cards, alerts, a run card. */
sealed class Row {
    data class Header(val title: String, val count: Int? = null, val color: String? = null) : Row()
    data class TaskItem(val task: Task, val showProject: Boolean) : Row()
    data class ProjectItem(val project: Project) : Row()
    data class AlertItem(val alert: Alert) : Row()
    data class Note(val text: String) : Row()
}

/** One adapter for every list; rows are built in code (as in mess_soft) and rebuilt on bind. */
class RowAdapter(
    private val onTask: (Task) -> Unit = {},
    private val onProject: (Project) -> Unit = {},
    private val onAlert: (Alert) -> Unit = {},
) : RecyclerView.Adapter<RowAdapter.Holder>() {
    var rows: List<Row> = emptyList()
        set(value) { field = value; notifyDataSetChanged() }

    class Holder(val frame: LinearLayout) : RecyclerView.ViewHolder(frame)

    override fun getItemCount() = rows.size

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int) = Holder(LinearLayout(parent.context).apply {
        orientation = LinearLayout.VERTICAL
        layoutParams = RecyclerView.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT)
    })

    override fun onBindViewHolder(holder: Holder, position: Int) {
        val frame = holder.frame
        frame.removeAllViews()
        val view = when (val row = rows[position]) {
            is Row.Header -> header(frame.context, row)
            is Row.TaskItem -> taskCard(frame.context, row.task, row.showProject).apply { setOnClickListener { onTask(row.task) } }
            is Row.ProjectItem -> projectCard(frame.context, row.project).apply { setOnClickListener { onProject(row.project) } }
            is Row.AlertItem -> alertRow(frame.context, row.alert).apply { setOnClickListener { onAlert(row.alert) } }
            is Row.Note -> frame.context.text(row.text, 14f, R.color.muted).apply { setPadding(frame.context.dp(16), frame.context.dp(12), frame.context.dp(16), frame.context.dp(12)) }
        }
        frame.addView(view)
        Fonts.apply(frame)
    }

    private fun header(c: Context, row: Row.Header) = LinearLayout(c).apply {
        orientation = LinearLayout.HORIZONTAL
        gravity = Gravity.CENTER_VERTICAL
        setPadding(c.dp(16), c.dp(14), c.dp(16), c.dp(6))
        if (row.color != null) addView(c.dot(row.color), LinearLayout.LayoutParams(c.dp(9), c.dp(9)).apply { marginEnd = c.dp(8) })
        addView(c.text(row.title, 15f, bold = true))
        row.count?.let { addView(c.text(" $it", 14f, R.color.muted)) }
    }
}

private fun cardLp(c: Context) = LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT).apply {
    setMargins(c.dp(12), c.dp(4), c.dp(12), c.dp(4))
}

/** A task: title + priority, tags, then reference / project / status / due / counts / assignee. */
fun taskCard(c: Context, task: Task, showProject: Boolean) = LinearLayout(c).apply {
    orientation = LinearLayout.VERTICAL
    setBackgroundResource(R.drawable.card)
    foreground = c.getDrawable(R.drawable.ripple_row)
    setPadding(c.dp(14), c.dp(12), c.dp(14), c.dp(12))
    layoutParams = cardLp(c)

    addView(LinearLayout(c).apply {
        orientation = LinearLayout.HORIZONTAL
        addView(c.text(task.title, 16f, if (task.isDone) R.color.muted else R.color.text, bold = true).apply {
            if (task.isDone) paintFlags = paintFlags or Paint.STRIKE_THRU_TEXT_FLAG
        }, lp(0, weight = 1f))
        addView(priorityMark(c, task.priority))
    })
    if (task.tags.isNotEmpty()) addView(flow(c, task.tags.map { c.colorPill(it.name, it.color, small = true) }), lp().apply { topMargin = c.dp(6) })

    addView(flow(c, buildList {
        add(c.text(task.reference, 12f, R.color.muted).apply { fontFeatureSettings = "tnum" })
        if (showProject) add(LinearLayout(c).apply {
            gravity = Gravity.CENTER_VERTICAL
            addView(c.dot(task.projectColor), LinearLayout.LayoutParams(c.dp(7), c.dp(7)).apply { marginEnd = c.dp(4) })
            addView(c.text(task.projectName, 12f, R.color.muted).apply { maxLines = 1 })
        })
        task.status?.let { add(c.colorPill(it.name, it.color, small = true)) }
        task.dueDate?.let { add(dueText(c, it, task.isDone)) }
        if (task.checklistTotal > 0) add(iconText(c, R.drawable.ic_checklist, "${task.checklistDone}/${task.checklistTotal}", R.color.muted))
        if (task.commentsCount > 0) add(iconText(c, R.drawable.ic_comment, task.commentsCount.toString(), R.color.muted))
        if (task.attachmentsCount > 0) add(iconText(c, R.drawable.ic_attach, task.attachmentsCount.toString(), R.color.muted))
    }, trailing = task.assignee?.let { c.avatar(it.name, 24) }), lp().apply { topMargin = c.dp(8) })
}

fun projectCard(c: Context, project: Project) = LinearLayout(c).apply {
    orientation = LinearLayout.VERTICAL
    setBackgroundResource(R.drawable.card)
    foreground = c.getDrawable(R.drawable.ripple_row)
    setPadding(c.dp(14), c.dp(14), c.dp(14), c.dp(14))
    layoutParams = cardLp(c)
    addView(LinearLayout(c).apply {
        gravity = Gravity.CENTER_VERTICAL
        addView(c.dot(project.color, 10), LinearLayout.LayoutParams(c.dp(10), c.dp(10)).apply { marginEnd = c.dp(10) })
        addView(c.text(project.name, 17f, bold = true).apply { maxLines = 1 }, lp(0, weight = 1f))
        if (project.restricted) addView(ImageView(c).apply {
            setImageResource(R.drawable.ic_lock)
            imageTintList = ColorStateList.valueOf(c.getColor(R.color.muted))
            contentDescription = "Restricted"
        }, LinearLayout.LayoutParams(c.dp(18), c.dp(18)).apply { marginEnd = c.dp(8) })
        addView(c.text(project.key, 13f, R.color.muted))
    })
    val total = project.open + project.done
    addView(ProgressBar(c, null, android.R.attr.progressBarStyleHorizontal).apply {
        max = maxOf(total, 1)
        progress = project.done
        progressTintList = ColorStateList.valueOf(c.getColor(R.color.primary))
        progressBackgroundTintList = ColorStateList.valueOf(c.getColor(R.color.border))
    }, lp(height = c.dp(8)).apply { topMargin = c.dp(10) })
    addView(LinearLayout(c).apply {
        addView(c.text("${project.done} of $total done", 13f, R.color.muted), lp(0, weight = 1f))
        if (project.overdue > 0) addView(c.text("${project.overdue} overdue", 13f, R.color.danger, bold = true))
    }, lp().apply { topMargin = c.dp(6) })
}

fun alertRow(c: Context, alert: Alert) = LinearLayout(c).apply {
    orientation = LinearLayout.HORIZONTAL
    setBackgroundColor(c.getColor(if (alert.read) R.color.surface else R.color.primary_soft))
    foreground = c.getDrawable(R.drawable.ripple_row)
    setPadding(c.dp(16), c.dp(12), c.dp(16), c.dp(12))
    val danger = alert.kind == "overdue" || alert.kind == "escalated"
    addView(View(c).apply {
        visibility = if (alert.read) View.INVISIBLE else View.VISIBLE
        background = android.graphics.drawable.GradientDrawable().apply { shape = android.graphics.drawable.GradientDrawable.OVAL; setColor(c.getColor(R.color.primary)) }
    }, LinearLayout.LayoutParams(c.dp(8), c.dp(8)).apply { topMargin = c.dp(7); marginEnd = c.dp(12) })
    addView(LinearLayout(c).apply {
        orientation = LinearLayout.VERTICAL
        addView(c.text(alert.title, 15f, if (danger) R.color.danger else R.color.text, bold = !alert.read))
        addView(c.text(alert.body, 14f, R.color.muted).apply { setPadding(0, c.dp(2), 0, 0) })
        addView(c.text(Format.ago(alert.createdAt), 12f, R.color.muted).apply { setPadding(0, c.dp(2), 0, 0) })
    }, lp(0, weight = 1f))
}

fun priorityMark(c: Context, priority: String): TextView {
    val (symbol, color) = when (priority) {
        "urgent" -> "▲▲" to R.color.danger
        "high" -> "▲" to R.color.warning
        "low" -> "▼" to R.color.primary
        else -> "=" to R.color.muted
    }
    return c.text(symbol, 14f, color, bold = true).apply { contentDescription = "${priorityLabel(priority)} priority"; setPadding(c.dp(8), 0, 0, 0) }
}

/** Due date: red when overdue, amber within 2 days, muted once done. */
fun dueText(c: Context, ymd: String, done: Boolean): TextView {
    val days = Format.daysFromToday(ymd)
    val color = when {
        done -> R.color.muted
        days < 0 -> R.color.danger
        days <= 2 -> R.color.warning
        else -> R.color.muted
    }
    return iconText(c, R.drawable.ic_calendar_today, Format.due(ymd), color, bold = days < 0 && !done).apply { contentDescription = "Due ${Format.date(ymd)}" }
}

/** Small tinted icon + text (due date, counts). */
fun iconText(c: Context, icon: Int, value: String, color: Int, bold: Boolean = false) = c.text(value, 12f, color, bold = bold).apply {
    val drawable = c.getDrawable(icon)?.mutate()?.apply {
        setBounds(0, 0, c.dp(14), c.dp(14))
        setTint(c.getColor(color))
    }
    setCompoundDrawablesRelative(drawable, null, null, null)
    compoundDrawablePadding = c.dp(3)
    gravity = Gravity.CENTER_VERTICAL
}

/** A row of small items that wraps (simple flow layout), with an optional view at the end. */
fun flow(c: Context, items: List<View>, trailing: View? = null): View {
    val wrap = FlowLayout(c, c.dp(10), c.dp(4))
    items.forEach { wrap.addView(it) }
    if (trailing == null) return wrap
    return LinearLayout(c).apply {
        gravity = Gravity.CENTER_VERTICAL
        addView(wrap, lp(0, weight = 1f))
        addView(trailing)
    }
}

/** Minimal wrapping row layout. */
class FlowLayout(context: Context, private val hGap: Int, private val vGap: Int) : ViewGroup(context) {
    override fun onMeasure(widthMeasureSpec: Int, heightMeasureSpec: Int) {
        val maxWidth = MeasureSpec.getSize(widthMeasureSpec) - paddingLeft - paddingRight
        var x = 0
        var y = 0
        var lineHeight = 0
        var widest = 0
        for (i in 0 until childCount) {
            val child = getChildAt(i)
            if (child.visibility == GONE) continue
            measureChild(child, MeasureSpec.makeMeasureSpec(maxWidth, MeasureSpec.AT_MOST), MeasureSpec.makeMeasureSpec(0, MeasureSpec.UNSPECIFIED))
            if (x > 0 && x + child.measuredWidth > maxWidth) {
                x = 0
                y += lineHeight + vGap
                lineHeight = 0
            }
            x += child.measuredWidth + hGap
            widest = maxOf(widest, x - hGap)
            lineHeight = maxOf(lineHeight, child.measuredHeight)
        }
        val width = if (MeasureSpec.getMode(widthMeasureSpec) == MeasureSpec.EXACTLY) MeasureSpec.getSize(widthMeasureSpec) else widest + paddingLeft + paddingRight
        setMeasuredDimension(width, y + lineHeight + paddingTop + paddingBottom)
    }

    override fun onLayout(changed: Boolean, l: Int, t: Int, r: Int, b: Int) {
        val maxWidth = r - l - paddingLeft - paddingRight
        var x = 0
        var y = 0
        var lineHeight = 0
        for (i in 0 until childCount) {
            val child = getChildAt(i)
            if (child.visibility == GONE) continue
            if (x > 0 && x + child.measuredWidth > maxWidth) {
                x = 0
                y += lineHeight + vGap
                lineHeight = 0
            }
            // Centre each child vertically on its line
            child.layout(paddingLeft + x, paddingTop + y, paddingLeft + x + child.measuredWidth, paddingTop + y + child.measuredHeight)
            x += child.measuredWidth + hGap
            lineHeight = maxOf(lineHeight, child.measuredHeight)
        }
    }
}
