package com.iamhananbaig.tasks

import java.time.Duration
import java.time.LocalDate
import java.time.OffsetDateTime
import java.time.format.DateTimeFormatter
import java.time.temporal.ChronoUnit
import java.util.Locale

/** Dates as the web app shows them: 22-Nov-2026, "Tomorrow", "3 h ago". */
object Format {
    private val full = DateTimeFormatter.ofPattern("dd-MMM-yyyy", Locale.US)
    private val short = DateTimeFormatter.ofPattern("d MMM", Locale.US)
    private val shortYear = DateTimeFormatter.ofPattern("d MMM yyyy", Locale.US)

    fun date(ymd: String?): String = ymd?.let { runCatching { LocalDate.parse(it.take(10)).format(full) }.getOrNull() } ?: "-"

    /** Days from today to the date (negative = past). */
    fun daysFromToday(ymd: String): Long = ChronoUnit.DAYS.between(LocalDate.now(), LocalDate.parse(ymd.take(10)))

    fun due(ymd: String): String {
        val days = daysFromToday(ymd)
        val date = LocalDate.parse(ymd.take(10))
        return when (days) {
            0L -> "Today"
            1L -> "Tomorrow"
            -1L -> "Yesterday"
            else -> date.format(if (date.year == LocalDate.now().year) short else shortYear)
        }
    }

    fun ago(iso: String): String {
        val time = runCatching { OffsetDateTime.parse(iso) }.getOrNull() ?: return ""
        val seconds = Duration.between(time.toInstant(), java.time.Instant.now()).seconds
        return when {
            seconds < 60 -> "just now"
            seconds < 3600 -> "${seconds / 60} min ago"
            seconds < 86_400 -> "${seconds / 3600} h ago"
            seconds < 7 * 86_400 -> "${seconds / 86_400} d ago"
            else -> date(time.toLocalDate().toString())
        }
    }

    fun size(bytes: Long): String = when {
        bytes < 1024 -> "$bytes B"
        bytes < 1024 * 1024 -> "%.1f KB".format(Locale.US, bytes / 1024.0)
        else -> "%.1f MB".format(Locale.US, bytes / 1_048_576.0)
    }

    fun initials(name: String?): String {
        val parts = name.orEmpty().trim().split(Regex("\\s+")).filter { it.isNotEmpty() }
        if (parts.isEmpty()) return "?"
        return (parts.first().take(1) + if (parts.size > 1) parts.last().take(1) else "").uppercase()
    }
}
