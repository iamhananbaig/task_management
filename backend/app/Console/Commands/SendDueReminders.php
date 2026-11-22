<?php

namespace App\Console\Commands;

use App\Enums\StatusType;
use App\Models\Task;
use App\Notifications\TaskDueReminder;
use Illuminate\Console\Attributes\Description;
use Illuminate\Console\Attributes\Signature;
use Illuminate\Console\Command;
use Illuminate\Database\Eloquent\Builder;

/**
 * Daily in-app + push reminders to assignees (scheduled in routes/console.php):
 *   - due tomorrow
 *   - overdue: the day after the due date, then every 7 days while still open
 * Safe to re-run the same day: last_reminded_on stops repeats.
 */
#[Signature('tasks:send-due-reminders {--dry-run : List what would be sent without sending}')]
#[Description('Send due-tomorrow and overdue reminders to task assignees')]
class SendDueReminders extends Command
{
    public function handle(): int
    {
        $today = today();
        $sent = 0;

        Task::query()
            ->with(['assignee', 'project', 'status'])
            ->whereNotNull('assignee_id')
            ->whereNotNull('due_date')
            ->whereDate('due_date', '<=', $today->copy()->addDay())
            ->where(fn (Builder $query) => $query->whereNull('last_reminded_on')->orWhereDate('last_reminded_on', '<', $today))
            ->whereHas('status', fn (Builder $status) => $status->where('type', '!=', StatusType::Done->value))
            ->whereHas('project', fn (Builder $project) => $project->whereNull('archived_at'))
            ->whereHas('assignee', fn (Builder $user) => $user->where('is_active', true))
            ->chunkById(200, function ($tasks) use ($today, &$sent) {
                foreach ($tasks as $task) {
                    $daysLate = (int) $task->due_date->diffInDays($today, false);
                    $dueTomorrow = $daysLate === -1;
                    $overdueNudge = $daysLate >= 1 && ($daysLate - 1) % 7 === 0;
                    if (! $dueTomorrow && ! $overdueNudge) {
                        continue;
                    }

                    $this->line(sprintf('%s %s → %s (%s)', $task->reference(), $task->title, $task->assignee->name, $dueTomorrow ? 'due tomorrow' : "{$daysLate} day(s) overdue"));
                    if ($this->option('dry-run')) {
                        continue;
                    }
                    $task->assignee->notify(new TaskDueReminder($task, overdue: ! $dueTomorrow));
                    $task->forceFill(['last_reminded_on' => $today])->saveQuietly();
                    $sent++;
                }
            });

        $this->info($this->option('dry-run') ? 'Dry run: nothing sent.' : "Sent {$sent} reminder(s).");

        return self::SUCCESS;
    }
}
