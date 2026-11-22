<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Guarded;
use Illuminate\Database\Eloquent\Model;

/** A task entering a status (from_* null on creation). Append-only; feeds the review-time report. */
#[Guarded(['id'])]
class TaskStatusChange extends Model
{
    public const UPDATED_AT = null;

    protected function casts(): array
    {
        return ['created_at' => 'datetime'];
    }
}
