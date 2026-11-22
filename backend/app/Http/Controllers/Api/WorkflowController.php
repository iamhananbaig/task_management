<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Resources\StatusResource;
use App\Http\Resources\TransitionResource;
use App\Models\Project;
use App\Models\WorkflowTemplate;
use App\Services\WorkflowService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;

/** A project's statuses and allowed moves (Project settings → Workflow). */
class WorkflowController extends Controller
{
    public function __construct(private WorkflowService $workflow) {}

    public function show(Project $project): JsonResponse
    {
        Gate::authorize('view', $project);

        return response()->json($this->payload($project));
    }

    /** Replace the whole workflow (see WorkflowService::replace for the format). */
    public function update(Request $request, Project $project): JsonResponse
    {
        Gate::authorize('manage', $project);
        $validated = $request->validate(WorkflowService::rules() + [
            'reassign' => ['nullable', 'array'],
        ]);
        $this->workflow->replace($project, $validated, $validated['reassign'] ?? []);

        return response()->json($this->payload($project->fresh()));
    }

    /** Save this project's workflow as a template for new projects. */
    public function saveAsTemplate(Request $request, Project $project): JsonResponse
    {
        Gate::authorize('manage', $project);
        abort_unless($request->user()->can('manage workflow templates'), 403);
        $validated = $request->validate([
            'name' => ['required', 'string', 'max:100', 'unique:workflow_templates,name'],
            'description' => ['nullable', 'string', 'max:255'],
        ]);

        $template = WorkflowTemplate::create($validated + ['definition' => $this->workflow->definitionOf($project)]);

        return response()->json(['data' => $template], 201);
    }

    /** @return array<string, mixed> */
    private function payload(Project $project): array
    {
        $project->load(['statuses' => fn ($query) => $query->withCount('tasks'), 'transitions']);

        return [
            'statuses' => $project->statuses->map(fn ($status) => (new StatusResource($status))->resolve() + ['tasks_count' => $status->tasks_count]),
            'transitions' => TransitionResource::collection($project->transitions)->resolve(),
        ];
    }
}
