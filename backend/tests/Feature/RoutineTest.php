<?php

use App\Enums\DueRule;
use App\Enums\RoutineFrequency;
use App\Models\Project;
use App\Models\Routine;
use App\Models\RoutineRun;
use App\Models\TagGroup;
use App\Models\Task;
use App\Notifications\RunStarted;
use App\Notifications\TaskAssigned;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\Notification;

beforeEach(function () {
    $this->lead = $this->userWithRole('member');
    $this->accountant = $this->userWithRole('member');
    $this->project = Project::factory()->create(['owner_id' => $this->lead->id, 'key' => 'FIN']);
    $this->addMembers($this->project, [$this->accountant]);
    $this->branch = TagGroup::create(['name' => 'Branch']);
    $this->lahore = $this->branch->tags()->create(['name' => 'Lahore']);

    $this->routinePayload = fn (array $overrides = []) => array_merge([
        'name' => 'Month-end close',
        'frequency' => 'monthly',
        'lead_days' => 5,
        'items' => [
            ['title' => 'Bank reconciliation', 'assignee_id' => $this->accountant->id, 'reviewer_id' => $this->lead->id, 'due_rule' => 'days_after_end', 'due_value' => 3, 'checklist' => ['Bank statement', 'Reconciliation sheet'], 'tag_ids' => [$this->lahore->id]],
            ['title' => 'Sales tax return', 'assignee_id' => $this->accountant->id, 'due_rule' => 'day_of_next_month', 'due_value' => 18, 'priority' => 'high'],
        ],
    ], $overrides);
});

it('names fiscal periods for a Jul–Jun year', function (string $frequency, string $date, string $end, string $name) {
    $freq = RoutineFrequency::from($frequency);
    $periodEnd = $freq->periodEndFor(CarbonImmutable::parse($date));

    expect($periodEnd->toDateString())->toBe($end)->and($freq->periodName($periodEnd))->toBe($name);
})->with([
    ['monthly', '2026-06-10', '2026-06-30', 'June 2026'],
    ['quarterly', '2026-08-15', '2026-09-30', 'Q1 FY27'],
    ['quarterly', '2026-05-01', '2026-06-30', 'Q4 FY26'],
    ['half_yearly', '2026-11-22', '2026-12-31', 'H1 FY27'],
    ['half_yearly', '2027-02-01', '2027-06-30', 'H2 FY27'],
    ['yearly', '2026-11-22', '2027-06-30', 'FY27'],
    ['weekly', '2026-11-18', '2026-11-22', 'Week ending 22-Nov-2026'],
]);

it('works out due dates in calendar days, also on a Sunday', function () {
    $june = CarbonImmutable::parse('2026-06-30');

    expect(DueRule::DaysAfterEnd->dueDate($june, 5)->toDateString())->toBe('2026-07-05')   // a Sunday: kept
        ->and(DueRule::DayOfNextMonth->dueDate($june, 18)->toDateString())->toBe('2026-07-18')
        ->and(DueRule::DayOfNextMonth->dueDate(CarbonImmutable::parse('2027-01-31'), 31)->toDateString())->toBe('2027-02-28')
        ->and(DueRule::DaysBeforeEnd->dueDate($june, 2)->toDateString())->toBe('2026-06-28');
});

it('lets project managers create a routine for the current period', function () {
    $this->travelTo('2026-11-22');
    $this->signIn($this->lead);

    $this->postJson("/api/v1/projects/{$this->project->id}/routines", ($this->routinePayload)())
        ->assertCreated()
        ->assertJsonPath('data.next_period_end', '2026-11-30')
        ->assertJsonPath('data.next_period_name', 'November 2026')
        ->assertJsonPath('data.next_run_on', '2026-11-25')
        ->assertJsonCount(2, 'data.items');

    $this->signIn($this->accountant);
    $this->postJson("/api/v1/projects/{$this->project->id}/routines", ($this->routinePayload)())->assertForbidden();
    $this->getJson("/api/v1/projects/{$this->project->id}/routines")->assertOk()->assertJsonCount(1, 'data');
});

it('only uses project members and one tag per group on items', function () {
    $outsider = $this->userWithRole('member');
    $karachi = $this->branch->tags()->create(['name' => 'Karachi']);
    $this->signIn($this->lead);

    $this->postJson("/api/v1/projects/{$this->project->id}/routines", ($this->routinePayload)([
        'items' => [['title' => 'X', 'assignee_id' => $outsider->id, 'due_rule' => 'days_after_end', 'due_value' => 1, 'tag_ids' => [$this->lahore->id, $karachi->id]]],
    ]))->assertJsonValidationErrors(['items.0.assignee_id', 'items.0.tag_ids']);
});

