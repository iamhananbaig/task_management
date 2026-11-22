<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/** One period of a routine ("June 2026 close") and the tasks created for it. */
#[Fillable(['routine_id', 'project_id', 'name', 'period_start', 'period_end', 'started_by'])]
class RoutineRun extends Model
{
    protected function casts(): array
    {
        return ['period_start' => 'immutable_date:Y-m-d', 'period_end' => 'immutable_date:Y-m-d'];
    }

    /** @return BelongsTo<Routine, $this> */
    public function routine(): BelongsTo
    {
        return $this->belongsTo(Routine::class);
    }

    /** @return BelongsTo<Project, $this> */
    public function project(): BelongsTo
    {
        return $this->belongsTo(Project::class);
    }

    /** @return HasMany<Task, $this> */
    public function tasks(): HasMany
    {
        return $this->hasMany(Task::class);
    }
}
