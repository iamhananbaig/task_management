<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/** A subtask / checklist line of a task. */
#[Fillable(['title', 'is_done', 'position'])]
class TaskChecklistItem extends Model
{
    protected function casts(): array
    {
        return ['is_done' => 'boolean', 'position' => 'integer'];
    }

    /** @return BelongsTo<Task, $this> */
    public function task(): BelongsTo
    {
        return $this->belongsTo(Task::class);
    }
}
