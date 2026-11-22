<?php

namespace App\Http\Requests;

use App\Enums\TaskPriority;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/** Authorized in the controller. Assignee / reviewer membership is checked by TaskService. */
class StoreTaskRequest extends FormRequest
{
    /** @return array<string, mixed> */
    public function rules(): array
    {
        return [
            'title' => ['required', 'string', 'max:255'],
            'description' => ['nullable', 'string', 'max:20000'],
            'priority' => ['nullable', Rule::enum(TaskPriority::class)],
            'assignee_id' => ['nullable', 'integer', 'exists:users,id'],
            'reviewer_id' => ['nullable', 'integer', 'exists:users,id'],
            'start_date' => ['nullable', 'date_format:Y-m-d'],
            'tag_ids' => ['nullable', 'array', 'max:20'],
            'tag_ids.*' => ['integer'],
            'due_date' => ['nullable', 'date_format:Y-m-d', 'after_or_equal:start_date'],
        ];
    }

    /** @return array<string, mixed> */
    public function validated($key = null, $default = null): mixed
    {
        $data = parent::validated($key, $default);
        if ($key === null && empty($data['priority'])) {
            $data['priority'] = TaskPriority::Medium->value;
        }

        return $data;
    }
}
