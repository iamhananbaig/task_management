<?php

namespace App\Enums;

/** Who may make a workflow move. A transition lists one or more of these. */
enum TransitionActor: string
{
    case Assignee = 'assignee';
    case Reviewer = 'reviewer';
    case Creator = 'creator';
    /** A member with the "manager" role on the project. */
    case ProjectManager = 'project_manager';
    /** Anyone who can see the project and holds "edit tasks". */
    case AnyEditor = 'any_editor';

    public function label(): string
    {
        return match ($this) {
            self::Assignee => 'Assignee',
            self::Reviewer => 'Reviewer',
            self::Creator => 'Creator',
            self::ProjectManager => 'Project manager',
            self::AnyEditor => 'Anyone who can edit tasks',
        };
    }
}
