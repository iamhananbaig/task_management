<?php

namespace App\Notifications;

use App\Models\Task;
use App\Models\User;

/** You were made the assignee or the reviewer of a task. */
class TaskAssigned extends TaskNotification
{
    public function __construct(Task $task, public User $actor, public string $as = 'assignee')
    {
        parent::__construct($task);
    }

    protected function kind(): string
    {
        return $this->as === 'reviewer' ? 'review_assigned' : 'assigned';
    }

    protected function title(): string
    {
        return $this->as === 'reviewer' ? 'You are the reviewer' : 'Assigned to you';
    }

    protected function body(): string
    {
        return "{$this->actor->name}: {$this->name()}";
    }
}
