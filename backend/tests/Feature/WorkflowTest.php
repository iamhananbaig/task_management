<?php

use App\Enums\ProjectRole;
use App\Models\AuditLog;
use App\Models\Project;
use App\Models\Task;
use App\Models\TaskComment;
use App\Notifications\TaskMoved;
use Illuminate\Support\Facades\Notification;

beforeEach(function () {
    $this->lead = $this->userWithRole('member');
    $this->assignee = $this->userWithRole('member');
    $this->reviewer = $this->userWithRole('member');
    $this->project = Project::factory()->create(['owner_id' => $this->lead->id]);
    $this->addMembers($this->project, [$this->assignee, $this->reviewer]);
    $this->task = Task::factory()->inStatus('In progress')->create([
        'project_id' => $this->project->id,
        'assignee_id' => $this->assignee->id,
        'reviewer_id' => $this->reviewer->id,
        'creator_id' => $this->lead->id,
    ]);
    $this->move = fn (string $label, array $body = []) => $this->postJson(
        "/api/v1/tasks/{$this->task->id}/transitions/".$this->transition($this->project, $label),
        $body,
    );
});

it('runs the review cycle: submit, send back with a reason, submit, approve', function () {
    Notification::fake();

    $this->signIn($this->assignee);
    ($this->move)('Submit for review')->assertOk()->assertJsonPath('data.status.name', 'Submitted for review');
    Notification::assertSentTo($this->reviewer, TaskMoved::class);

    $this->signIn($this->reviewer);
    ($this->move)('Send back', ['comment' => 'Fix the header'])->assertOk()->assertJsonPath('data.status.name', 'In progress');

    $this->signIn($this->assignee);
    ($this->move)('Submit for review')->assertOk();

    $this->signIn($this->reviewer);
    ($this->move)('Approve')->assertOk()->assertJsonPath('data.status.name', 'Completed');

    expect($this->task->fresh()->completed_at)->not->toBeNull()
        ->and(TaskComment::where('task_id', $this->task->id)->value('body'))->toBe('Fix the header')
        ->and(AuditLog::where('task_id', $this->task->id)->where('action', 'moved')->count())->toBe(4);
});

it('lets the assignee pull a task back from review', function () {
    $this->signIn($this->assignee);
    ($this->move)('Submit for review')->assertOk();

    ($this->move)('Pull back')->assertOk()->assertJsonPath('data.status.name', 'In progress');
});

it('requires a reason to send back', function () {
    $this->signIn($this->assignee);
    ($this->move)('Submit for review');

    $this->signIn($this->reviewer);
    ($this->move)('Send back')->assertJsonValidationErrors('comment');
    ($this->move)('Send back', ['comment' => '   '])->assertJsonValidationErrors('comment');
});

it('refuses moves by the wrong person', function () {
    $this->signIn($this->reviewer);
    ($this->move)('Submit for review')
        ->assertUnprocessable()
        ->assertJsonPath('errors.transition.0', 'Only the assignee can "Submit for review" this task.');

    $this->signIn($this->assignee);
    ($this->move)('Submit for review');
    ($this->move)('Approve')->assertUnprocessable();
});

it('refuses a move that does not start from the current status', function () {
    $this->signIn($this->reviewer);

    ($this->move)('Approve')->assertUnprocessable()->assertJsonValidationErrors('transition');
});

it('lists only the moves the user may make', function () {
    $this->signIn($this->assignee);
    $labels = collect($this->getJson("/api/v1/tasks/{$this->task->id}")->json('data.available_transitions'))->pluck('label');
    expect($labels->all())->toBe(['Submit for review']);

    ($this->move)('Submit for review');
    $labels = collect($this->getJson("/api/v1/tasks/{$this->task->id}")->json('data.available_transitions'))->pluck('label');
    expect($labels->all())->toBe(['Pull back']);

    $this->signIn($this->reviewer);
    $labels = collect($this->getJson("/api/v1/tasks/{$this->task->id}")->json('data.available_transitions'))->pluck('label');
    expect($labels->all())->toBe(['Send back', 'Approve']);
});

it('lets "override workflow" holders make any defined move', function () {
    $this->signIn($this->userWithRole('manager'));

    ($this->move)('Submit for review')->assertOk();
});

