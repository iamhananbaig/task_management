<?php

namespace App\Http\Controllers\Api;

use App\Enums\DueRule;
use App\Enums\RoutineFrequency;
use App\Enums\TaskPriority;
use App\Http\Controllers\Controller;
use App\Models\Project;
use App\Models\Routine;
use App\Models\RoutineRun;
use App\Services\RoutineService;
use App\Services\TaskService;
use Carbon\CarbonImmutable;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

/**
 * A project's routines (recurring tasks / period close checklists). Members can see them and their
 * runs; the project's managers create and change them. Changes apply to future runs only.
 */
class RoutineController extends Controller
{
    public function __construct(private RoutineService $routines, private TaskService $tasks) {}

    public function index(Project $project): JsonResponse
    {
        Gate::authorize('view', $project);
        $routines = $project->routines()->withCount('items')->with(['runs' => fn ($query) => $query->limit(1)])->get();

        return response()->json(['data' => $routines->map(fn (Routine $routine) => $this->summary($routine))]);
    }

    public function show(Routine $routine): JsonResponse
    {
        Gate::authorize('view', $routine->project);
        $routine->load(['items', 'creator:id,name']);
        $runs = $routine->runs()->limit(24)->get();
        $progress = $this->routines->progress($runs);

        return response()->json(['data' => $this->summary($routine) + [
            'description' => $routine->description,
            'items' => $routine->items->map(fn ($item) => [
                'id' => $item->id,
                'title' => $item->title,
                'description' => $item->description,
                'priority' => $item->priority->value,
                'assignee_id' => $item->assignee_id,
                'reviewer_id' => $item->reviewer_id,
                'checklist' => $item->checklist ?? [],
                'tag_ids' => $item->tag_ids ?? [],
                'due_rule' => $item->due_rule->value,
                'due_value' => $item->due_value,
            ]),
            'runs' => $runs->map(fn (RoutineRun $run) => $this->runSummary($run, $progress[$run->id] ?? [])),
            'can_manage' => request()->user()->can('manage', $routine->project),
        ]]);
    }

    public function store(Request $request, Project $project): JsonResponse
    {
        Gate::authorize('manage', $project);
        $validated = $this->validated($request, $project);

        $routine = DB::transaction(function () use ($validated, $project, $request) {
            $routine = new Routine([
                'project_id' => $project->id,
                'name' => $validated['name'],
                'description' => $validated['description'] ?? null,
                'frequency' => $validated['frequency'],
                'lead_days' => $validated['lead_days'] ?? 5,
                'is_active' => $validated['is_active'] ?? true,
                'created_by' => $request->user()->id,
            ]);
            $routine->next_period_end = $this->periodEnd($routine, $validated['next_period_end'] ?? null);
            $routine->save();
            $this->saveItems($routine, $validated['items']);

            return $routine;
        });

        return $this->show($routine)->setStatusCode(201);
    }

    public function update(Request $request, Routine $routine): JsonResponse
    {
        Gate::authorize('manage', $routine->project);
        $validated = $this->validated($request, $routine->project);

        DB::transaction(function () use ($validated, $routine) {
            $frequencyChanged = $routine->frequency->value !== $validated['frequency'];
            $routine->fill([
                'name' => $validated['name'],
                'description' => $validated['description'] ?? null,
                'frequency' => $validated['frequency'],
                'lead_days' => $validated['lead_days'] ?? $routine->lead_days,
                'is_active' => $validated['is_active'] ?? $routine->is_active,
            ]);
            if ($frequencyChanged || isset($validated['next_period_end'])) {
                $routine->next_period_end = $this->periodEnd($routine, $validated['next_period_end'] ?? null);
            }
            $routine->save();
            $this->saveItems($routine, $validated['items']);
        });

        return $this->show($routine->fresh());
    }

    /** Deleting a routine keeps its runs' tasks (they lose the link to the routine item). */
    public function destroy(Routine $routine): JsonResponse
    {
        Gate::authorize('manage', $routine->project);
        $routine->delete();

        return response()->json(['message' => 'Routine deleted. Tasks already created are kept.']);
    }

    /** Create the next period's run now instead of waiting for the scheduler. */
    public function startNow(Request $request, Routine $routine): JsonResponse
    {
        Gate::authorize('manage', $routine->project);
        abort_if($routine->project->isArchived(), 422, 'The project is archived.');
        $run = $this->routines->startRun($routine, $request->user());
        abort_if($run === null, 422, 'That period already has a run.');

        return response()->json(['data' => $this->runSummary($run, $this->routines->progress([$run])[$run->id])], 201);
    }

    /** A run with its progress (its tasks: GET /tasks?routine_run_id=). */
    public function run(RoutineRun $run): JsonResponse
    {
        Gate::authorize('view', $run->project);
        $run->load('routine:id,name,frequency', 'project:id,name,key,color');

        return response()->json(['data' => $this->runSummary($run, $this->routines->progress([$run])[$run->id]) + [
            'routine' => ['id' => $run->routine->id, 'name' => $run->routine->name],
            'project' => $run->project->only(['id', 'name', 'key', 'color']),
        ]]);
    }

    /** Recent runs across the projects the user can see (dashboard "Periods"). */
    public function recentRuns(Request $request): JsonResponse
    {
        $runs = RoutineRun::with('project:id,name,key,color')
            ->whereHas('project', fn ($project) => $project->visibleTo($request->user())->whereNull('archived_at'))
            ->where('period_end', '>=', today()->subMonths(2))
            ->latest('period_end')
            ->limit(20)
            ->get();
        $progress = $this->routines->progress($runs);

        return response()->json(['data' => $runs->map(fn (RoutineRun $run) => $this->runSummary($run, $progress[$run->id] ?? []) + [
            'project' => $run->project->only(['id', 'name', 'key', 'color']),
        ])]);
    }

