<?php

namespace App\Http\Resources;

use App\Models\ProjectTransition;
use App\Services\WorkflowService;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * A task. The list form (board, lists) carries counts; the detail form (show) adds the
 * checklist, attachments, watchers, the moves the user may make and what else they may do.
 * Callers load project (with transitions + members) so available moves need no extra queries.
 */
class TaskResource extends JsonResource
{
    /** Set by TaskController::show for the full form. */
    public bool $detail = false;

    public function detailed(): static
    {
        $this->detail = true;

        return $this;
    }

    /** @return array<string, mixed> */
    public function toArray(Request $request): array
    {
        $user = $request->user();
        $project = $this->project;

        return [
            'id' => $this->id,
            'reference' => $this->reference(),
            'number' => $this->number,
            'project' => [
                'id' => $project->id,
                'key' => $project->key,
                'name' => $project->name,
                'color' => $project->color,
            ],
            'title' => $this->title,
            'description' => $this->description,
            'status' => new StatusResource($this->whenLoaded('status')),
            'priority' => $this->priority->value,
            'assignee' => new UserSummaryResource($this->whenLoaded('assignee')),
            'reviewer' => new UserSummaryResource($this->whenLoaded('reviewer')),
            'creator' => new UserSummaryResource($this->whenLoaded('creator')),
            'start_date' => $this->start_date?->format('Y-m-d'),
            'due_date' => $this->due_date?->format('Y-m-d'),
            'is_overdue' => $this->relationLoaded('status') ? $this->isOverdue() : null,
            'completed_at' => $this->completed_at,
            'position' => $this->position,
            'checklist_total' => $this->whenCounted('checklist'),
            'checklist_done' => $this->whenCounted('checklistDone'),
            'comments_count' => $this->whenCounted('comments'),
            'attachments_count' => $this->whenCounted('attachments'),
            'created_at' => $this->created_at,
            'updated_at' => $this->updated_at,
            'deleted_at' => $this->deleted_at,
            'available_transitions' => $this->when(
                $user && $project->relationLoaded('transitions'),
                fn () => app(WorkflowService::class)->available($this->resource, $user, $project->transitions)
                    ->map(fn (ProjectTransition $transition) => [
                        'id' => $transition->id,
                        'label' => $transition->label,
                        'to_status_id' => $transition->to_status_id,
                        'requires_comment' => $transition->requires_comment,
                    ])->values(),
            ),
            $this->mergeWhen($this->detail, fn () => [
                'checklist' => $this->checklist->map(fn ($item) => [
                    'id' => $item->id,
                    'title' => $item->title,
                    'is_done' => $item->is_done,
                    'position' => $item->position,
                ]),
                'attachments' => TaskAttachmentResource::collection($this->attachments),
                'watchers' => UserSummaryResource::collection($this->watchers),
                'is_watching' => $user && $this->watchers->contains('id', $user->id),
                'can' => $user ? [
                    'update' => $user->can('update', $this->resource),
                    'delete' => $user->can('delete', $this->resource),
                    'comment' => $user->can('comment', $this->resource),
                    'remind' => $user->can('remind', $this->resource),
                ] : null,
            ]),
        ];
    }
}
