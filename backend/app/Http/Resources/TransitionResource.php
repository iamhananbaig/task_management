<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class TransitionResource extends JsonResource
{
    /** @return array<string, mixed> */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'from_status_id' => $this->from_status_id,
            'to_status_id' => $this->to_status_id,
            'label' => $this->label,
            'actors' => $this->actors,
            'requires_comment' => $this->requires_comment,
            'requires_attachment' => $this->requires_attachment,
        ];
    }
}