it('creates the run automatically lead days before the period ends', function () {
    Notification::fake();
    $this->travelTo('2026-11-22');
    $this->signIn($this->lead);
    $routineId = $this->postJson("/api/v1/projects/{$this->project->id}/routines", ($this->routinePayload)())->json('data.id');

    $this->artisan('routines:create-runs')->assertSuccessful();
    expect(RoutineRun::count())->toBe(0);

    $this->travelTo('2026-11-25');
    $this->artisan('routines:create-runs')->assertSuccessful();
    $this->artisan('routines:create-runs')->assertSuccessful();

    $run = RoutineRun::sole();
    expect($run->name)->toBe('November 2026 · Month-end close')
        ->and($run->period_start->toDateString())->toBe('2026-11-01');

    $tasks = Task::where('routine_run_id', $run->id)->orderBy('id')->with(['checklist', 'tags'])->get();
    expect($tasks)->toHaveCount(2)
        ->and($tasks[0]->title)->toBe('Bank reconciliation — November 2026')
        ->and($tasks[0]->due_date->toDateString())->toBe('2026-12-03')
        ->and($tasks[0]->reviewer_id)->toBe($this->lead->id)
        ->and($tasks[0]->checklist->pluck('title')->all())->toBe(['Bank statement', 'Reconciliation sheet'])
        ->and($tasks[0]->tags->pluck('name')->all())->toBe(['Lahore'])
        ->and($tasks[1]->due_date->toDateString())->toBe('2026-12-18')
        ->and($tasks[1]->priority->value)->toBe('high')
        ->and(Routine::find($routineId)->next_period_end->toDateString())->toBe('2026-12-31');

    // One summary per person instead of one notice per task
    Notification::assertSentToTimes($this->accountant, RunStarted::class, 1);
    Notification::assertSentTo($this->accountant, RunStarted::class, fn ($n) => $n->assigned === 2);
    Notification::assertNotSentTo($this->accountant, TaskAssigned::class);
});

it('starts the next run early on request and never twice for a period', function () {
    $this->travelTo('2026-11-10');
    $this->signIn($this->lead);
    $routineId = $this->postJson("/api/v1/projects/{$this->project->id}/routines", ($this->routinePayload)())->json('data.id');

    $this->postJson("/api/v1/routines/{$routineId}/start")->assertCreated()->assertJsonPath('data.progress.total', 2);
    $this->postJson("/api/v1/routines/{$routineId}/start")->assertCreated()->assertJsonPath('data.name', 'December 2026 · Month-end close');

    $this->artisan('routines:create-runs')->assertSuccessful();
    expect(RoutineRun::count())->toBe(2);
});

it('drops people who left the project instead of failing the run', function () {
    $this->travelTo('2026-11-26');
    $this->signIn($this->lead);
    $routineId = $this->postJson("/api/v1/projects/{$this->project->id}/routines", ($this->routinePayload)())->json('data.id');
    $this->project->members()->detach($this->accountant->id);

    $this->artisan('routines:create-runs')->assertSuccessful();

    expect(Task::whereNotNull('routine_run_id')->whereNotNull('assignee_id')->count())->toBe(0)
        ->and(Routine::find($routineId)->runs()->count())->toBe(1);
});

it('shows run progress and lists its tasks', function () {
    $this->travelTo('2026-11-26');
    $this->signIn($this->lead);
    $routineId = $this->postJson("/api/v1/projects/{$this->project->id}/routines", ($this->routinePayload)())->json('data.id');
    $runId = $this->postJson("/api/v1/routines/{$routineId}/start")->json('data.id');

    $this->travelTo('2026-12-05');
    $this->getJson("/api/v1/runs/{$runId}")->assertOk()->assertJsonPath('data.progress.overdue', 1)->assertJsonPath('data.progress.done', 0);
    $this->getJson("/api/v1/tasks?routine_run_id={$runId}")->assertJsonCount(2, 'data');
    $this->getJson('/api/v1/runs')->assertJsonCount(1, 'data');

    $this->signIn($this->userWithRole('member'));
    $this->getJson("/api/v1/runs/{$runId}")->assertForbidden();
});

it('applies routine changes to future runs only', function () {
    $this->travelTo('2026-11-26');
    $this->signIn($this->lead);
    $routine = $this->postJson("/api/v1/projects/{$this->project->id}/routines", ($this->routinePayload)())->json('data');
    $this->postJson("/api/v1/routines/{$routine['id']}/start");

    $items = $this->getJson("/api/v1/routines/{$routine['id']}")->json('data.items');
    $items[0]['title'] = 'Bank rec (all accounts)';
    $this->putJson("/api/v1/routines/{$routine['id']}", ($this->routinePayload)(['items' => [$items[0]]]))->assertOk()->assertJsonCount(1, 'data.items');

    expect(Task::where('title', 'like', 'Bank reconciliation%')->count())->toBe(1)
        ->and(Task::count())->toBe(2);
});