it('lets the project manager reopen a completed task with a reason', function () {
    $this->signIn($this->assignee);
    ($this->move)('Submit for review');
    $this->signIn($this->reviewer);
    ($this->move)('Approve');

    $this->signIn($this->lead);
    ($this->move)('Reopen', ['comment' => 'Client asked for changes'])->assertOk()->assertJsonPath('data.status.name', 'In progress');
    expect($this->task->fresh()->completed_at)->toBeNull();
});

it('replaces the workflow: renames, adds and removes statuses, moving their tasks', function () {
    $this->signIn($this->lead);
    $workflow = $this->getJson("/api/v1/projects/{$this->project->id}/workflow")->assertOk()->json();
    [$todo, $doing, $review, $done] = collect($workflow['statuses'])->pluck('id')->map(fn ($id) => (string) $id)->all();

    $definition = [
        'statuses' => [
            ['key' => $todo, 'name' => 'Backlog', 'color' => 'gray', 'type' => 'open'],
            ['key' => $doing, 'name' => 'Doing', 'color' => 'blue', 'type' => 'active'],
            ['key' => 'qa', 'name' => 'QA', 'color' => 'purple', 'type' => 'review'],
            ['key' => $done, 'name' => 'Done', 'color' => 'green', 'type' => 'done'],
        ],
        'transitions' => [
            ['from' => $todo, 'to' => $doing, 'label' => 'Start', 'actors' => ['assignee'], 'requires_comment' => false],
            ['from' => $doing, 'to' => 'qa', 'label' => 'To QA', 'actors' => ['assignee'], 'requires_comment' => false],
            ['from' => 'qa', 'to' => $done, 'label' => 'Pass', 'actors' => ['reviewer'], 'requires_comment' => false],
        ],
    ];

    $this->signIn($this->assignee);
    $this->postJson("/api/v1/tasks/{$this->task->id}/transitions/".$this->transition($this->project, 'Submit for review'))->assertOk();

    // Removing "Submitted for review" while a task is in it needs a target
    $this->signIn($this->lead);
    $this->putJson("/api/v1/projects/{$this->project->id}/workflow", $definition)->assertJsonValidationErrors('reassign');

    $this->putJson("/api/v1/projects/{$this->project->id}/workflow", $definition + ['reassign' => [$review => 'qa']])
        ->assertOk()
        ->assertJsonCount(4, 'statuses')
        ->assertJsonCount(3, 'transitions');

    $task = $this->task->fresh('status');
    expect($task->status->name)->toBe('QA')
        ->and($this->project->statuses()->pluck('name')->all())->toBe(['Backlog', 'Doing', 'QA', 'Done'])
        ->and(AuditLog::where('action', 'workflow changed')->count())->toBe(1);
});

it('requires a done status and valid moves', function () {
    $this->signIn($this->lead);

    $this->putJson("/api/v1/projects/{$this->project->id}/workflow", [
        'statuses' => [['key' => 'a', 'name' => 'A', 'type' => 'open'], ['key' => 'b', 'name' => 'B', 'type' => 'active']],
        'transitions' => [['from' => 'a', 'to' => 'zzz', 'label' => 'Go', 'actors' => ['assignee']]],
    ])->assertJsonValidationErrors(['statuses', 'transitions.0']);
});

it('only lets project managers change the workflow', function () {
    $this->signIn($this->assignee);

    $this->putJson("/api/v1/projects/{$this->project->id}/workflow", ['statuses' => [], 'transitions' => []])->assertForbidden();
});

it('creates projects from a chosen template and saves a workflow as a template', function () {
    $manager = $this->signIn($this->userWithRole('manager'));
    $this->addMembers($this->project, [$manager], ProjectRole::Manager);

    $template = $this->postJson("/api/v1/projects/{$this->project->id}/workflow/save-as-template", ['name' => 'Copy'])->assertCreated()->json('data');

    $this->postJson('/api/v1/projects', ['name' => 'Second', 'key' => 'SEC', 'workflow_template_id' => $template['id']])
        ->assertCreated()
        ->assertJsonCount(4, 'data.statuses')
        ->assertJsonCount(6, 'data.transitions');
});
