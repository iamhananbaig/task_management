<?php

use Illuminate\Notifications\DatabaseNotification;
use Illuminate\Support\Facades\Schedule;

// Run by the "scheduler" container (php artisan schedule:work). Times are Asia/Karachi.
Schedule::command('tasks:send-due-reminders')
    ->dailyAt('09:00')
    ->timezone(config('app.timezone'))
    ->withoutOverlapping(60);

// Routines: create the next period's tasks lead_days before it ends (runs first, so new tasks
// get their reminders the same morning)
Schedule::command('routines:create-runs')
    ->dailyAt('06:00')
    ->timezone(config('app.timezone'))
    ->withoutOverlapping(60);

// Tell project managers about tasks overdue past the project's escalation days
Schedule::command('tasks:escalate-overdue')
    ->dailyAt('09:15')
    ->timezone(config('app.timezone'))
    ->withoutOverlapping(60);

// Read notifications older than 90 days are cleared out
Schedule::call(fn () => DatabaseNotification::whereNotNull('read_at')
    ->where('created_at', '<', now()->subDays(90))->delete())
    ->name('prune-read-notifications')
    ->dailyAt('03:00')
    ->timezone(config('app.timezone'));

// Expired Sanctum tokens
Schedule::command('sanctum:prune-expired --hours=24')->daily();
