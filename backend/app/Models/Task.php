<?php

namespace App\Models;

use App\Enums\StatusType;
use App\Enums\TaskPriority;
use App\Models\Concerns\Auditable;
use Database\Factories\TaskFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

/**
 * status_id, number and project_id are not fillable: the status changes only through
 * App\Services\WorkflowService, the number is assigned by App\Services\TaskService.
 */
#[Fillable(['title', 'description', 'priority', 'assignee_id', 'reviewer_id', 'start_date', 'due_date'])]
class Task extends Model
{
    /** @use HasFactory<TaskFactory> */
    use Auditable, HasFactory, SoftDeletes;

    protected function casts(): array
    {
        return [
            'priority' => TaskPriority::class,
            'start_date' => 'date:Y-m-d',
            'due_date' => 'date:Y-m-d',
            'completed_at' => 'datetime',
            'last_reminded_on' => 'date:Y-m-d',
            'escalated_at' => 'datetime',
            'number' => 'integer',
            'position' => 'integer',
        ];
    }

    /** "WEB-12" */
    public function reference(): string
    {
        $key = $this->relationLoaded('project') ? $this->project?->key : Project::whereKey($this->project_id)->value('key');

        return ($key ?? 'TASK').'-'.$this->number;
    }

    /** @return BelongsTo<Project, $this> */
    public function project(): BelongsTo
    {
        return $this->belongsTo(Project::class);
    }

    /** @return BelongsTo<ProjectStatus, $this> */
    public function status(): BelongsTo
    {
        return $this->belongsTo(ProjectStatus::class, 'status_id');
    }

    /** @return BelongsTo<User, $this> */
    public function assignee(): BelongsTo
    {
        return $this->belongsTo(User::class, 'assignee_id');
    }

    /** @return BelongsTo<User, $this> */
    public function reviewer(): BelongsTo
    {
        return $this->belongsTo(User::class, 'reviewer_id');
    }

    /** @return BelongsTo<User, $this> */
    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'creator_id');
    }

    /** @return HasMany<TaskChecklistItem, $this> */
    public function checklist(): HasMany
    {
        return $this->hasMany(TaskChecklistItem::class)->orderBy('position')->orderBy('id');
    }

    /** @return HasMany<TaskComment, $this> */
    public function comments(): HasMany
    {
        return $this->hasMany(TaskComment::class)->orderBy('created_at')->orderBy('id');
    }

    /** @return HasMany<TaskAttachment, $this> */
    public function attachments(): HasMany
    {
        return $this->hasMany(TaskAttachment::class)->latest('id');
    }

    /** @return BelongsToMany<User, $this> */
    public function watchers(): BelongsToMany
    {
        return $this->belongsToMany(User::class, 'task_watchers')->withTimestamps();
    }

    /** @return BelongsToMany<Tag, $this> */
    public function tags(): BelongsToMany
    {
        return $this->belongsToMany(Tag::class, 'task_tag');
    }

    /** @return BelongsTo<RoutineRun, $this> */
    public function routineRun(): BelongsTo
    {
        return $this->belongsTo(RoutineRun::class);
    }

    /** Tasks in projects the user may open (see Project::scopeVisibleTo). */
    public function scopeVisibleTo(Builder $query, User $user): void
    {
        if ($user->can('view all projects') && $user->can('view restricted projects')) {
            return;
        }
        $query->whereHas('project', fn (Builder $project) => $project->visibleTo($user));
    }

    /** Not in a "done" status. */
    public function scopeOpen(Builder $query): void
    {
        $query->whereHas('status', fn (Builder $status) => $status->where('type', '!=', StatusType::Done->value));
    }

    public function isDone(): bool
    {
        return $this->status?->isDone() ?? false;
    }

    public function isOverdue(): bool
    {
        return $this->due_date !== null && $this->due_date->lt(today()) && ! $this->isDone();
    }

    /** Assignee, reviewer, creator and watchers — the people told about changes. */
    public function stakeholderIds(): array
    {
        return collect([$this->assignee_id, $this->reviewer_id, $this->creator_id])
            ->merge($this->watchers()->pluck('users.id'))
            ->filter()
            ->unique()
            ->values()
            ->all();
    }
}
