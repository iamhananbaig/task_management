<?php

use App\Models\Project;
use App\Models\TagGroup;
use App\Models\Task;
use App\Notifications\TaskEscalated;
use App\Services\WorkflowService;
use Illuminate\Support\Facades\Notification;

beforeEach(function () {
    $this->lead = $this->userWithRole('member');
    $this->accountant = $this->userWithRole('member');
    $this->project = Project::factory()->create(['owner_id' => $this->lead->id, 'escalate_after_days' => 2]);
    $this->addMembers($this->project, [$this->accountant]);
});

it('escalates tasks overdue past the threshold to the project managers, once', function () {
    Notification::fake();
    $late = Task::factory()->create(['project_id' => $this->project->id, 'assignee_id' => $this->accountant->id, 'due_date' => today()->subDays(2)]);
    Task::factory()->create(['project_id' => $this->project->id, 'assignee_id' => $this->accountant->id, 'due_date' => today()->subDay()]);

    $this->artisan('tasks:escalate-overdue')->assertSuccessful();
    $this->artisan('tasks:escalate-overdue')->assertSuccessful();

    Notification::assertSentToTimes($this->lead, TaskEscalated::class, 1);
    Notification::assertSentTo($this->lead, TaskEscalated::class, fn ($n) => $n->task->is($late) && $n->daysLate === 2);
    Notification::assertNotSentTo($this->accountant, TaskEscalated::class);
});

it('escalates again after the due date is changed, and never when switched off', function () {
    Notification::fake();
    $task = Task::factory()->create(['project_id' => $this->project->id, 'assignee_id' => $this->accountant->id, 'due_date' => today()->subDays(3)]);
    $this->artisan('tasks:escalate-overdue');

    $this->signIn($this->accountant);
    $this->putJson("/api/v1/tasks/{$task->id}", ['due_date' => today()->subDays(4)->toDateString()])->assertOk();
    $this->artisan('tasks:escalate-overdue');
    Notification::assertSentToTimes($this->lead, TaskEscalated::class, 2);

    $this->project->update(['escalate_after_days' => null]);
    $this->putJson("/api/v1/tasks/{$task->id}", ['due_date' => today()->subDays(5)->toDateString()]);
    $this->artisan('tasks:escalate-overdue');
    Notification::assertSentToTimes($this->lead, TaskEscalated::class, 2);
});

it('hides restricted projects from "view all projects" unless they also hold "view restricted projects"', function () {
    $payroll = Project::factory()->create(['name' => 'Payroll', 'is_restricted' => true]);
    $task = Task::factory()->create(['project_id' => $payroll->id, 'title' => 'Salary sheet']);
    $manager = $this->userWithRole('manager');      // view all projects, not restricted
    $admin = $this->userWithRole('admin');           // every permission

    $this->signIn($manager);
    $this->getJson('/api/v1/projects')->assertOk()->assertJsonMissing(['name' => 'Payroll']);
    $this->getJson("/api/v1/projects/{$payroll->id}")->assertForbidden();
    $this->getJson("/api/v1/tasks/{$task->id}")->assertForbidden();
    $this->getJson('/api/v1/search?q=Salary')->assertJsonCount(0, 'tasks');

    $this->signIn($admin);
    $this->getJson("/api/v1/projects/{$payroll->id}")->assertOk();
    $this->getJson('/api/v1/search?q=Salary')->assertJsonCount(1, 'tasks');

    $this->addMembers($payroll, [$manager]);
    $this->signIn($manager);
    $this->getJson("/api/v1/tasks/{$task->id}")->assertOk();
});

it('lets project managers mark a project restricted', function () {
    $this->signIn($this->lead);

    $this->putJson("/api/v1/projects/{$this->project->id}", ['is_restricted' => true, 'escalate_after_days' => 3])
        ->assertOk()
        ->assertJsonPath('data.is_restricted', true)
        ->assertJsonPath('data.escalate_after_days', 3);
});

