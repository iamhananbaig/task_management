<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Resources\TaskResource;
use App\Models\ProjectTransition;
use App\Models\Task;
use App\Services\TaskService;
use App\Services\WorkflowService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;

/** Moving tasks: workflow transitions (status changes) and board order within a column. */
class TaskWorkflowController extends Controller
{
    public function __construct(private WorkflowService $workflow, private TaskService $tasks) {}

    /** Make a move: POST /tasks/{task}/transitions/{transition} {comment?} */
    public function transition(Request $request, Task $task, ProjectTransition $transition): TaskResource
    {
        Gate::authorize('view', $task);
        $validated = $request->validate(['comment' => ['nullable', 'string', 'max:5000']]);

        $task = $this->workflow->move($task, $transition, $request->user(), $validated['comment'] ?? null);

        return (new TaskResource($task->load(['project.transitions', 'project.members:id', 'status', 'assignee:id,name,email', 'reviewer:id,name,email', 'creator:id,name,email', 'checklist', 'attachments.user:id,name,email', 'watchers:id,name,email', 'tags', 'routineRun:id,name'])->loadCount(TaskController::listCounts())))->detailed();
    }

    /** Order within the task's column: PUT /tasks/{task}/position {position} */
    public function reorder(Request $request, Task $task): JsonResponse
    {
        Gate::authorize('update', $task);
        $validated = $request->validate(['position' => ['required', 'integer', 'min:0']]);
        $this->tasks->reorder($task, $validated['position']);

        return response()->json(['message' => 'Order saved.']);
    }
}
