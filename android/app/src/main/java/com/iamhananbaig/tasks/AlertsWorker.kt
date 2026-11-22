package com.iamhananbaig.tasks

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import androidx.work.Constraints
import androidx.work.CoroutineWorker
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.NetworkType
import androidx.work.PeriodicWorkRequestBuilder
import androidx.work.WorkManager
import androidx.work.WorkerParameters
import java.util.concurrent.TimeUnit

/**
 * About every 15 minutes (Android's minimum), fetches unread notifications and shows the new
 * ones on the phone: assignments, moves, comments, due / overdue reminders, escalations, periods.
 * Tapping one opens its task (or period). Instant push would need Firebase (FCM) — see README.
 */
class AlertsWorker(context: Context, params: WorkerParameters) : CoroutineWorker(context, params) {

    override suspend fun doWork(): Result {
        val session = Session(applicationContext)
        if (session.token == null) return Result.success()
        return try {
            val alerts = Api(session).get("/notifications", mapOf("unread" to true)).optJSONArray("data").objects().map { Alert.from(it) }
            val seen = session.lastAlertSeen
            val fresh = alerts.filter { it.createdAt > seen }.sortedBy { it.createdAt }
            // First run after sign-in: don't replay the backlog, just remember where we are
            if (seen.isNotEmpty()) fresh.takeLast(10).forEach { show(it) }
            alerts.maxOfOrNull { it.createdAt }?.let { if (it > seen) session.lastAlertSeen = it }
            Result.success()
        } catch (e: ApiException) {
            if (e.status == 401) Result.success() else Result.retry()
        }
    }

    private fun show(alert: Alert) {
        val context = applicationContext
        if (Build.VERSION.SDK_INT >= 33 && context.checkSelfPermission(android.Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) return
        ensureChannel(context)
        val open = when {
            alert.taskId > 0 -> Intent(context, TaskActivity::class.java).putExtra(TaskActivity.ID, alert.taskId)
            alert.runId > 0 -> Intent(context, RunActivity::class.java).putExtra(RunActivity.ID, alert.runId)
            else -> Intent(context, MainActivity::class.java).putExtra(MainActivity.EXTRA_TAB, "ALERTS")
        }.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        val pending = PendingIntent.getActivity(context, alert.id.hashCode(), open, PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT)
        val notification = NotificationCompat.Builder(context, CHANNEL)
            .setSmallIcon(R.drawable.ic_checklist)
            .setContentTitle(alert.title)
            .setContentText(alert.body)
            .setStyle(NotificationCompat.BigTextStyle().bigText(alert.body))
            .setContentIntent(pending)
            .setAutoCancel(true)
            .setColor(context.getColor(R.color.primary))
            .build()
        NotificationManagerCompat.from(context).notify(alert.id.hashCode(), notification)
    }

    companion object {
        private const val CHANNEL = "alerts"
        private const val WORK = "alerts-check"

        fun schedule(context: Context) {
            val request = PeriodicWorkRequestBuilder<AlertsWorker>(15, TimeUnit.MINUTES)
                .setConstraints(Constraints.Builder().setRequiredNetworkType(NetworkType.CONNECTED).build())
                .build()
            WorkManager.getInstance(context).enqueueUniquePeriodicWork(WORK, ExistingPeriodicWorkPolicy.KEEP, request)
        }

        fun cancel(context: Context) = WorkManager.getInstance(context).cancelUniqueWork(WORK)

        private fun ensureChannel(context: Context) {
            val manager = context.getSystemService(NotificationManager::class.java)
            if (manager.getNotificationChannel(CHANNEL) == null) {
                manager.createNotificationChannel(NotificationChannel(CHANNEL, "Task alerts", NotificationManager.IMPORTANCE_DEFAULT).apply {
                    description = "Assignments, workflow moves, comments and due-date reminders"
                })
            }
        }
    }
}
