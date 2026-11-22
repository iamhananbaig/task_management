<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\RoutineRun;
use App\Models\Task;
use App\Models\TaskStatusChange;
use App\Models\User;
use App\Services\RoutineService;
use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;

/**
 * Team reports for a date range (default: the last 6 months), over the projects the user can see,
 * filterable by project, tag and person:
 *   on_time      tasks due in the range: completed on time / late / still open past due, per person and month
 *   review_time  how long tasks waited in a review status before the reviewer acted, per reviewer
 *   overdue      open overdue tasks at each month end
 *   runs         routine runs (periods) ending in the range, with progress
 */
class ReportController extends Controller
{
    public function __invoke(Request $request, RoutineService $routines): JsonResponse
    {
        $request->validate([
            'from' => ['nullable', 'date_format:Y-m-d'],
            'to' => ['nullable', 'date_format:Y-m-d', 'after_or_equal:from'],
            'project_id' => ['nullable', 'integer'],
            'tag_id' => ['nullable', 'integer'],
            'user_id' => ['nullable', 'integer'],
        ]);
        $from = $request->input('from') ? CarbonImmutable::parse($request->input('from')) : CarbonImmutable::today()->subMonths(5)->startOfMonth();
        $to = $request->input('to') ? CarbonImmutable::parse($request->input('to')) : CarbonImmutable::today()->endOfMonth()->startOfDay();
        abort_if($from->diffInMonths($to) > 36, 422, 'Choose a range of at most 3 years.');

        $scope = function (Builder $query) use ($request) {
            $query->visibleTo($request->user())
                ->when($request->integer('project_id'), fn (Builder $q, int $id) => $q->where('tasks.project_id', $id))
                ->when($request->integer('tag_id'), fn (Builder $q, int $id) => $q->whereHas('tags', fn (Builder $tags) => $tags->whereKey($id)));
        };

        return response()->json([
            'from' => $from->toDateString(),
            'to' => $to->toDateString(),
            'on_time' => $this->onTime($scope, $from, $to, $request->integer('user_id')),
            'review_time' => $this->reviewTime($scope, $from, $to, $request->integer('user_id')),
            'overdue' => $this->overdueTrend($scope, $from, $to, $request->integer('user_id')),
            'runs' => $this->runs($request, $routines, $from, $to),
        ]);
    }

    /** @return array<string, mixed> */
    private function onTime(\Closure $scope, CarbonImmutable $from, CarbonImmutable $to, int $userId): array
    {
        $tasks = Task::query()
            ->tap($scope)
            ->when($userId, fn (Builder $q) => $q->where('assignee_id', $userId))
            ->whereNotNull('due_date')
            ->whereBetween('due_date', [$from->toDateString(), $to->toDateString()])
            ->with(['status:id,type', 'assignee:id,name'])
            ->get(['id', 'status_id', 'assignee_id', 'due_date', 'completed_at']);

        $today = CarbonImmutable::today()->toDateString();
        $classify = function (Task $task) use ($today): string {
            $due = $task->due_date->toDateString();
            if ($task->status?->type->value === 'done') {
                return $task->completed_at && $task->completed_at->toDateString() > $due ? 'late' : 'on_time';
            }

            return $due < $today ? 'overdue' : 'pending';
        };
        $count = function (Collection $group) use ($classify): array {
            $counts = ['due' => $group->count(), 'on_time' => 0, 'late' => 0, 'overdue' => 0, 'pending' => 0];
            foreach ($group as $task) {
                $counts[$classify($task)]++;
            }
            $decided = $counts['on_time'] + $counts['late'] + $counts['overdue'];
            $counts['on_time_pct'] = $decided ? round($counts['on_time'] / $decided * 100, 1) : null;

            return $counts;
        };

        $byPerson = $tasks->groupBy(fn (Task $task) => $task->assignee_id ?? 0)
            ->map(fn (Collection $group, $id) => ['user_id' => $id ?: null, 'name' => $group->first()->assignee?->name ?? 'Unassigned'] + $count($group))
            ->sortBy('name')->values();

        $byMonth = collect();
        for ($month = $from->startOfMonth(); $month->lte($to); $month = $month->addMonth()) {
            $key = $month->format('Y-m');
            $byMonth->push(['month' => $key] + $count($tasks->filter(fn (Task $task) => $task->due_date->format('Y-m') === $key)));
        }

        return ['total' => $count($tasks), 'by_person' => $byPerson, 'by_month' => $byMonth->values()];
    }

