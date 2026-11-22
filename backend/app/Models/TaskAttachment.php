<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\Hidden;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/** A file on a task, stored on the private "local" disk (storage volume in Docker). */
#[Fillable(['task_id', 'user_id', 'original_name', 'path', 'mime_type', 'size'])]
#[Hidden(['path'])]
class TaskAttachment extends Model
{
    protected function casts(): array
    {
        return ['size' => 'integer'];
    }

    /** @return BelongsTo<Task, $this> */
    public function task(): BelongsTo
    {
        return $this->belongsTo(Task::class);
    }

    /** @return BelongsTo<User, $this> */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
