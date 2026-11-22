<?php

namespace App\Notifications;

use App\Models\Task;

/** Sent to the project's managers when a task is overdue by the project's escalation days. */
class TaskEscalated extends TaskNotification
{
    public function __construct(Task $task, public int $daysLate)
    {
        parent::__construct($task);
    }

    protected function kind(): string
    {
        return 'escalated';
    }

    protected function title(): string
    {
        return "Overdue {$this->daysLate} day(s): {$this->task->reference()}";
    }

    protected function body(): string
    {
        return $this->task->title.' — '.($this->task->assignee?->name ?? 'unassigned');
    }
}
