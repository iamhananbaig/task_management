<?php

namespace App\Http\Controllers\Api;

use App\Enums\ProjectRole;
use App\Enums\StatusType;
use App\Http\Controllers\Controller;
use App\Http\Resources\AuditLogResource;
use App\Http\Resources\ProjectResource;
use App\Http\Resources\TaskResource;
use App\Models\AuditLog;
use App\Models\Project;
use App\Models\Task;
use App\Models\User;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

/**
 * "My work": the signed-in user's counts, their projects' progress and recent activity. Managers
 * (of a project, or anyone who may view reports) also get "team": the state of their projects'
 * work by person and what is waiting for review.
 */
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

        // Enough rows that grouping a task's consecutive changes still leaves a useful list
        $activity = AuditLog::whereIn('project_id', $projects->pluck('id'))
            ->whereNotNull('task_id')
            ->latest('id')
            ->limit(40)
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
            'team' => $this->team($user, $projects),
        ]);
    }

    /**
     * @param  Collection<int, Project>  $projects  the user's visible, active projects
     * @return array<string, mixed>|null
     */
    private function team(User $user, Collection $projects): ?array
    {
        $ids = $user->can('view reports')
            ? $projects->pluck('id')
            : $projects->pluck('id')->intersect(
                DB::table('project_members')->where('user_id', $user->id)->where('role', ProjectRole::Manager->value)->pluck('project_id')
            )->values();
        if ($ids->isEmpty()) {
            return null;
        }

        $open = fn () => Task::whereIn('project_id', $ids)->open();
        $inReview = fn (Builder $status) => $status->where('type', StatusType::Review->value);
        $today = today()->toDateString();

        $people = Task::query()
            ->join('project_statuses', 'project_statuses.id', '=', 'tasks.status_id')
            ->whereIn('tasks.project_id', $ids)
            ->where('project_statuses.type', '!=', StatusType::Done->value)
            ->whereNotNull('tasks.assignee_id')
            ->groupBy('tasks.assignee_id')
            ->selectRaw('tasks.assignee_id, count(*) as open_count')
            ->selectRaw('sum(case when tasks.due_date < ? then 1 else 0 end) as overdue_count', [$today])
            ->selectRaw('sum(case when project_statuses.type = ? then 1 else 0 end) as review_count', [StatusType::Review->value])
            ->get();
        $names = User::whereIn('id', $people->pluck('assignee_id'))->pluck('name', 'id');

        $waiting = Task::whereIn('project_id', $ids)
            ->whereHas('status', $inReview)
            // With the workflow, so the dashboard can show Approve / Send back on each row
            ->with(['project.transitions.toStatus:id,type', 'project.members:id', 'status', 'assignee:id,name,email', 'reviewer:id,name,email', 'tags'])
            ->withCount(TaskController::listCounts())
            ->oldest('updated_at')
            ->limit(6)
            ->get();

        return [
            'counts' => [
                'open' => $open()->count(),
                'overdue' => $open()->whereDate('due_date', '<', $today)->count(),
                'in_review' => Task::whereIn('project_id', $ids)->whereHas('status', $inReview)->count(),
                'unassigned' => $open()->whereNull('assignee_id')->count(),
            ],
            'people' => $people
                ->map(fn ($row) => [
                    'user' => ['id' => $row->assignee_id, 'name' => $names[$row->assignee_id] ?? '—'],
                    'open' => (int) $row->open_count,
                    'overdue' => (int) $row->overdue_count,
                    'in_review' => (int) $row->review_count,
                ])
                ->sortBy([['overdue', 'desc'], ['open', 'desc']])
                ->values()
                ->take(12)
                ->all(),
            'waiting_review' => TaskResource::collection($waiting)->resolve(),
        ];
    }
}
