<?php

namespace App\Services;

use App\Enums\StatusType;
use App\Enums\TransitionActor;
use App\Models\Project;
use App\Models\ProjectStatus;
use App\Models\ProjectTransition;
use App\Models\Task;
use App\Models\TaskComment;
use App\Models\TaskStatusChange;
use App\Models\User;
use App\Notifications\TaskMoved;
use App\Support\Audit;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Notification;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

/**
 * A project's workflow: which statuses exist, which moves are allowed, and who may make them.
 *
 * Definition format (templates, project create, workflow editor):
 *   statuses:    [{key, name, color, type}]           key: any string; existing statuses use their id
 *   transitions: [{from, to, label, actors, requires_comment}]   from / to: status keys
 */
class WorkflowService
{
    /** Users with this permission may make any defined move, whoever its actors are. */
    public const OVERRIDE_PERMISSION = 'override workflow';

    /**
     * Validation rules for a definition.
     *
     * @return array<string, mixed>
     */
    public static function rules(string $prefix = ''): array
    {
        return [
            "{$prefix}statuses" => ['required', 'array', 'min:1', 'max:20'],
            "{$prefix}statuses.*.key" => ['required', 'distinct'],
            "{$prefix}statuses.*.name" => ['required', 'string', 'max:50', 'distinct:ignore_case'],
            "{$prefix}statuses.*.color" => ['nullable', 'string', 'max:20'],
            "{$prefix}statuses.*.type" => ['required', Rule::enum(StatusType::class)],
            "{$prefix}transitions" => ['present', 'array', 'max:100'],
            "{$prefix}transitions.*.from" => ['required'],
            "{$prefix}transitions.*.to" => ['required'],
            "{$prefix}transitions.*.label" => ['required', 'string', 'max:50'],
            "{$prefix}transitions.*.actors" => ['required', 'array', 'min:1'],
            "{$prefix}transitions.*.actors.*" => [Rule::enum(TransitionActor::class)],
            "{$prefix}transitions.*.requires_comment" => ['boolean'],
            "{$prefix}transitions.*.requires_attachment" => ['boolean'],
        ];
    }

    /**
     * Rules that need the whole definition: transitions point at listed statuses, at least one
     * "done" status exists.
     *
     * @param  array{statuses: array, transitions: array}  $definition
     */
    public function assertConsistent(array $definition): void
    {
        $keys = collect($definition['statuses'])->pluck('key')->map(fn ($key) => (string) $key);
        $errors = [];

        if (! collect($definition['statuses'])->contains(fn ($status) => $status['type'] === StatusType::Done->value)) {
            $errors['statuses'] = ['At least one status must be of type "done" so tasks can be completed.'];
        }
        foreach ($definition['transitions'] as $index => $transition) {
            if (! $keys->contains((string) $transition['from']) || ! $keys->contains((string) $transition['to'])) {
                $errors["transitions.{$index}"] = ['This move refers to a status that is not in the list.'];
            } elseif ((string) $transition['from'] === (string) $transition['to']) {
                $errors["transitions.{$index}"] = ['A move must go to a different status.'];
            }
        }

        if ($errors) {
            throw ValidationException::withMessages($errors);
        }
    }

    /**
     * Create a new project's statuses and transitions from a definition.
     *
     * @param  array{statuses: array, transitions: array}  $definition
     */
    public function install(Project $project, array $definition): void
    {
        $this->assertConsistent($definition);

        $ids = [];
        foreach (array_values($definition['statuses']) as $position => $status) {
            $ids[(string) $status['key']] = $project->statuses()->create([
                'name' => $status['name'],
                'color' => $status['color'] ?? 'gray',
                'type' => $status['type'],
                'position' => $position,
            ])->id;
        }
        $this->createTransitions($project, $definition['transitions'], $ids);
    }

