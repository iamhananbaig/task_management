<?php

namespace App\Models;

use App\Enums\DueRule;
use App\Enums\TaskPriority;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/** One task of a routine, copied into each run. */
#[Fillable(['routine_id', 'title', 'description', 'priority', 'assignee_id', 'reviewer_id', 'checklist', 'tag_ids', 'due_rule', 'due_value', 'position'])]
class RoutineItem extends Model
{
    protected function casts(): array
    {
        return [
            'priority' => TaskPriority::class,
            'due_rule' => DueRule::class,
            'due_value' => 'integer',
            'checklist' => 'array',
            'tag_ids' => 'array',
            'position' => 'integer',
        ];
    }

    /** @return BelongsTo<Routine, $this> */
    public function routine(): BelongsTo
    {
        return $this->belongsTo(Routine::class);
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
}