    /** @return array<string, mixed> */
    private function validated(Request $request, Project $project): array
    {
        $validated = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'description' => ['nullable', 'string', 'max:5000'],
            'frequency' => ['required', Rule::enum(RoutineFrequency::class)],
            'lead_days' => ['nullable', 'integer', 'min:0', 'max:60'],
            'is_active' => ['boolean'],
            'next_period_end' => ['nullable', 'date_format:Y-m-d'],
            'items' => ['required', 'array', 'min:1', 'max:100'],
            'items.*.id' => ['nullable', 'integer'],
            'items.*.title' => ['required', 'string', 'max:200'],
            'items.*.description' => ['nullable', 'string', 'max:20000'],
            'items.*.priority' => ['nullable', Rule::enum(TaskPriority::class)],
            'items.*.assignee_id' => ['nullable', 'integer'],
            'items.*.reviewer_id' => ['nullable', 'integer'],
            'items.*.checklist' => ['nullable', 'array', 'max:50'],
            'items.*.checklist.*' => ['string', 'max:255'],
            'items.*.tag_ids' => ['nullable', 'array'],
            'items.*.tag_ids.*' => ['integer'],
            'items.*.due_rule' => ['required', Rule::enum(DueRule::class)],
            'items.*.due_value' => ['required', 'integer', 'min:0', 'max:366'],
        ]);

        $memberIds = $project->members()->pluck('users.id');
        $errors = [];
        foreach ($validated['items'] as $index => $item) {
            foreach (['assignee_id' => 'assignee', 'reviewer_id' => 'reviewer'] as $field => $label) {
                if (! empty($item[$field]) && ! $memberIds->contains((int) $item[$field])) {
                    $errors["items.{$index}.{$field}"] = ["The {$label} must be a member of the project."];
                }
            }
            if (($item['due_rule'] ?? null) === DueRule::DayOfNextMonth->value && ($item['due_value'] < 1 || $item['due_value'] > 31)) {
                $errors["items.{$index}.due_value"] = ['Choose a day between 1 and 31.'];
            }
            try {
                $this->tasks->validTagIds($item['tag_ids'] ?? []);
            } catch (ValidationException $exception) {
                $errors["items.{$index}.tag_ids"] = $exception->errors()['tag_ids'];
            }
        }
        if ($errors) {
            throw ValidationException::withMessages($errors);
        }

        return $validated;
    }

    /**
     * The period end to run next: the one containing the given date (or today), skipping periods
     * that already have a run.
     */
    private function periodEnd(Routine $routine, ?string $date): CarbonImmutable
    {
        $end = $routine->frequency->periodEndFor($date ? CarbonImmutable::parse($date) : CarbonImmutable::today());
        if ($routine->exists) {
            while ($routine->runs()->where('period_end', $end->toDateString())->exists()) {
                $end = $routine->frequency->nextPeriodEnd($end);
            }
        }

        return $end;
    }

    /** @param list<array<string, mixed>> $items */
    private function saveItems(Routine $routine, array $items): void
    {
        $keep = [];
        foreach (array_values($items) as $position => $data) {
            $attributes = [
                'title' => $data['title'],
                'description' => $data['description'] ?? null,
                'priority' => $data['priority'] ?? TaskPriority::Medium->value,
                'assignee_id' => $data['assignee_id'] ?? null,
                'reviewer_id' => $data['reviewer_id'] ?? null,
                'checklist' => array_values(array_filter(array_map('trim', $data['checklist'] ?? []))),
                'tag_ids' => array_values(array_map('intval', $data['tag_ids'] ?? [])),
                'due_rule' => $data['due_rule'],
                'due_value' => $data['due_value'],
                'position' => $position,
            ];
            $item = isset($data['id']) ? $routine->items()->whereKey($data['id'])->first() : null;
            if ($item) {
                $item->update($attributes);
            } else {
                $item = $routine->items()->create($attributes);
            }
            $keep[] = $item->id;
        }
        $routine->items()->whereNotIn('id', $keep)->delete();
    }

    /** @return array<string, mixed> */
    private function summary(Routine $routine): array
    {
        return [
            'id' => $routine->id,
            'project_id' => $routine->project_id,
            'name' => $routine->name,
            'frequency' => $routine->frequency->value,
            'lead_days' => $routine->lead_days,
            'is_active' => $routine->is_active,
            'next_period_end' => $routine->next_period_end->toDateString(),
            'next_period_name' => $routine->frequency->periodName($routine->next_period_end),
            'next_run_on' => $routine->nextRunOn()->toDateString(),
            'items_count' => $routine->items_count ?? $routine->items()->count(),
            'last_run' => $routine->relationLoaded('runs') && $routine->runs->first()
                ? ['id' => $routine->runs->first()->id, 'name' => $routine->runs->first()->name]
                : null,
        ];
    }

    /**
     * @param  array<string, int>  $progress
     * @return array<string, mixed>
     */
    private function runSummary(RoutineRun $run, array $progress): array
    {
        return [
            'id' => $run->id,
            'routine_id' => $run->routine_id,
            'project_id' => $run->project_id,
            'name' => $run->name,
            'period_start' => $run->period_start->toDateString(),
            'period_end' => $run->period_end->toDateString(),
            'created_at' => $run->created_at,
            'progress' => $progress + ['total' => 0, 'done' => 0, 'review' => 0, 'overdue' => 0, 'on_time' => 0],
        ];
    }
}
