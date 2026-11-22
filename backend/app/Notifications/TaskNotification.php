<?php

namespace App\Notifications;

use App\Models\Task;
use App\Notifications\Channels\ExpoPushChannel;
use Illuminate\Notifications\Notification;

/**
 * Base for task notifications shown in the in-app bell (database) and pushed to phones (Expo).
 * Sub-classes give the kind, title and body; tapping one opens the task.
 */
abstract class TaskNotification extends Notification
{
    public function __construct(public Task $task) {}

    abstract protected function kind(): string;

    abstract protected function title(): string;

    abstract protected function body(): string;

    /** @return list<string|class-string> */
    public function via(object $notifiable): array
    {
        return ['database', ExpoPushChannel::class];
    }

    /** @return array<string, mixed> */
    public function toArray(object $notifiable): array
    {
        return [
            'kind' => $this->kind(),
            'task_id' => $this->task->id,
            'project_id' => $this->task->project_id,
            'reference' => $this->task->reference(),
            'title' => $this->title(),
            'body' => $this->body(),
        ];
    }

    /** @return array{title: string, body: string, data: array<string, mixed>} */
    public function toExpo(object $notifiable): array
    {
        return [
            'title' => $this->title(),
            'body' => $this->body(),
            'data' => ['kind' => $this->kind(), 'task_id' => $this->task->id],
        ];
    }

    protected function name(): string
    {
        return $this->task->reference().' '.$this->task->title;
    }
}
