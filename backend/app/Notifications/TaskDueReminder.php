<?php

namespace App\Notifications;

use App\Models\Task;

/** Automatic reminder from tasks:send-due-reminders: due tomorrow, or overdue. */
class TaskDueReminder extends TaskNotification
{
    public function __construct(Task $task, public bool $overdue)
    {
        parent::__construct($task);
    }

    protected function kind(): string
    {
        return $this->overdue ? 'overdue' : 'due_soon';
    }

    protected function title(): string
    {
        return $this->overdue ? 'Overdue' : 'Due tomorrow';
    }

    protected function body(): string
    {
        return $this->name().' — due '.$this->task->due_date?->format('d-M-Y');
    }
}
