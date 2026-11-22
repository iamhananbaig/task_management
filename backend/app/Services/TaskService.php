<?php

namespace App\Services;

use App\Models\Project;
use App\Models\Tag;
use App\Models\Task;
use App\Models\User;
use App\Notifications\TaskAssigned;
use App\Support\Audit;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/** Creating and editing tasks: numbering, member checks, watchers and assignment notices. */
class TaskService
{
    /**
     * @param  array<string, mixed>  $data  validated StoreTaskRequest data
     */
    public function create(Project $project, array $data, User $creator, bool $notify = true): Task
    {
        $this->assertMembers($project, $data);
        $tagIds = $this->validTagIds($data['tag_ids'] ?? []);
        unset($data['tag_ids']);

        $task = DB::transaction(function () use ($project, $data, $creator, $tagIds) {
            /** @var Project $locked */
            $locked = Project::lockForUpdate()->findOrFail($project->id);
            $status = $locked->initialStatus();

            $task = new Task($data);
            $task->project_id = $locked->id;
            $task->number = $locked->next_task_number;
            $task->status_id = $status->id;
            $task->creator_id = $creator->id;
            $task->position = (int) Task::where('status_id', $status->id)->max('position') + 1;
            $task->completed_at = $status->isDone() ? now() : null;
            $task->setRelation('project', $locked);
            foreach (['routine_run_id', 'routine_item_id'] as $link) {
                if (isset($data[$link])) {
                    $task->{$link} = $data[$link];
                }
            }
            $task->save();
            $task->tags()->sync($tagIds);
            WorkflowService::recordStatusChange($task, null, $status, $creator);

            $locked->increment('next_task_number');
            $task->watchers()->syncWithoutDetaching(array_filter([$creator->id, $task->assignee_id, $task->reviewer_id]));

            return $task;
        });

        if ($notify) {
            $this->notifyAssignment($task, $creator, null, null);
        }

        return $task;
    }

    /**
     * @param  array<string, mixed>  $data  validated UpdateTaskRequest data
     */
    public function update(Task $task, array $data, User $editor): Task
    {
        $this->assertMembers($task->project, $data);

        $previousAssignee = $task->assignee_id;
        $previousReviewer = $task->reviewer_id;
        $tagIds = array_key_exists('tag_ids', $data) ? $this->validTagIds($data['tag_ids'] ?? []) : null;
        unset($data['tag_ids']);

        $task->fill($data);
        // A new due date gets a fresh escalation
        if ($task->isDirty('due_date')) {
            $task->escalated_at = null;
        }
        $task->save();

        if ($tagIds !== null) {
            $before = $task->tags()->pluck('name')->sort()->values()->all();
            $task->tags()->sync($tagIds);
            $after = $task->tags()->pluck('name')->sort()->values()->all();
            if ($before !== $after) {
                Audit::log('tags changed', 'Tags: '.(implode(', ', $after) ?: 'none'), $task, ['tags' => [implode(', ', $before), implode(', ', $after)]]);
            }
        }
        $task->watchers()->syncWithoutDetaching(array_filter([$task->assignee_id, $task->reviewer_id]));

        $this->notifyAssignment($task, $editor, $previousAssignee, $previousReviewer);

        return $task;
    }

    /** Move a task within its column (board drag and drop). The order is not audited. */
    public function reorder(Task $task, int $position): void
    {
        DB::transaction(function () use ($task, $position) {
            $ids = Task::where('status_id', $task->status_id)
                ->whereKeyNot($task->id)
                ->orderBy('position')->orderBy('id')
                ->lockForUpdate()
                ->pluck('id')
                ->all();
            array_splice($ids, max(0, min($position, count($ids))), 0, [$task->id]);
            foreach ($ids as $index => $id) {
                Task::whereKey($id)->update(['position' => $index]);
            }
        });
    }

    /**
     * Active tags only, at most one per tag group.
     *
     * @param  array<int|string>  $ids
     * @return list<int>
     */
    public function validTagIds(array $ids): array
    {
        $ids = array_values(array_unique(array_map('intval', $ids)));
        if (! $ids) {
            return [];
        }
        $tags = Tag::with('group')->whereIn('id', $ids)->where('is_active', true)->get();
        if ($tags->count() !== count($ids)) {
            throw ValidationException::withMessages(['tag_ids' => ['A chosen tag does not exist or is no longer in use.']]);
        }
        $duplicate = $tags->groupBy('tag_group_id')->first(fn ($group) => $group->count() > 1);
        if ($duplicate) {
            throw ValidationException::withMessages(['tag_ids' => ["Choose one {$duplicate->first()->group->name} only."]]);
        }

        return $ids;
    }

    /**
     * Assignee and reviewer must be members of the project.
     *
     * @param  array<string, mixed>  $data
     */
    private function assertMembers(Project $project, array $data): void
    {
        $memberIds = $project->members()->pluck('users.id');
        $errors = [];
        foreach (['assignee_id' => 'assignee', 'reviewer_id' => 'reviewer'] as $field => $label) {
            if (! empty($data[$field]) && ! $memberIds->contains((int) $data[$field])) {
                $errors[$field] = ["The {$label} must be a member of the project."];
            }
        }
        if ($errors) {
            throw ValidationException::withMessages($errors);
        }
    }

    private function notifyAssignment(Task $task, User $actor, ?int $previousAssignee, ?int $previousReviewer): void
    {
        if ($task->assignee_id && $task->assignee_id !== $previousAssignee && $task->assignee_id !== $actor->id) {
            $task->assignee?->notify(new TaskAssigned($task, $actor, 'assignee'));
        }
        if ($task->reviewer_id && $task->reviewer_id !== $previousReviewer && $task->reviewer_id !== $actor->id) {
            $task->reviewer?->notify(new TaskAssigned($task, $actor, 'reviewer'));
        }
    }
}
