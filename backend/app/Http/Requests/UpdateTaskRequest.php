<?php

namespace App\Http\Requests;

use App\Enums\TaskPriority;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/** Status is not editable here: it changes only through workflow transitions. */
class UpdateTaskRequest extends FormRequest
{
    /** @return array<string, mixed> */
    public function rules(): array
    {
        return [
            'title' => ['sometimes', 'required', 'string', 'max:255'],
            'description' => ['nullable', 'string', 'max:20000'],
            'priority' => ['sometimes', 'required', Rule::enum(TaskPriority::class)],
            'assignee_id' => ['nullable', 'integer', 'exists:users,id'],
            'reviewer_id' => ['nullable', 'integer', 'exists:users,id'],
            'start_date' => ['nullable', 'date_format:Y-m-d'],
            'tag_ids' => ['nullable', 'array', 'max:20'],
            'tag_ids.*' => ['integer'],
            'due_date' => ['nullable', 'date_format:Y-m-d'],
        ];
    }

    public function after(): array
    {
        return [function ($validator): void {
            $task = $this->route('task');
            $start = $this->has('start_date') ? $this->input('start_date') : $task?->start_date?->format('Y-m-d');
            $due = $this->has('due_date') ? $this->input('due_date') : $task?->due_date?->format('Y-m-d');
            if ($start && $due && $due < $start) {
                $validator->errors()->add('due_date', 'The due date cannot be before the start date.');
            }
        }];
    }
}
