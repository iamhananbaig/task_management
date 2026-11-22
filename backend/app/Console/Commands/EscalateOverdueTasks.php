<?php

namespace App\Console\Commands;

use App\Enums\ProjectRole;
use App\Enums\StatusType;
use App\Models\Task;
use App\Notifications\TaskEscalated;
use Illuminate\Console\Attributes\Description;
use Illuminate\Console\Attributes\Signature;
use Illuminate\Console\Command;
use Illuminate\Database\Eloquent\Builder;

/**
 * Tells a project's managers about tasks overdue by the project's "escalate after" days, once per
 * due date (escalated_at; a new due date allows a new escalation). The assignee is not told here —
 * they already get the overdue reminder.
 */
#[Signature('tasks:escalate-overdue {--dry-run : List what would be sent without sending}')]
#[Description('Notify project managers of tasks overdue past the escalation threshold')]
class EscalateOverdueTasks extends Command
{
    public function handle(): int
    {
        $today = today();
        $sent = 0;

        Task::query()
            ->with(['project.members', 'assignee', 'status'])
            ->whereNull('escalated_at')
            ->whereNotNull('due_date')
            ->whereDate('due_date', '<', $today)
            ->whereHas('status', fn (Builder $status) => $status->where('type', '!=', StatusType::Done->value))
            ->whereHas('project', fn (Builder $project) => $project->whereNull('archived_at')->whereNotNull('escalate_after_days'))
            ->chunkById(200, function ($tasks) use ($today, &$sent) {
                foreach ($tasks as $task) {
                    $daysLate = (int) $task->due_date->diffInDays($today);
                    if ($daysLate < $task->project->escalate_after_days) {
                        continue;
                    }
                    $managers = $task->project->members
                        ->filter(fn ($member) => $member->pivot->role === ProjectRole::Manager->value && $member->is_active && $member->id !== $task->assignee_id);

                    $this->line(sprintf('%s → %s (%d day(s) late)', $task->reference(), $managers->pluck('name')->implode(', ') ?: 'no manager', $daysLate));
                    if ($this->option('dry-run')) {
                        continue;
                    }
                    foreach ($managers as $manager) {
                        $manager->notify(new TaskEscalated($task, $daysLate));
                    }
                    $task->forceFill(['escalated_at' => now()])->saveQuietly();
                    $sent++;
                }
            });

        $this->info($this->option('dry-run') ? 'Dry run: nothing sent.' : "Escalated {$sent} task(s).");

        return self::SUCCESS;
    }
}
