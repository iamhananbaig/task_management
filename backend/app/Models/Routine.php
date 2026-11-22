<?php

namespace App\Models;

use App\Enums\RoutineFrequency;
use App\Models\Concerns\Auditable;
use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * Recurring work in a project: its items become a batch of tasks (a run) once per period —
 * one item for a recurring task, many for a period close checklist. See App\Services\RoutineService.
 */
#[Fillable(['project_id', 'name', 'description', 'frequency', 'lead_days', 'next_period_end', 'is_active', 'created_by'])]
class Routine extends Model
{
    use Auditable;

    protected function casts(): array
    {
        return [
            'frequency' => RoutineFrequency::class,
            'lead_days' => 'integer',
            'next_period_end' => 'immutable_date:Y-m-d',
            'is_active' => 'boolean',
        ];
    }

    /** @return BelongsTo<Project, $this> */
    public function project(): BelongsTo
    {
        return $this->belongsTo(Project::class);
    }

    /** @return HasMany<RoutineItem, $this> */
    public function items(): HasMany
    {
        return $this->hasMany(RoutineItem::class)->orderBy('position')->orderBy('id');
    }

    /** @return HasMany<RoutineRun, $this> */
    public function runs(): HasMany
    {
        return $this->hasMany(RoutineRun::class)->latest('period_end');
    }

    /** @return BelongsTo<User, $this> */
    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    /** The day the next run is created automatically. */
    public function nextRunOn(): CarbonImmutable
    {
        return $this->next_period_end->subDays($this->lead_days);
    }
}