it('tags tasks with at most one tag per group and filters by tag', function () {
    $branch = TagGroup::create(['name' => 'Branch']);
    $lahore = $branch->tags()->create(['name' => 'Lahore']);
    $karachi = $branch->tags()->create(['name' => 'Karachi']);
    $entity = TagGroup::create(['name' => 'Entity'])->tags()->create(['name' => 'Holding Co']);
    $task = Task::factory()->create(['project_id' => $this->project->id]);
    Task::factory()->create(['project_id' => $this->project->id]);
    $this->signIn($this->accountant);

    $this->putJson("/api/v1/tasks/{$task->id}", ['tag_ids' => [$lahore->id, $karachi->id]])->assertJsonValidationErrors('tag_ids');
    $this->putJson("/api/v1/tasks/{$task->id}", ['tag_ids' => [$lahore->id, $entity->id]])->assertOk()->assertJsonCount(2, 'data.tags');

    $this->getJson("/api/v1/tasks?tag_ids[]={$lahore->id}")->assertJsonCount(1, 'data');
    $this->getJson("/api/v1/projects/{$this->project->id}/tasks?tag_ids[]={$karachi->id}")->assertJsonCount(0, 'data');

    $karachi->update(['is_active' => false]);
    $this->putJson("/api/v1/tasks/{$task->id}", ['tag_ids' => [$karachi->id]])->assertJsonValidationErrors('tag_ids');
});

it('lets only "manage tags" holders edit tags, and keeps tags that are in use', function () {
    $this->signIn($this->accountant);
    $this->postJson('/api/v1/tag-groups', ['name' => 'Branch'])->assertForbidden();
    $this->getJson('/api/v1/tags')->assertOk();

    $this->signIn($this->userWithRole('manager'));
    $groupId = $this->postJson('/api/v1/tag-groups', ['name' => 'Branch'])->assertCreated()->json('data.id');
    $tagId = $this->postJson("/api/v1/tag-groups/{$groupId}/tags", ['name' => 'Lahore'])->assertCreated()->json('data.id');
    Task::factory()->create(['project_id' => $this->project->id])->tags()->attach($tagId);

    $this->deleteJson("/api/v1/tags/{$tagId}")->assertUnprocessable();
    $this->putJson("/api/v1/tags/{$tagId}", ['is_active' => false])->assertOk();
    $this->getJson('/api/v1/tags')->assertJsonPath('data.0.tags.0.is_active', false);
});

it('reports on-time completion, review time, overdue trend and runs', function () {
    $this->travelTo('2026-11-02 09:00');
    $onTime = Task::factory()->inStatus('Submitted for review')->create(['project_id' => $this->project->id, 'assignee_id' => $this->accountant->id, 'reviewer_id' => $this->lead->id, 'due_date' => '2026-11-10']);
    $late = Task::factory()->create(['project_id' => $this->project->id, 'assignee_id' => $this->accountant->id, 'due_date' => '2026-11-05']);
    Task::factory()->create(['project_id' => $this->project->id, 'assignee_id' => $this->lead->id, 'due_date' => '2026-11-06']);
    $onTime->attachments()->create(['original_name' => 'x.pdf', 'path' => 'x', 'size' => 1]);
    WorkflowService::recordStatusChange($onTime, $onTime->project->statuses()->where('name', 'In progress')->first(), $onTime->status, $this->accountant);

    // Reviewer approves 6 hours later
    $this->travelTo('2026-11-02 15:00');
    $this->signIn($this->lead);
    $this->postJson("/api/v1/tasks/{$onTime->id}/transitions/".$this->transition($this->project, 'Approve'))->assertOk();

    // The late one is completed after its due date
    $this->travelTo('2026-11-08');
    $late->forceFill(['status_id' => $this->project->statuses()->where('name', 'Completed')->value('id'), 'completed_at' => now()])->saveQuietly();

    $this->travelTo('2026-11-20');
    $this->signIn($this->userWithRole('admin'));
    $response = $this->getJson('/api/v1/reports?from=2026-11-01&to=2026-11-30')->assertOk();

    expect($response->json('on_time.total'))->toMatchArray(['due' => 3, 'on_time' => 1, 'late' => 1, 'overdue' => 1, 'on_time_pct' => 33.3])
        ->and(collect($response->json('on_time.by_person'))->firstWhere('user_id', $this->accountant->id))->toMatchArray(['on_time' => 1, 'late' => 1, 'on_time_pct' => 50])
        ->and($response->json('review_time.by_reviewer.0'))->toMatchArray(['user_id' => $this->lead->id, 'reviews' => 1, 'avg_hours' => 6])
        ->and($response->json('overdue.0'))->toMatchArray(['month' => '2026-11', 'overdue' => 1]);

    $this->signIn($this->accountant);
    $this->getJson('/api/v1/reports')->assertForbidden();
});
