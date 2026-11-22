<?php

namespace App\Services;

use App\Models\Routine;
use App\Models\RoutineRun;
use App\Models\Tag;
use App\Models\User;
use App\Notifications\RunStarted;
use App\Support\Audit;
use Carbon\CarbonImmutable;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * Routines → runs → tasks. Each run is one period ("June 2026 close"); its tasks are copies of the
 * routine's items with due dates worked out from the period end. Runs are created automatically
 * lead_days before the period ends (routines:create-runs, daily), or early with "Start now".
 */
class RoutineService
{
    public function __construct(private TaskService $tasks) {}

    /** The first period end for a new routine: the current period's, unless it is too late for it. */
    public function firstPeriodEnd(Routine $routine, ?CarbonImmutable $today = null): CarbonImmutable
    {
        $today ??= CarbonImmutable::today();

        return $routine->frequency->periodEndFor($today);
    }

    /**
     * Create every run that is due (next period end − lead days ≤ today). Returns the runs made.
     *
     * @return list<RoutineRun>
     */
    public function createDueRuns(?CarbonImmutable $today = null): array
    {
        $today ??= CarbonImmutable::today();
        $made = [];

        Routine::with(['project', 'creator'])->where('is_active', true)
            ->whereHas('project', fn ($project) => $project->whereNull('archived_at'))
            ->each(function (Routine $routine) use ($today, &$made) {
                // Catch up on missed days, at most a year of periods at a time
                for ($i = 0; $i < 53 && $routine->nextRunOn()->lte($today); $i++) {
                    $run = $this->startRun($routine, $routine->creator);
                    if ($run) {
                        $made[] = $run;
                    }
                    $routine->refresh();
                }
            });

        return $made;
    }

    /**
     * Create the run for the routine's next period now and move on to the period after.
     * Returns null if that period already has a run (another process made it).
     */
    public function startRun(Routine $routine, ?User $by): ?RoutineRun
    {
        $by ??= $routine->project->owner;

        $run = DB::transaction(function () use ($routine, $by) {
            /** @var Routine $locked */
            $locked = Routine::with(['items', 'project.members'])->lockForUpdate()->findOrFail($routine->id);
            if ($locked->items->isEmpty()) {
                throw ValidationException::withMessages(['items' => ['Add at least one task to the routine first.']]);
            }
            $periodEnd = $locked->next_period_end;
            $frequency = $locked->frequency;

            try {
                $run = RoutineRun::create([
                    'routine_id' => $locked->id,
                    'project_id' => $locked->project_id,
                    'name' => $frequency->periodName($periodEnd).' · '.$locked->name,
                    'period_start' => $frequency->periodStart($periodEnd),
                    'period_end' => $periodEnd,
                    'started_by' => $by?->id,
                ]);
            } catch (UniqueConstraintViolationException) {
                $locked->update(['next_period_end' => $frequency->nextPeriodEnd($periodEnd)]);

                return null;
            }

            $memberIds = $locked->project->members->pluck('id');
            foreach ($locked->items as $item) {
                $task = $this->tasks->create($locked->project, [
                    'title' => $item->title.' — '.$frequency->periodName($periodEnd),
                    'description' => $item->description,
                    'priority' => $item->priority->value,
                    // People who have left the project are dropped rather than failing the run
                    'assignee_id' => $memberIds->contains($item->assignee_id) ? $item->assignee_id : null,
                    'reviewer_id' => $memberIds->contains($item->reviewer_id) ? $item->reviewer_id : null,
                    'due_date' => $item->due_rule->dueDate($periodEnd, $item->due_value)->toDateString(),
                    'tag_ids' => $this->activeTagIds($item->tag_ids ?? []),
                    'routine_run_id' => $run->id,
                    'routine_item_id' => $item->id,
                ], $by ?? $locked->project->owner, notify: false);
                foreach (array_values($item->checklist ?? []) as $position => $title) {
                    $task->checklist()->create(['title' => $title, 'position' => $position]);
                }
            }

            $locked->update(['next_period_end' => $frequency->nextPeriodEnd($periodEnd)]);
            Audit::log('run started', "Started {$run->name} ({$locked->items->count()} task(s))", $locked->project, [], 'Routine');

            return $run;
        });

        if ($run) {
            $this->notifyPeople($run);
        }

        return $run;
    }

    /** One notice per person for the whole run, instead of one per task. */
    private function notifyPeople(RoutineRun $run): void
    {
        $tasks = $run->tasks()->get(['id', 'assignee_id', 'reviewer_id']);
        $people = User::whereIn('id', $tasks->pluck('assignee_id')->merge($tasks->pluck('reviewer_id'))->filter()->unique())
            ->where('is_active', true)->get();
        foreach ($people as $person) {
            $person->notify(new RunStarted(
                $run,
                assigned: $tasks->where('assignee_id', $person->id)->count(),
                reviewing: $tasks->where('reviewer_id', $person->id)->count(),
            ));
        }
    }

    /**
     * Progress of runs: task counts by status type, overdue and on time.
     *
     * @param  iterable<RoutineRun>  $runs
     * @return array<int, array<string, int>> run id => counts
     */
    public function progress(iterable $runs): array
    {
        $ids = collect($runs)->pluck('id');
        if ($ids->isEmpty()) {
            return [];
        }
        $rows = DB::table('tasks')
            ->join('project_statuses', 'project_statuses.id', '=', 'tasks.status_id')
            ->whereIn('tasks.routine_run_id', $ids)
            ->whereNull('tasks.deleted_at')
            ->get(['tasks.routine_run_id', 'tasks.due_date', 'tasks.completed_at', 'project_statuses.type']);

        $today = today()->toDateString();
        $out = [];
        foreach ($ids as $id) {
            $out[$id] = ['total' => 0, 'done' => 0, 'review' => 0, 'overdue' => 0, 'on_time' => 0];
        }
        foreach ($rows as $row) {
            $counts = &$out[$row->routine_run_id];
            $counts['total']++;
            if ($row->type === 'done') {
                $counts['done']++;
                if ($row->due_date === null || substr((string) $row->completed_at, 0, 10) <= $row->due_date) {
                    $counts['on_time']++;
                }
            } else {
                if ($row->type === 'review') {
                    $counts['review']++;
                }
                if ($row->due_date !== null && $row->due_date < $today) {
                    $counts['overdue']++;
                }
            }
            unset($counts);
        }

        return $out;
    }

    /**
     * @param  array<int|string>  $ids
     * @return list<int>
     */
    private function activeTagIds(array $ids): array
    {
        return Tag::whereIn('id', $ids)->where('is_active', true)->pluck('id')->all();
    }
}