    /**
     * Replace a project's workflow (the workflow editor). Statuses keyed by their id are kept
     * and updated; others are created; missing ones are removed. A removed status that still
     * holds tasks needs a target in $reassign (old status id => new status key).
     *
     * @param  array{statuses: array, transitions: array}  $definition
     * @param  array<int|string, int|string>  $reassign
     */
    public function replace(Project $project, array $definition, array $reassign = []): void
    {
        $this->assertConsistent($definition);

        DB::transaction(function () use ($project, $definition, $reassign) {
            $existing = $project->statuses()->lockForUpdate()->get()->keyBy('id');
            $before = $this->describe($project);

            $ids = [];
            $pending = [];
            foreach (array_values($definition['statuses']) as $position => $status) {
                $key = (string) $status['key'];
                $attributes = [
                    'name' => $status['name'],
                    'color' => $status['color'] ?? 'gray',
                    'type' => $status['type'],
                    'position' => $position,
                ];
                $current = ctype_digit($key) ? $existing->get((int) $key) : null;
                if ($current) {
                    // Free the name first, in case two statuses swap names
                    $current->forceFill(['name' => '__'.$current->id])->save();
                    $ids[$key] = $current->id;
                } else {
                    $ids[$key] = $project->statuses()->create($attributes)->id;
                }
                $pending[$ids[$key]] = $attributes;
            }
            foreach ($pending as $id => $attributes) {
                ProjectStatus::whereKey($id)->update($attributes);
            }

            $removed = $existing->keys()->diff(array_values($ids));
            foreach ($removed as $statusId) {
                $count = Task::withTrashed()->where('status_id', $statusId)->count();
                if ($count === 0) {
                    continue;
                }
                $target = $reassign[$statusId] ?? null;
                if ($target === null || ! isset($ids[(string) $target])) {
                    throw ValidationException::withMessages([
                        'reassign' => ["\"{$existing[$statusId]->name}\" still has {$count} task(s). Choose the status to move them to."],
                    ]);
                }
                Task::withTrashed()->where('status_id', $statusId)->update(['status_id' => $ids[(string) $target]]);
            }

            $project->transitions()->delete();
            ProjectStatus::whereIn('id', $removed)->delete();
            $this->createTransitions($project, $definition['transitions'], $ids);

            $this->syncCompletedAt($project);
            Audit::log('workflow changed', 'Changed the workflow', $project, ['workflow' => [$before, $this->describe($project)]]);
        });
    }

    /**
     * The project's current workflow as a definition (keys = status ids), e.g. to save as a template.
     *
     * @return array{statuses: list<array<string, mixed>>, transitions: list<array<string, mixed>>}
     */
    public function definitionOf(Project $project): array
    {
        $project->load(['statuses', 'transitions']);

        return [
            'statuses' => $project->statuses->map(fn (ProjectStatus $status) => [
                'key' => (string) $status->id,
                'name' => $status->name,
                'color' => $status->color,
                'type' => $status->type->value,
            ])->values()->all(),
            'transitions' => $project->transitions->map(fn (ProjectTransition $transition) => [
                'from' => (string) $transition->from_status_id,
                'to' => (string) $transition->to_status_id,
                'label' => $transition->label,
                'actors' => $transition->actors,
                'requires_comment' => $transition->requires_comment,
                'requires_attachment' => $transition->requires_attachment,
            ])->values()->all(),
        ];
    }

    /**
     * Moves the user may make on the task right now.
     *
     * @param  Collection<int, ProjectTransition>|null  $transitions  the project's transitions, when already loaded
     * @return Collection<int, ProjectTransition>
     */
    public function available(Task $task, User $user, ?Collection $transitions = null): Collection
    {
        $transitions ??= $task->project->transitions;

        return $transitions
            ->where('from_status_id', $task->status_id)
            ->filter(fn (ProjectTransition $transition) => $this->allows($transition, $task, $user))
            ->values();
    }

    public function allows(ProjectTransition $transition, Task $task, User $user): bool
    {
        if ($task->project->isArchived() || $task->trashed()) {
            return false;
        }
        if ($user->can(self::OVERRIDE_PERMISSION)) {
            return true;
        }

        foreach ($transition->actorList() as $actor) {
            $matches = match ($actor) {
                TransitionActor::Assignee => $task->assignee_id === $user->id,
                TransitionActor::Reviewer => $task->reviewer_id === $user->id,
                TransitionActor::Creator => $task->creator_id === $user->id,
                TransitionActor::ProjectManager => $task->project->isManager($user),
                TransitionActor::AnyEditor => $user->can('edit tasks'),
            };
            if ($matches) {
                return true;
            }
        }

        return false;
    }

