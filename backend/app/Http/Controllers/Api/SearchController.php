<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Project;
use App\Models\Task;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/** Ctrl+K search: tasks (by title or WEB-12) and projects the user can open. */
class SearchController extends Controller
{
    public function __invoke(Request $request): JsonResponse
    {
        $search = $request->string('q')->trim()->value();
        if (mb_strlen($search) < 2) {
            return response()->json(['tasks' => [], 'projects' => []]);
        }
        $user = $request->user();

        $tasks = Task::visibleTo($user)->with(['project:id,key,name,color', 'status'])
            ->where(function ($query) use ($search) {
                if (preg_match('/^([A-Za-z0-9]+)-(\d+)$/', $search, $match)) {
                    $query->where('number', (int) $match[2])->whereHas('project', fn ($p) => $p->where('key', strtoupper($match[1])));

                    return;
                }
                $query->where('title', 'like', "%{$search}%");
            })
            ->latest('updated_at')
            ->limit(10)
            ->get()
            ->map(fn (Task $task) => [
                'id' => $task->id,
                'reference' => $task->reference(),
                'title' => $task->title,
                'project' => $task->project->only(['id', 'name', 'color']),
                'status' => $task->status->only(['id', 'name', 'color', 'type']),
            ]);

        $projects = Project::visibleTo($user)
            ->where(fn ($query) => $query->where('name', 'like', "%{$search}%")->orWhere('key', 'like', "%{$search}%"))
            ->orderBy('name')
            ->limit(5)
            ->get(['id', 'name', 'key', 'color', 'archived_at']);

        return response()->json(['tasks' => $tasks, 'projects' => $projects]);
    }
}
