<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class ProjectResource extends JsonResource
{
    /** @return array<string, mixed> */
    public function toArray(Request $request): array
    {
        $user = $request->user();

        return [
            'id' => $this->id,
            'name' => $this->name,
            'key' => $this->key,
            'description' => $this->description,
            'color' => $this->color,
            'is_restricted' => $this->is_restricted,
            'escalate_after_days' => $this->escalate_after_days,
            'owner' => new UserSummaryResource($this->whenLoaded('owner')),
            'archived_at' => $this->archived_at,
            'created_at' => $this->created_at,
            'members_count' => $this->whenCounted('members'),
            'open_tasks_count' => $this->whenCounted('openTasks'),
            'done_tasks_count' => $this->whenCounted('doneTasks'),
            'overdue_tasks_count' => $this->whenCounted('overdueTasks'),
            'members' => UserSummaryResource::collection($this->whenLoaded('members')),
            'statuses' => StatusResource::collection($this->whenLoaded('statuses')),
            'transitions' => TransitionResource::collection($this->whenLoaded('transitions')),
            'can' => $user ? [
                'manage' => $user->can('manage', $this->resource),
                'delete' => $user->can('delete', $this->resource),
                'create_tasks' => ! $this->isArchived() && $user->can('create tasks'),
            ] : null,
        ];
    }
}
