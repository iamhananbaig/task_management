<?php

namespace App\Http\Controllers\Api;

use App\Enums\StatusType;
use App\Enums\TaskPriority;
use App\Http\Controllers\Controller;
use App\Http\Requests\StoreTaskRequest;
use App\Http\Requests\UpdateTaskRequest;
use App\Http\Resources\TaskResource;
use App\Models\Project;
use App\Models\Task;
use App\Services\TaskService;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\Rule;

class TaskController extends Controller
{
    public function __construct(private TaskService $tasks) {}

    /**
     * Tasks across the projects the user can open (My tasks, lists, search).
     *
     * Filters: project_id, assignee (me|id|none), reviewer (me|id), status_id, status_type,
     * priority, due (overdue|today|week|none), search, include_done (default: false), sort.
     */
    public function index(Request $request): AnonymousResourceCollection
    {
        $request->validate([
            'project_id' => ['nullable', 'integer'],
            'status_type' => ['nullable', Rule::enum(StatusType::class)],
            'priority' => ['nullable', Rule::enum(TaskPriority::class)],
            'due' => ['nullable', Rule::in(['overdue', 'today', 'week', 'none'])],
            'sort' => ['nullable', Rule::in(['due_date', 'priority', 'updated', 'created'])],
            'per_page' => ['nullable', 'integer', 'min:1', 'max:200'],
        ]);
        $user = $request->user();

        $query = Task::visibleTo($user)
            ->whereHas('project', fn (Builder $project) => $project->whereNull('archived_at'))
            ->with(self::listRelations())
            ->withCount(self::listCounts());

        $this->applyFilters($query, $request);

        $tasks = $query->paginate($request->integer('per_page', 50));
        $this->attachProjects($tasks->getCollection());

        return TaskResource::collection($tasks);
    }

    /** Every task of a project, for the board and the list view. Done tasks older than 30 days are left out unless ?all=1. */
    public function forProject(Request $request, Project $project): AnonymousResourceCollection
    {
        Gate::authorize('view', $project);
        $project->load(['transitions.toStatus:id,type', 'members:id', 'statuses']);
        $doneIds = $project->statuses->filter->isDone()->pluck('id');

        $query = Task::where('project_id', $project->id)
            ->with(['status', 'assignee:id,name,email', 'reviewer:id,name,email', 'tags', 'routineRun:id,name'])
            ->withCount(self::listCounts())
            ->when(! $request->boolean('all'), fn (Builder $query) => $query->where(fn (Builder $inner) => $inner
                ->whereNotIn('status_id', $doneIds)
                ->orWhere('completed_at', '>=', now()->subDays(30))
                ->orWhereNull('completed_at')))
            ->orderBy('position')
            ->orderBy('id');
        $this->applyFilters($query, $request, sortable: false);

        $tasks = $query->get()->each->setRelation('project', $project);

        return TaskResource::collection($tasks);
    }

    public function store(StoreTaskRequest $request, Project $project): JsonResponse
    {
        Gate::authorize('view', $project);
        abort_if($project->isArchived(), 422, 'This project is archived. Unarchive it to add tasks.');
        abort_unless($request->user()->can('create tasks'), 403);

        $task = $this->tasks->create($project, $request->validated(), $request->user());

        return (new TaskResource($this->loadDetail($task)))->detailed()->response()->setStatusCode(201);
    }

    public function show(Task $task): TaskResource
    {
        Gate::authorize('view', $task);

        return (new TaskResource($this->loadDetail($task)))->detailed();
    }

    public function update(UpdateTaskRequest $request, Task $task): TaskResource
    {
        Gate::authorize('update', $task);
        $this->tasks->update($task, $request->validated(), $request->user());

        return (new TaskResource($this->loadDetail($task)))->detailed();
    }

    /** To the bin (soft delete). */
    public function destroy(Task $task): JsonResponse
    {
        Gate::authorize('delete', $task);
        $task->delete();

        return response()->json(['message' => "{$task->reference()} moved to the bin."]);
    }

    /** Deleted tasks the user can see. */
    public function bin(Request $request): AnonymousResourceCollection
    {
        $tasks = Task::onlyTrashed()
            ->visibleTo($request->user())
            ->with(self::listRelations())
            ->latest('deleted_at')
            ->paginate(50);
        $this->attachProjects($tasks->getCollection());

        return TaskResource::collection($tasks);
    }

    public function restore(int $task): TaskResource
    {
        $model = Task::onlyTrashed()->findOrFail($task);
        Gate::authorize('restore', $model);
        $model->restore();

        return (new TaskResource($this->loadDetail($model)))->detailed();
    }

