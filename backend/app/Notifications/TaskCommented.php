<?php

namespace App\Notifications;

use App\Models\Task;
use App\Models\TaskComment;

class TaskCommented extends TaskNotification
{
    public function __construct(Task $task, public TaskComment $comment)
    {
        parent::__construct($task);
    }

    protected function kind(): string
    {
        return 'commented';
    }

    protected function title(): string
    {
        return "New comment on {$this->task->reference()}";
    }

    protected function body(): string
    {
        return ($this->comment->user->name ?? 'Someone').': '.mb_strimwidth($this->comment->body, 0, 140, '…');
    }
}
