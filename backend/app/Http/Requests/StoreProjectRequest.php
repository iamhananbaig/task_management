<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreProjectRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->can('manage projects') ?? false;
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        return [
            'name' => ['required', 'string', 'max:255'],
            'key' => ['required', 'string', 'min:2', 'max:10', 'regex:/^[A-Za-z][A-Za-z0-9]*$/', 'unique:projects,key'],
            'description' => ['nullable', 'string', 'max:5000'],
            'color' => ['nullable', 'string', 'max:20'],
            'is_restricted' => ['boolean'],
            'escalate_after_days' => ['nullable', 'integer', 'min:1', 'max:60'],
            'workflow_template_id' => ['nullable', 'exists:workflow_templates,id'],
            'member_ids' => ['nullable', 'array'],
            'member_ids.*' => ['integer', Rule::exists('users', 'id')->where('is_active', true)],
        ];
    }

    /** @return array<string, string> */
    public function messages(): array
    {
        return ['key.regex' => 'The key must start with a letter and use only letters and numbers (e.g. WEB).'];
    }
}
