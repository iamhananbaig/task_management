<?php

namespace App\Notifications;

use App\Models\Task;
use App\Models\User;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

/** Reminder emailed on demand from the task's "Email reminder" button. Mail only. */
class TaskEmailReminder extends Notification
{
    public function __construct(public Task $task, public User $sender, public ?string $note = null) {}

    /** @return list<string> */
    public function via(object $notifiable): array
    {
        return ['mail'];
    }

    public function toMail(object $notifiable): MailMessage
    {
        $task = $this->task;
        $due = $task->due_date ? $task->due_date->format('d-M-Y').($task->isOverdue() ? ' (overdue)' : '') : 'no due date';

        $mail = (new MailMessage)
            ->subject("Reminder: {$task->reference()} {$task->title}")
            ->greeting("Hello {$notifiable->name},")
            ->line("{$this->sender->name} sent you a reminder about this task:")
            ->line("**{$task->reference()} · {$task->title}**")
            ->line("Project: {$task->project->name} · Status: {$task->status->name} · Due: {$due}");

        if ($this->note) {
            $mail->line("Note: {$this->note}");
        }

        return $mail->action('Open the task', rtrim((string) config('app.frontend_url'), '/')."/tasks/{$task->id}");
    }
}
