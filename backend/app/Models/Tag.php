<?php

namespace App\Models;

use App\Models\Concerns\Auditable;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;

/** A value in a tag group ("Lahore" in Branch). Retired tags are made inactive, not deleted. */
#[Fillable(['tag_group_id', 'name', 'color', 'is_active'])]
class Tag extends Model
{
    use Auditable;

    protected function casts(): array
    {
        return ['is_active' => 'boolean'];
    }

    /** @return BelongsTo<TagGroup, $this> */
    public function group(): BelongsTo
    {
        return $this->belongsTo(TagGroup::class, 'tag_group_id');
    }

    /** @return BelongsToMany<Task, $this> */
    public function tasks(): BelongsToMany
    {
        return $this->belongsToMany(Task::class, 'task_tag');
    }
}