    /** Make a move. Refused (422) when it isn't allowed for this user or needs a comment. */
    public function move(Task $task, ProjectTransition $transition, User $user, ?string $comment = null): Task
    {
        $comment = trim((string) $comment) ?: null;

        $task = DB::transaction(function () use ($task, $transition, $user, $comment) {
            /** @var Task $locked */
            $locked = Task::with(['project.members', 'status'])->lockForUpdate()->findOrFail($task->id);

            if ($transition->project_id !== $locked->project_id || $transition->from_status_id !== $locked->status_id) {
                throw ValidationException::withMessages(['transition' => ['This move is not possible from the task\'s current status. Reload and try again.']]);
            }
            if (! $this->allows($transition, $locked, $user)) {
                $who = implode(' or ', array_map(fn (TransitionActor $actor) => strtolower($actor->label()), $transition->actorList()));
                throw ValidationException::withMessages(['transition' => ["Only the {$who} can \"{$transition->label}\" this task."]]);
            }
            if ($transition->requires_comment && $comment === null) {
                throw ValidationException::withMessages(['comment' => ["\"{$transition->label}\" needs a comment explaining why."]]);
            }
            if ($transition->requires_attachment && ! $locked->attachments()->exists()) {
                throw ValidationException::withMessages(['attachment' => ["Attach the supporting document before \"{$transition->label}\"."]]);
            }

            $from = $locked->status;
            $to = $transition->toStatus;

            $locked->status_id = $to->id;
            $locked->completed_at = $to->isDone() ? ($locked->completed_at ?? now()) : null;
            $locked->position = (int) Task::where('status_id', $to->id)->max('position') + 1;
            $locked->saveQuietly();
            self::recordStatusChange($locked, $from, $to, $user);

            if ($comment !== null) {
                TaskComment::create(['task_id' => $locked->id, 'user_id' => $user->id, 'body' => $comment]);
            }

            Audit::log(
                'moved',
                "{$transition->label}: {$from->name} → {$to->name}".($comment ? " — {$comment}" : ''),
                $locked,
                ['status' => [$from->name, $to->name]],
            );

            return $locked->setRelation('status', $to);
        });

        $recipients = collect($task->stakeholderIds())->reject(fn ($id) => $id === $user->id);
        Notification::send(User::whereIn('id', $recipients)->where('is_active', true)->get(), new TaskMoved($task, $transition, $user, $comment));

        return $task;
    }

    /** One row per status change (from null on creation), for the review-time report. */
    public static function recordStatusChange(Task $task, ?ProjectStatus $from, ProjectStatus $to, ?User $user): void
    {
        TaskStatusChange::create([
            'task_id' => $task->id,
            'project_id' => $task->project_id,
            'from_status_id' => $from?->id,
            'to_status_id' => $to->id,
            'from_type' => $from?->type->value,
            'to_type' => $to->type->value,
            'user_id' => $user?->id,
        ]);
    }

    /**
     * @param  array<string, int>  $ids  status key => id
     */
    private function createTransitions(Project $project, array $transitions, array $ids): void
    {
        foreach (array_values($transitions) as $position => $transition) {
            $project->transitions()->create([
                'from_status_id' => $ids[(string) $transition['from']],
                'to_status_id' => $ids[(string) $transition['to']],
                'label' => $transition['label'],
                'actors' => array_values(array_unique($transition['actors'])),
                'requires_comment' => (bool) ($transition['requires_comment'] ?? false),
                'requires_attachment' => (bool) ($transition['requires_attachment'] ?? false),
                'position' => $position,
            ]);
        }
    }

    /** Tasks in a status that changed to / from "done" get completed_at set / cleared. */
    private function syncCompletedAt(Project $project): void
    {
        $doneIds = $project->statuses()->where('type', StatusType::Done->value)->pluck('id');
        Task::withTrashed()->where('project_id', $project->id)->whereIn('status_id', $doneIds)->whereNull('completed_at')->update(['completed_at' => now()]);
        Task::withTrashed()->where('project_id', $project->id)->whereNotIn('status_id', $doneIds)->whereNotNull('completed_at')->update(['completed_at' => null]);
    }

    /** Short text form of the workflow for the audit log. */
    private function describe(Project $project): string
    {
        $statuses = $project->statuses()->get()->keyBy('id');

        return $statuses->pluck('name')->implode(' | ').' ; '.$project->transitions()->get()
            ->map(fn (ProjectTransition $transition) => ($statuses[$transition->from_status_id]->name ?? '?').' → '.($statuses[$transition->to_status_id]->name ?? '?').' ('.$transition->label.')')
            ->implode(', ');
    }
}
