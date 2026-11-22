<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class AuditLogResource extends JsonResource
{
    /** @return array<string, mixed> */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'user_id' => $this->user_id,
            'user_name' => $this->user_name,
            'action' => $this->action,
            'subject_type' => $this->subject_type,
            'subject_id' => $this->subject_id,
            'subject_label' => $this->subject_label,
            'project_id' => $this->project_id,
            'task_id' => $this->task_id,
            'summary' => $this->summary,
            'changes' => $this->changes,
            'ip_address' => $this->when($request->user()?->can('view audit log'), $this->ip_address),
            'created_at' => $this->created_at,
        ];
    }
}
