<?php

namespace App\Models;

use App\Models\Concerns\Auditable;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

/** A kind of tag (Entity, Branch, Cost centre). A task has at most one tag per group. */
#[Fillable(['name', 'position'])]
class TagGroup extends Model
{
    use Auditable;

    protected function casts(): array
    {
        return ['position' => 'integer'];
    }

    /** @return HasMany<Tag, $this> */
    public function tags(): HasMany
    {
        return $this->hasMany(Tag::class)->orderBy('name');
    }
}
