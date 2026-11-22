<?php

namespace App\Models;

use App\Models\Concerns\Auditable;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;

/** A reusable workflow (statuses + transitions) copied into a project when it is created. */
#[Fillable(['name', 'description', 'definition', 'is_default'])]
class WorkflowTemplate extends Model
{
    use Auditable;

    protected function casts(): array
    {
        return ['definition' => 'array', 'is_default' => 'boolean'];
    }
}
