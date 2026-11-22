<?php

namespace App\Http\Controllers\Api;

use App\Enums\StatusType;
use App\Http\Controllers\Controller;
use App\Http\Resources\AuditLogResource;
use App\Http\Resources\ProjectResource;
use App\Models\AuditLog;
use App\Models\Project;
use App\Models\Task;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/** "My work": the signed-in user's counts, their projects' progress and recent activity. */
class DashboardController extends Controller
{
    public function __invoke(Request $request): JsonResponse
    {
        $user = $request->user();
        $mine = fn () => Task::where('assignee_id', $user->id)->whereHas('project', fn (Builder $p) => $p->whereNull('archived_at'));

        $projects = Project::visibleTo($user)->whereNull('archived_at')
            ->withCount(ProjectController::counts())
            ->orderBy('name')
            ->get();

        $activity = AuditLog::whereIn('project_id', $projects->pluck('id'))
            ->whereNotNull('task_id')
            ->latest('id')
            ->limit(15)
            ->get();

        return response()->json([
            'counts' => [
                'open' => $mine()->open()->count(),
                'overdue' => $mine()->open()->whereDate('due_date', '<', today())->count(),
                'due_today' => $mine()->open()->whereDate('due_date', today())->count(),
                'due_this_week' => $mine()->open()->whereBetween('due_date', [today()->toDateString(), today()->addDays(7)->toDateString()])->count(),
                // Waiting for me to review
                'to_review' => Task::where('reviewer_id', $user->id)
                    ->whereHas('status', fn (Builder $s) => $s->where('type', StatusType::Review->value))
                    ->whereHas('project', fn (Builder $p) => $p->whereNull('archived_at'))
                    ->count(),
                'completed_this_week' => $mine()->where('completed_at', '>=', now()->startOfWeek())->count(),
            ],
            'projects' => ProjectResource::collection($projects),
            'activity' => AuditLogResource::collection($activity),
        ]);
    }
}
