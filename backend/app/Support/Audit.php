<?php

namespace App\Support;

use App\Models\AuditLog;
use App\Models\Project;
use App\Models\Task;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\Auth;

/**
 * Audit trail writer (same design as ifrs16). Model changes are recorded automatically by the
 * Auditable trait; actions that are not a plain model save (workflow move, sign-in, role
 * permissions changed, reminder emailed) call Audit::log() explicitly.
 * Rows carry project_id / task_id so a task's Activity tab and the dashboard can read them.
 */
class Audit
{
    /** Attributes never written to the log. */
    private const IGNORED = [
        'created_at', 'updated_at', 'deleted_at', 'password', 'remember_token', 'password_changed_at',
        'position', 'next_task_number', 'last_reminded_on',
    ];

    /**
     * @param  array<string, array{0: mixed, 1: mixed}>  $changes  field => [old, new]
     */
    public static function log(string $action, string $summary, ?Model $subject = null, array $changes = [], ?string $subjectType = null, ?Model $user = null): AuditLog
    {
        $user ??= Auth::user();

        return AuditLog::create([
            'user_id' => $user?->getKey(),
            'user_name' => $user?->getAttribute('name'),
            'action' => $action,
            'subject_type' => $subjectType ?? ($subject ? class_basename($subject) : 'System'),
            'subject_id' => $subject?->getKey(),
            'subject_label' => $subject ? self::label($subject) : null,
            'project_id' => self::projectIdOf($subject),
            'task_id' => self::taskIdOf($subject),
            'summary' => mb_substr($summary, 0, 500),
            'changes' => $changes ?: null,
            'ip_address' => request()?->ip(),
        ]);
    }

    /**
     * field => [old, new] for a model that was just updated.
     *
     * @return array<string, array{0: mixed, 1: mixed}>
     */
    public static function diff(Model $model): array
    {
        $changes = [];
        foreach ($model->getChanges() as $key => $new) {
            if (self::ignored($model, $key)) {
                continue;
            }
            $old = self::normalise($model->getOriginal($key));
            $new = self::normalise($model->getAttribute($key));
            if ($old === $new) {
                continue;
            }
            $changes[$key] = [$old, $new];
        }

        return $changes;
    }

    /**
     * field => [null, value] (created) or [value, null] (deleted).
     *
     * @return array<string, array{0: mixed, 1: mixed}>
     */
    public static function snapshot(Model $model, bool $asOld = false): array
    {
        $out = [];
        foreach (array_keys($model->getAttributes()) as $key) {
            if (self::ignored($model, $key) || $key === $model->getKeyName()) {
                continue;
            }
            $value = self::normalise($model->getAttribute($key));
            if ($value === null || $value === '') {
                continue;
            }
            $out[$key] = $asOld ? [$value, null] : [null, $value];
        }

        return $out;
    }

    public static function label(Model $model): string
    {
        return match (true) {
            $model instanceof Task => $model->reference().' · '.$model->title,
            isset($model->name) => (string) $model->name,
            isset($model->title) => (string) $model->title,
            default => class_basename($model).' #'.$model->getKey(),
        };
    }

    private static function ignored(Model $model, string $key): bool
    {
        return in_array($key, self::IGNORED, true) || in_array($key, $model->getHidden(), true);
    }

    private static function projectIdOf(?Model $subject): ?int
    {
        if ($subject instanceof Project) {
            return $subject->id;
        }

        return $subject && isset($subject->project_id) ? (int) $subject->project_id : null;
    }

    private static function taskIdOf(?Model $subject): ?int
    {
        if ($subject instanceof Task) {
            return $subject->id;
        }

        return $subject && isset($subject->task_id) ? (int) $subject->task_id : null;
    }

    private static function normalise(mixed $value): mixed
    {
        if ($value instanceof \BackedEnum) {
            return $value->value;
        }
        if ($value instanceof \DateTimeInterface) {
            return $value->format('H:i:s') === '00:00:00' ? $value->format('Y-m-d') : $value->format('Y-m-d H:i');
        }
        if (is_bool($value)) {
            return $value;
        }
        if (is_string($value) && preg_match('/^\d{4}-\d{2}-\d{2}( 00:00:00)?$/', $value)) {
            return substr($value, 0, 10);
        }

        return $value;
    }
}
