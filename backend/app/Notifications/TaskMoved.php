<?php

namespace App\Notifications;

use App\Enums\StatusType;
use App\Models\ProjectTransition;
use App\Models\Task;
use App\Models\User;

/** A task changed status through the workflow (submitted, sent back, approved, …). */
class TaskMoved extends TaskNotification
{
    public function __construct(Task $task, public ProjectTransition $transition, public User $actor, public ?string $comment = null)
    {
        parent::__construct($task);
    }

    protected function kind(): string
    {
        return 'moved';
    }

    protected function title(): string
    {
        $status = $this->task->status;
        if ($status?->type === StatusType::Review) {
            return 'Waiting for review';
        }

        return "{$this->transition->label} · {$status?->name}";
    }

    protected function body(): string
    {
        return "{$this->actor->name}: {$this->name()}".($this->comment ? " — {$this->comment}" : '');
    }
}