    /** @return array<string, mixed> */
    private function reviewTime(\Closure $scope, CarbonImmutable $from, CarbonImmutable $to, int $userId): array
    {
        $taskIds = Task::query()->tap($scope)->when($userId, fn (Builder $q) => $q->where('reviewer_id', $userId))->pluck('reviewer_id', 'id');
        $changes = TaskStatusChange::whereIn('task_id', $taskIds->keys())
            ->where('created_at', '>=', $from->startOfDay())
            ->orderBy('task_id')->orderBy('created_at')->orderBy('id')
            ->get(['task_id', 'to_type', 'created_at']);

        $now = now();
        $end = $to->endOfDay();
        $waits = [];   // reviewer id => list of [hours, finished]
        foreach ($changes->groupBy('task_id') as $taskId => $rows) {
            $rows = $rows->values();
            foreach ($rows as $index => $row) {
                if ($row->to_type !== 'review' || $row->created_at->gt($end)) {
                    continue;
                }
                $next = $rows->get($index + 1);
                $finished = $next !== null;
                $until = $finished ? $next->created_at : $now;
                $waits[$taskIds[$taskId] ?? 0][] = [$row->created_at->diffInMinutes($until) / 60, $finished];
            }
        }

        $names = User::whereIn('id', array_keys($waits))->pluck('name', 'id');
        $rows = collect($waits)->map(function (array $list, $reviewerId) use ($names) {
            $done = array_values(array_filter($list, fn ($wait) => $wait[1]));
            $hours = array_column($done, 0);

            return [
                'user_id' => $reviewerId ?: null,
                'name' => $reviewerId ? ($names[$reviewerId] ?? 'Former user') : 'No reviewer',
                'reviews' => count($done),
                'avg_hours' => $hours ? round(array_sum($hours) / count($hours), 1) : null,
                'max_hours' => $hours ? round(max($hours), 1) : null,
                'waiting_now' => count($list) - count($done),
            ];
        })->sortBy('name')->values();

        return ['by_reviewer' => $rows];
    }

    /** @return list<array<string, mixed>> */
    private function overdueTrend(\Closure $scope, CarbonImmutable $from, CarbonImmutable $to, int $userId): array
    {
        $out = [];
        for ($month = $from->startOfMonth(); $month->lte($to); $month = $month->addMonth()) {
            $monthEnd = $month->endOfMonth();
            $at = $monthEnd->isFuture() ? CarbonImmutable::now() : $monthEnd;
            $count = Task::withTrashed()
                ->tap($scope)
                ->when($userId, fn (Builder $q) => $q->where('assignee_id', $userId))
                ->whereNotNull('due_date')
                ->where('due_date', '<', $at->toDateString())
                ->where('tasks.created_at', '<=', $at)
                ->where(fn (Builder $q) => $q->whereNull('completed_at')->orWhere('completed_at', '>', $at))
                ->where(fn (Builder $q) => $q->whereNull('tasks.deleted_at')->orWhere('tasks.deleted_at', '>', $at))
                ->count();
            $out[] = ['month' => $month->format('Y-m'), 'overdue' => $count, 'as_of' => $at->toDateString()];
        }

        return $out;
    }

    /** @return list<array<string, mixed>> */
    private function runs(Request $request, RoutineService $routines, CarbonImmutable $from, CarbonImmutable $to): array
    {
        $runs = RoutineRun::with('project:id,name,key,color')
            ->whereHas('project', fn (Builder $project) => $project->visibleTo($request->user()))
            ->when($request->integer('project_id'), fn (Builder $q, int $id) => $q->where('project_id', $id))
            ->whereBetween('period_end', [$from->toDateString(), $to->toDateString()])
            ->orderByDesc('period_end')
            ->get();
        $progress = $routines->progress($runs);

        return $runs->map(fn (RoutineRun $run) => [
            'id' => $run->id,
            'name' => $run->name,
            'period_end' => $run->period_end->toDateString(),
            'project' => $run->project->only(['id', 'name', 'key', 'color']),
            'progress' => $progress[$run->id],
        ])->values()->all();
    }
}
