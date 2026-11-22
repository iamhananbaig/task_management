<?php

namespace App\Support;

/**
 * The review workflow new projects start with (unless another template is chosen):
 *
 *   To do → In progress → Submitted for review (needs an attachment) → Completed
 *   Submitted → In progress: "Pull back" (assignee) or "Send back" (reviewer, reason required)
 *   Completed → In progress: "Reopen" (reviewer / project manager, reason required)
 */
class DefaultWorkflow
{
    /**
     * @return array{statuses: list<array{key: string, name: string, color: string, type: string}>, transitions: list<array{from: string, to: string, label: string, actors: list<string>, requires_comment: bool, requires_attachment: bool}>}
     */
    public static function definition(): array
    {
        return [
            'statuses' => [
                ['key' => 'todo', 'name' => 'To do', 'color' => 'gray', 'type' => 'open'],
                ['key' => 'in_progress', 'name' => 'In progress', 'color' => 'blue', 'type' => 'active'],
                ['key' => 'review', 'name' => 'Submitted for review', 'color' => 'amber', 'type' => 'review'],
                ['key' => 'done', 'name' => 'Completed', 'color' => 'green', 'type' => 'done'],
            ],
            'transitions' => [
                ['from' => 'todo', 'to' => 'in_progress', 'label' => 'Start', 'actors' => ['assignee', 'project_manager'], 'requires_comment' => false, 'requires_attachment' => false],
                // Evidence before submit: the supporting document must be attached
                ['from' => 'in_progress', 'to' => 'review', 'label' => 'Submit for review', 'actors' => ['assignee'], 'requires_comment' => false, 'requires_attachment' => true],
                ['from' => 'review', 'to' => 'in_progress', 'label' => 'Pull back', 'actors' => ['assignee'], 'requires_comment' => false, 'requires_attachment' => false],
                ['from' => 'review', 'to' => 'in_progress', 'label' => 'Send back', 'actors' => ['reviewer'], 'requires_comment' => true, 'requires_attachment' => false],
                ['from' => 'review', 'to' => 'done', 'label' => 'Approve', 'actors' => ['reviewer'], 'requires_comment' => false, 'requires_attachment' => false],
                ['from' => 'done', 'to' => 'in_progress', 'label' => 'Reopen', 'actors' => ['reviewer', 'project_manager'], 'requires_comment' => true, 'requires_attachment' => false],
            ],
        ];
    }
}