    /** @return array<int|string, mixed> */
    public static function listRelations(): array
    {
        return ['project:id,key,name,color,archived_at,is_restricted', 'status', 'assignee:id,name,email', 'reviewer:id,name,email', 'tags', 'routineRun:id,name'];
    }

    /** @return array<int|string, mixed> */
    public static function listCounts(): array
    {
        return [
            'checklist',
            'checklist as checklist_done_count' => fn (Builder $query) => $query->where('is_done', true),
            'comments',
            'attachments',
        ];
    }

    private function applyFilters(Builder $query, Request $request, bool $sortable = true): void
    {
        $user = $request->user();

        $query
            ->when($request->integer('project_id'), fn (Builder $q, int $id) => $q->where('project_id', $id))
            ->when($request->input('assignee'), function (Builder $q, string $assignee) use ($user) {
                match ($assignee) {
                    'me' => $q->where('assignee_id', $user->id),
                    'none' => $q->whereNull('assignee_id'),
                    default => $q->where('assignee_id', (int) $assignee),
                };
            })
            ->when($request->input('reviewer'), fn (Builder $q, string $reviewer) => $q->where('reviewer_id', $reviewer === 'me' ? $user->id : (int) $reviewer))
            ->when($request->integer('status_id'), fn (Builder $q, int $id) => $q->where('status_id', $id))
            ->when($request->integer('routine_run_id'), fn (Builder $q, int $id) => $q->where('routine_run_id', $id))
            // tag_ids[]=3&tag_ids[]=7: tasks with all of these tags
            ->when(array_filter((array) $request->input('tag_ids', [])), function (Builder $q, array $tagIds) {
                foreach ($tagIds as $tagId) {
                    $q->whereHas('tags', fn (Builder $tags) => $tags->whereKey((int) $tagId));
                }
            })
            ->when($request->input('status_type'), fn (Builder $q, string $type) => $q->whereHas('status', fn (Builder $s) => $s->where('type', $type)))
            ->when($request->input('priority'), fn (Builder $q, string $priority) => $q->where('priority', $priority))
            ->when($request->input('due'), function (Builder $q, string $due) {
                match ($due) {
                    'overdue' => $q->whereDate('due_date', '<', today()),
                    'today' => $q->whereDate('due_date', today()),
                    'week' => $q->whereBetween('due_date', [today()->toDateString(), today()->addDays(7)->toDateString()]),
                    'none' => $q->whereNull('due_date'),
                };
            })
            ->when($request->string('search')->trim()->value(), function (Builder $q, string $search) {
                // "WEB-12" finds that task; anything else searches the title and description
                if (preg_match('/^([A-Za-z0-9]+)-(\d+)$/', $search, $match)) {
                    $q->where('number', (int) $match[2])->whereHas('project', fn (Builder $p) => $p->where('key', strtoupper($match[1])));

                    return;
                }
                $q->where(fn (Builder $inner) => $inner->where('title', 'like', "%{$search}%")->orWhere('description', 'like', "%{$search}%"));
            });

        $statusFilter = $request->input('status_type') || $request->integer('status_id') || $request->integer('routine_run_id');
        if (! $statusFilter && $sortable && ! $request->boolean('include_done')) {
            $query->open();
        }

        if ($sortable) {
            match ($request->input('sort', 'due_date')) {
                'priority' => $query->orderByRaw("case priority when 'urgent' then 0 when 'high' then 1 when 'medium' then 2 else 3 end")->orderBy('due_date'),
                'updated' => $query->latest('updated_at'),
                'created' => $query->latest('id'),
                default => $query->orderByRaw('due_date is null')->orderBy('due_date')->orderByRaw("case priority when 'urgent' then 0 when 'high' then 1 when 'medium' then 2 else 3 end"),
            };
        }
    }

    /**
     * Give list tasks their project's transitions and members (one query per project), so the
     * resource can list the moves each task allows.
     *
     * @param  Collection<int, Task>|\Illuminate\Support\Collection<int, Task>  $tasks
     */
    private function attachProjects($tasks): void
    {
        $projects = Project::with(['transitions.toStatus:id,type', 'members:id'])->findMany($tasks->pluck('project_id')->unique())->keyBy('id');
        $tasks->each(fn (Task $task) => $task->setRelation('project', $projects[$task->project_id]));
    }

    private function loadDetail(Task $task): Task
    {
        return $task->load([
            'project.transitions.toStatus:id,type', 'project.members:id', 'status',
            'assignee:id,name,email', 'reviewer:id,name,email', 'creator:id,name,email',
            'checklist', 'attachments.user:id,name,email', 'watchers:id,name,email', 'tags', 'routineRun:id,name',
        ])->loadCount(self::listCounts());
    }
}
