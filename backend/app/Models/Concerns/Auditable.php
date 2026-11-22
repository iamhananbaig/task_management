<?php

namespace App\Models\Concerns;

use App\Support\Audit;
use Illuminate\Database\Eloquent\SoftDeletes;

/**
 * Records create / update / delete (and restore for soft-deleting models) in the audit trail.
 * Saves made with saveQuietly() are not recorded.
 */
trait Auditable
{
    public static function bootAuditable(): void
    {
        static::created(function ($model): void {
            Audit::log('created', class_basename($model).' created', $model, Audit::snapshot($model));
        });

        static::updated(function ($model): void {
            $changes = Audit::diff($model);
            if ($changes) {
                $fields = implode(', ', array_map(fn ($key) => str_replace(['_id', '_'], ['', ' '], $key), array_keys($changes)));
                Audit::log('updated', "Changed {$fields}", $model, $changes);
            }
        });

        static::deleted(function ($model): void {
            $soft = in_array(SoftDeletes::class, class_uses_recursive($model), true) && ! $model->isForceDeleting();
            Audit::log(
                $soft ? 'deleted' : 'purged',
                $soft ? class_basename($model).' moved to the bin' : class_basename($model).' deleted permanently',
                $model,
                Audit::snapshot($model, true),
            );
        });

        if (in_array(SoftDeletes::class, class_uses_recursive(static::class), true)) {
            static::restored(function ($model): void {
                Audit::log('restored', class_basename($model).' restored from the bin', $model);
            });
        }
    }
}
