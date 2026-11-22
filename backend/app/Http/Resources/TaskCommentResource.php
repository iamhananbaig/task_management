<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class TaskCommentResource extends JsonResource
{
    /** @return array<string, mixed> */
    public function toArray(Request $request): array
    {
        $user = $request->user();

        return [
            'id' => $this->id,
            'body' => $this->body,
            'user' => new UserSummaryResource($this->whenLoaded('user')),
            'created_at' => $this->created_at,
            'edited_at' => $this->edited_at,
            'can' => $user ? [
                'update' => $this->user_id === $user->id,
                'delete' => $this->user_id === $user->id || $user->can('delete tasks'),
            ] : null,
        ];
    }
}
