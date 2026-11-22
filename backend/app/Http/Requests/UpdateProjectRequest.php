<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/** Authorized in the controller (project managers may edit without "manage projects"). */
class UpdateProjectRequest extends FormRequest
{
    /** @return array<string, mixed> */
    public function rules(): array
    {
        return [
            'name' => ['sometimes', 'required', 'string', 'max:255'],
            'key' => ['sometimes', 'required', 'string', 'min:2', 'max:10', 'regex:/^[A-Za-z][A-Za-z0-9]*$/', Rule::unique('projects', 'key')->ignore($this->route('project'))],
            'description' => ['nullable', 'string', 'max:5000'],
            'color' => ['nullable', 'string', 'max:20'],
            'is_restricted' => ['sometimes', 'boolean'],
            'escalate_after_days' => ['nullable', 'integer', 'min:1', 'max:60'],
        ];
    }
}
