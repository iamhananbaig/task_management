<?php

namespace App\Models;

use App\Enums\StatusType;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/** One column of a project's board. Changed only through the workflow editor (audited there). */
#[Fillable(['project_id', 'name', 'color', 'type', 'position'])]
class ProjectStatus extends Model
{
    protected function casts(): array
    {
        return ['type' => StatusType::class, 'position' => 'integer'];
    }

    /** @return BelongsTo<Project, $this> */
    public function project(): BelongsTo
    {
        return $this->belongsTo(Project::class);
    }

    /** @return HasMany<Task, $this> */
    public function tasks(): HasMany
    {
        return $this->hasMany(Task::class, 'status_id');
    }

    public function isDone(): bool
    {
        return $this->type === StatusType::Done;
    }
}
