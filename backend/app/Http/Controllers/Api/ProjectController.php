<?php

namespace App\Http\Controllers\Api;

use App\Enums\ProjectRole;
use App\Enums\StatusType;
use App\Http\Controllers\Controller;
use App\Http\Requests\StoreProjectRequest;
use App\Http\Requests\UpdateProjectRequest;
use App\Http\Resources\ProjectResource;
use App\Models\Project;
use App\Models\WorkflowTemplate;
use App\Services\WorkflowService;
use App\Support\DefaultWorkflow;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;

class ProjectController extends Controller
{
    public function __construct(private WorkflowService $workflow) {}

    /** Projects the user can open, with task counts. ?archived=1 lists archived ones. */
    public function index(Request $request): AnonymousResourceCollection
    {
        $projects = Project::visibleTo($request->user())
            ->when($request->boolean('archived'), fn (Builder $query) => $query->whereNotNull('archived_at'), fn (Builder $query) => $query->whereNull('archived_at'))
            ->when($request->string('search')->trim()->value(), fn (Builder $query, string $search) => $query->where(fn (Builder $inner) => $inner->where('name', 'like', "%{$search}%")->orWhere('key', 'like', "%{$search}%")))
            ->with(['owner:id,name,email', 'members:id'])
            ->withCount(self::counts())
            ->orderBy('name')
            ->get();

        return ProjectResource::collection($projects);
    }

    public function store(StoreProjectRequest $request): JsonResponse
    {
        $validated = $request->validated();
        $user = $request->user();

        $definition = isset($validated['workflow_template_id'])
            ? WorkflowTemplate::findOrFail($validated['workflow_template_id'])->definition
            : (WorkflowTemplate::where('is_default', true)->value('definition') ?? DefaultWorkflow::definition());

        $project = DB::transaction(function () use ($validated, $user, $definition) {
            $project = Project::create([
                'name' => $validated['name'],
                'key' => strtoupper($validated['key']),
                'description' => $validated['description'] ?? null,
                'color' => $validated['color'] ?? 'blue',
                'owner_id' => $user->id,
            ]);
            $project->members()->attach($user->id, ['role' => ProjectRole::Manager->value]);
            foreach (array_diff($validated['member_ids'] ?? [], [$user->id]) as $memberId) {
                $project->members()->attach($memberId, ['role' => ProjectRole::Member->value]);
            }
            $this->workflow->install($project, is_string($definition) ? json_decode($definition, true) : $definition);

            return $project;
        });

        return (new ProjectResource($this->loadFull($project)))->response()->setStatusCode(201);
    }

    /** One project with its members and workflow (the board loads its tasks separately). */
    public function show(Project $project): ProjectResource
    {
        Gate::authorize('view', $project);

        return new ProjectResource($this->loadFull($project));
    }

    public function update(UpdateProjectRequest $request, Project $project): ProjectResource
    {
        Gate::authorize('manage', $project);
        $validated = $request->validated();
        if (isset($validated['key'])) {
            $validated['key'] = strtoupper($validated['key']);
        }
        $project->update($validated);

        return new ProjectResource($this->loadFull($project));
    }

    public function archive(Project $project): ProjectResource
    {
        Gate::authorize('manage', $project);
        $project->update(['archived_at' => now()]);

        return new ProjectResource($this->loadFull($project));
    }

    public function unarchive(Project $project): ProjectResource
    {
        Gate::authorize('manage', $project);
        $project->update(['archived_at' => null]);

        return new ProjectResource($this->loadFull($project));
    }

    /** Only empty projects can be deleted (including the bin); others are archived. */
    public function destroy(Project $project): JsonResponse
    {
        Gate::authorize('delete', $project);
        $count = $project->tasks()->withTrashed()->count();
        if ($count > 0) {
            return response()->json(['message' => "This project has {$count} task(s). Archive it instead."], 422);
        }
        DB::transaction(function () use ($project) {
            $project->transitions()->delete();
            $project->statuses()->delete();
            $project->members()->detach();
            $project->delete();
        });

        return response()->json(['message' => 'Project deleted.']);
    }

    /**
     * Counts shown on project cards.
     *
     * @return array<string, \Closure>
     */
    public static function counts(): array
    {
        $done = fn (Builder $status) => $status->where('type', StatusType::Done->value);
        $notDone = fn (Builder $status) => $status->where('type', '!=', StatusType::Done->value);

        return [
            'members',
            'tasks as open_tasks_count' => fn (Builder $query) => $query->whereHas('status', $notDone),
            'tasks as done_tasks_count' => fn (Builder $query) => $query->whereHas('status', $done),
            'tasks as overdue_tasks_count' => fn (Builder $query) => $query->whereHas('status', $notDone)->whereDate('due_date', '<', today()),
        ];
    }

    private function loadFull(Project $project): Project
    {
        return $project->load(['owner:id,name,email', 'members' => fn ($query) => $query->select('users.id', 'users.name', 'users.email')->orderBy('name'), 'statuses', 'transitions'])
            ->loadCount(self::counts());
    }
}
