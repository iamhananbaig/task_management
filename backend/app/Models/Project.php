<?php

namespace App\Models;

use App\Enums\ProjectRole;
use App\Models\Concerns\Auditable;
use Database\Factories\ProjectFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;

#[Fillable(['name', 'key', 'description', 'color', 'is_restricted', 'escalate_after_days', 'owner_id', 'archived_at'])]
class Project extends Model
{
    /** @use HasFactory<ProjectFactory> */
    use Auditable, HasFactory;

    protected function casts(): array
    {
        return ['archived_at' => 'datetime', 'is_restricted' => 'boolean', 'escalate_after_days' => 'integer'];
    }

    /** @return BelongsTo<User, $this> */
    public function owner(): BelongsTo
    {
        return $this->belongsTo(User::class, 'owner_id');
    }

    /** @return BelongsToMany<User, $this> */
    public function members(): BelongsToMany
    {
        return $this->belongsToMany(User::class, 'project_members')->withPivot('role')->withTimestamps();
    }

    /** @return HasMany<ProjectStatus, $this> */
    public function statuses(): HasMany
    {
        return $this->hasMany(ProjectStatus::class)->orderBy('position')->orderBy('id');
    }

    /** @return HasMany<ProjectTransition, $this> */
    public function transitions(): HasMany
    {
        return $this->hasMany(ProjectTransition::class)->orderBy('position')->orderBy('id');
    }

    /** @return HasMany<Task, $this> */
    public function tasks(): HasMany
    {
        return $this->hasMany(Task::class);
    }

    /** @return HasMany<Routine, $this> */
    public function routines(): HasMany
    {
        return $this->hasMany(Routine::class)->orderBy('name');
    }

    /**
     * Projects the user may open: the ones they belong to; with "view all projects" every project
     * except restricted ones, which also need membership or "view restricted projects".
     */
    public function scopeVisibleTo(Builder $query, User $user): void
    {
        $member = fn (Builder $members) => $members->whereKey($user->id);

        if (! $user->can('view all projects')) {
            $query->whereHas('members', $member);

            return;
        }
        if (! $user->can('view restricted projects')) {
            $query->where(fn (Builder $inner) => $inner->where('is_restricted', false)->orWhereHas('members', $member));
        }
    }

    /** Same rule as scopeVisibleTo, for one project. */
    public function isVisibleTo(User $user): bool
    {
        if ($this->isMember($user)) {
            return true;
        }

        return $user->can('view all projects') && (! $this->is_restricted || $user->can('view restricted projects'));
    }

    public function isMember(User $user): bool
    {
        if ($this->relationLoaded('members')) {
            return $this->members->contains('id', $user->id);
        }

        return $this->members()->whereKey($user->id)->exists();
    }

    public function isManager(User $user): bool
    {
        $member = $this->relationLoaded('members')
            ? $this->members->firstWhere('id', $user->id)
            : $this->members()->whereKey($user->id)->first();

        return $member?->pivot?->role === ProjectRole::Manager->value;
    }

    public function isArchived(): bool
    {
        return $this->archived_at !== null;
    }

    /** The status new tasks start in: the first on the board. */
    public function initialStatus(): ProjectStatus
    {
        return $this->statuses()->firstOrFail();
    }
}
