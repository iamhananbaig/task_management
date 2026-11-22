<?php

namespace App\Models;

use App\Enums\TransitionActor;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/** An allowed move between two statuses of a project, and who may make it. */
#[Fillable(['project_id', 'from_status_id', 'to_status_id', 'label', 'actors', 'requires_comment', 'requires_attachment', 'position'])]
class ProjectTransition extends Model
{
    protected function casts(): array
    {
        return ['actors' => 'array', 'requires_comment' => 'boolean', 'requires_attachment' => 'boolean', 'position' => 'integer'];
    }

    /** @return BelongsTo<ProjectStatus, $this> */
    public function fromStatus(): BelongsTo
    {
        return $this->belongsTo(ProjectStatus::class, 'from_status_id');
    }

    /** @return BelongsTo<ProjectStatus, $this> */
    public function toStatus(): BelongsTo
    {
        return $this->belongsTo(ProjectStatus::class, 'to_status_id');
    }

    /** @return list<TransitionActor> */
    public function actorList(): array
    {
        return array_values(array_filter(array_map(fn ($actor) => TransitionActor::tryFrom($actor), $this->actors ?? [])));
    }
}
