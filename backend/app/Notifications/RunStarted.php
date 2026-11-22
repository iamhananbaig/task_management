<?php

namespace App\Notifications;

use App\Models\RoutineRun;
use App\Notifications\Channels\ExpoPushChannel;
use Illuminate\Notifications\Notification;

/** A routine run was created: "June 2026 close started — 6 tasks for you, 4 to review". */
class RunStarted extends Notification
{
    public function __construct(public RoutineRun $run, public int $assigned, public int $reviewing) {}

    /** @return list<string|class-string> */
    public function via(object $notifiable): array
    {
        return ['database', ExpoPushChannel::class];
    }

    /** @return array<string, mixed> */
    public function toArray(object $notifiable): array
    {
        return [
            'kind' => 'run_started',
            'run_id' => $this->run->id,
            'project_id' => $this->run->project_id,
            'task_id' => null,
            'reference' => null,
            'title' => "{$this->run->name} started",
            'body' => $this->summary(),
        ];
    }

    /** @return array{title: string, body: string, data: array<string, mixed>} */
    public function toExpo(object $notifiable): array
    {
        return [
            'title' => "{$this->run->name} started",
            'body' => $this->summary(),
            'data' => ['kind' => 'run_started', 'run_id' => $this->run->id],
        ];
    }

    private function summary(): string
    {
        $parts = array_filter([
            $this->assigned ? "{$this->assigned} task(s) for you" : null,
            $this->reviewing ? "{$this->reviewing} to review" : null,
        ]);

        return implode(', ', $parts).' · due from '.$this->run->tasks()->min('due_date');
    }
}
