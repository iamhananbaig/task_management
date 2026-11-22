<?php

use App\Models\AuditLog;
use App\Models\DeviceToken;
use App\Models\Project;
use App\Models\Task;
use App\Notifications\TaskDueReminder;
use App\Notifications\TaskEmailReminder;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Notification;

beforeEach(function () {
    $this->manager = $this->userWithRole('manager');
    $this->member = $this->userWithRole('member');
    $this->project = Project::factory()->create(['owner_id' => $this->manager->id]);
    $this->addMembers($this->project, [$this->member]);
});

it('reminds assignees of tasks due tomorrow and overdue ones, once a day', function () {
    Notification::fake();
    $tomorrow = Task::factory()->create(['project_id' => $this->project->id, 'assignee_id' => $this->member->id, 'due_date' => today()->addDay()]);
    $yesterday = Task::factory()->create(['project_id' => $this->project->id, 'assignee_id' => $this->member->id, 'due_date' => today()->subDay()]);
    Task::factory()->create(['project_id' => $this->project->id, 'assignee_id' => $this->member->id, 'due_date' => today()->subDays(3)]); // between nudges
    Task::factory()->create(['project_id' => $this->project->id, 'assignee_id' => $this->member->id, 'due_date' => today()->addDays(5)]);
    Task::factory()->inStatus('Completed')->create(['project_id' => $this->project->id, 'assignee_id' => $this->member->id, 'due_date' => today()->addDay()]);

    $this->artisan('tasks:send-due-reminders')->assertSuccessful();
    $this->artisan('tasks:send-due-reminders')->assertSuccessful();

    Notification::assertSentToTimes($this->member, TaskDueReminder::class, 2);
    Notification::assertSentTo($this->member, TaskDueReminder::class, fn ($n) => $n->task->is($tomorrow) && ! $n->overdue);
    Notification::assertSentTo($this->member, TaskDueReminder::class, fn ($n) => $n->task->is($yesterday) && $n->overdue);
});

it('nudges again every 7 days while overdue', function () {
    Notification::fake();
    Task::factory()->create(['project_id' => $this->project->id, 'assignee_id' => $this->member->id, 'due_date' => today()->subDays(8)]);

    $this->artisan('tasks:send-due-reminders')->assertSuccessful();

    Notification::assertSentToTimes($this->member, TaskDueReminder::class, 1);
});

it('pushes reminders to the assignee\'s phones and forgets unregistered phones', function () {
    config(['services.expo.enabled' => true]);
    Http::fake(['exp.host/*' => Http::response(['data' => [
        ['status' => 'ok', 'id' => '1'],
        ['status' => 'error', 'details' => ['error' => 'DeviceNotRegistered']],
    ]])]);
    $this->member->deviceTokens()->create(['token' => 'ExponentPushToken[good]', 'platform' => 'ios']);
    $this->member->deviceTokens()->create(['token' => 'ExponentPushToken[gone]', 'platform' => 'android']);
    Task::factory()->create(['project_id' => $this->project->id, 'assignee_id' => $this->member->id, 'due_date' => today()->addDay()]);

    $this->artisan('tasks:send-due-reminders')->assertSuccessful();

    Http::assertSent(fn ($request) => $request->url() === 'https://exp.host/--/api/v2/push/send' && count($request->data()) === 2 && $request->data()[0]['title'] === 'Due tomorrow');
    expect(DeviceToken::pluck('token')->all())->toBe(['ExponentPushToken[good]'])
        ->and($this->member->unreadNotifications()->count())->toBe(1);
});

it('emails a reminder on demand, at most once every 10 minutes', function () {
    Notification::fake();
    $task = Task::factory()->create(['project_id' => $this->project->id, 'assignee_id' => $this->member->id, 'reviewer_id' => $this->manager->id]);
    $this->signIn($this->manager);

    $this->postJson("/api/v1/tasks/{$task->id}/email-reminder", ['note' => 'Please finish today'])
        ->assertOk()
        ->assertJsonPath('message', "Reminder emailed to {$this->member->name}.");
    $this->postJson("/api/v1/tasks/{$task->id}/email-reminder")->assertStatus(429);

    Notification::assertSentTo($this->member, TaskEmailReminder::class, fn ($n, $channels) => $channels === ['mail'] && $n->note === 'Please finish today');
    Notification::assertNotSentTo($this->manager, TaskEmailReminder::class);
    expect(AuditLog::where('action', 'reminder emailed')->count())->toBe(1);
});

it('can include the reviewer and needs an assignee', function () {
    Notification::fake();
    $unassigned = Task::factory()->create(['project_id' => $this->project->id]);
    $task = Task::factory()->create(['project_id' => $this->project->id, 'assignee_id' => $this->member->id, 'reviewer_id' => $this->manager->id]);
    $this->signIn($this->manager);

    $this->postJson("/api/v1/tasks/{$unassigned->id}/email-reminder")->assertUnprocessable();
    $this->postJson("/api/v1/tasks/{$task->id}/email-reminder", ['include_reviewer' => true])->assertOk();

    Notification::assertSentTo([$this->member, $this->manager], TaskEmailReminder::class);
});

it('renders the reminder email with a link to the task', function () {
    $task = Task::factory()->create(['project_id' => $this->project->id, 'assignee_id' => $this->member->id, 'due_date' => today()->subDay()]);
    $mail = (new TaskEmailReminder($task->load(['project', 'status']), $this->manager))->toMail($this->member);

    expect($mail->subject)->toContain($task->reference())
        ->and($mail->actionUrl)->toEndWith("/tasks/{$task->id}")
        ->and(implode(' ', $mail->introLines))->toContain('(overdue)');
});
