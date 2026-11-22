<?php

use App\Models\AuditLog;
use App\Models\Project;
use App\Models\Task;
use App\Notifications\TaskAssigned;
use Illuminate\Support\Facades\Notification;

beforeEach(function () {
    $this->manager = $this->userWithRole('manager');
    $this->member = $this->userWithRole('member');
    $this->project = Project::factory()->create(['owner_id' => $this->manager->id, 'key' => 'WEB']);
    $this->addMembers($this->project, [$this->member]);
});

it('numbers tasks per project and starts them in the first status', function () {
    $this->signIn($this->member);

    $first = $this->postJson("/api/v1/projects/{$this->project->id}/tasks", ['title' => 'One'])->assertCreated();
    $second = $this->postJson("/api/v1/projects/{$this->project->id}/tasks", ['title' => 'Two', 'priority' => 'high'])->assertCreated();

    $first->assertJsonPath('data.reference', 'WEB-1')->assertJsonPath('data.status.name', 'To do')->assertJsonPath('data.priority', 'medium');
    $second->assertJsonPath('data.reference', 'WEB-2')->assertJsonPath('data.priority', 'high');
});

it('notifies a new assignee and reviewer, not the person assigning', function () {
    Notification::fake();
    $this->signIn($this->manager);

    $this->postJson("/api/v1/projects/{$this->project->id}/tasks", [
        'title' => 'Design', 'assignee_id' => $this->member->id, 'reviewer_id' => $this->manager->id,
    ])->assertCreated();

    Notification::assertSentTo($this->member, TaskAssigned::class, fn ($notification) => $notification->as === 'assignee');
    Notification::assertNotSentTo($this->manager, TaskAssigned::class);
});

it('only assigns project members', function () {
    $outsider = $this->userWithRole('member');
    $this->signIn($this->manager);

    $this->postJson("/api/v1/projects/{$this->project->id}/tasks", ['title' => 'X', 'assignee_id' => $outsider->id])
        ->assertJsonValidationErrors('assignee_id');
});

it('does not change status through a plain update', function () {
    $task = Task::factory()->create(['project_id' => $this->project->id]);
    $done = $this->project->statuses()->where('name', 'Completed')->value('id');
    $this->signIn($this->member);

    $this->putJson("/api/v1/tasks/{$task->id}", ['title' => 'Renamed', 'status_id' => $done])->assertOk();

    expect($task->fresh())->title->toBe('Renamed')->status_id->not->toBe($done);
});

it('audits task changes field by field', function () {
    $task = Task::factory()->create(['project_id' => $this->project->id, 'title' => 'Old']);
    $this->signIn($this->member);

    $this->putJson("/api/v1/tasks/{$task->id}", ['title' => 'New', 'due_date' => '2026-12-31'])->assertOk();

    $log = AuditLog::where('task_id', $task->id)->where('action', 'updated')->latest('id')->first();
    expect($log->changes)->toMatchArray(['title' => ['Old', 'New'], 'due_date' => [null, '2026-12-31']]);
    $this->getJson("/api/v1/tasks/{$task->id}/activity")->assertOk()->assertJsonPath('data.0.action', 'updated');
});

it('rejects a due date before the start date', function () {
    $task = Task::factory()->create(['project_id' => $this->project->id, 'start_date' => '2026-12-10']);
    $this->signIn($this->member);

    $this->putJson("/api/v1/tasks/{$task->id}", ['due_date' => '2026-12-01'])->assertJsonValidationErrors('due_date');
});

it('keeps viewers read-only except for comments', function () {
    $viewer = $this->userWithRole('viewer');
    $this->addMembers($this->project, [$viewer]);
    $task = Task::factory()->create(['project_id' => $this->project->id]);
    $this->signIn($viewer);

    $this->getJson("/api/v1/tasks/{$task->id}")->assertOk()->assertJsonPath('data.can.update', false)->assertJsonPath('data.can.comment', true);
    $this->putJson("/api/v1/tasks/{$task->id}", ['title' => 'X'])->assertForbidden();
    $this->postJson("/api/v1/projects/{$this->project->id}/tasks", ['title' => 'X'])->assertForbidden();
    $this->postJson("/api/v1/tasks/{$task->id}/comments", ['body' => 'Looks good'])->assertCreated();
});

it('hides tasks of projects the user is not in', function () {
    $other = Project::factory()->create();
    $hidden = Task::factory()->create(['project_id' => $other->id]);
    Task::factory()->create(['project_id' => $this->project->id, 'assignee_id' => $this->member->id]);
    $this->signIn($this->member);

    $this->getJson("/api/v1/tasks/{$hidden->id}")->assertForbidden();
    $this->getJson('/api/v1/tasks')->assertOk()->assertJsonCount(1, 'data');
});

it('filters my tasks by due date and finds a task by its reference', function () {
    Task::factory()->create(['project_id' => $this->project->id, 'assignee_id' => $this->member->id, 'due_date' => today()->subDay()]);
    Task::factory()->create(['project_id' => $this->project->id, 'assignee_id' => $this->member->id, 'due_date' => today()]);
    $third = Task::factory()->create(['project_id' => $this->project->id, 'assignee_id' => $this->manager->id]);
    $this->signIn($this->member);

    $this->getJson('/api/v1/tasks?assignee=me&due=overdue')->assertJsonCount(1, 'data');
    $this->getJson('/api/v1/tasks?assignee=me&due=today')->assertJsonCount(1, 'data');
    $this->getJson('/api/v1/tasks?search=web-'.$third->number)->assertJsonCount(1, 'data')->assertJsonPath('data.0.id', $third->id);
});

it('moves deleted tasks to the bin and restores them', function () {
    $task = Task::factory()->create(['project_id' => $this->project->id]);
    $this->signIn($this->manager);

    $this->deleteJson("/api/v1/tasks/{$task->id}")->assertOk();
    $this->getJson('/api/v1/tasks/bin')->assertJsonCount(1, 'data');
    $this->getJson("/api/v1/tasks/{$task->id}")->assertNotFound();

    $this->postJson("/api/v1/tasks/{$task->id}/restore")->assertOk();
    expect($task->fresh()->trashed())->toBeFalse();
});

it('does not let members delete tasks', function () {
    $task = Task::factory()->create(['project_id' => $this->project->id]);
    $this->signIn($this->member);

    $this->deleteJson("/api/v1/tasks/{$task->id}")->assertForbidden();
});

it('reorders a task within its column', function () {
    [$a, $b, $c] = Task::factory()->count(3)->sequence(['position' => 0], ['position' => 1], ['position' => 2])->create(['project_id' => $this->project->id]);
    $this->signIn($this->member);

    $this->putJson("/api/v1/tasks/{$c->id}/position", ['position' => 0])->assertOk();

    $ids = collect($this->getJson("/api/v1/projects/{$this->project->id}/tasks")->json('data'))->pluck('id')->all();
    expect($ids)->toBe([$c->id, $a->id, $b->id]);
});

it('lets the assignee tick their checklist without edit rights', function () {
    $viewer = $this->userWithRole('viewer');
    $this->addMembers($this->project, [$viewer]);
    $task = Task::factory()->create(['project_id' => $this->project->id, 'assignee_id' => $viewer->id]);
    $item = $task->checklist()->create(['title' => 'Draft']);
    $this->signIn($viewer);

    $this->putJson("/api/v1/checklist-items/{$item->id}", ['is_done' => true])->assertOk();
    $this->putJson("/api/v1/checklist-items/{$item->id}", ['title' => 'Renamed'])->assertForbidden();

    expect($item->fresh()->is_done)->toBeTrue();
});
