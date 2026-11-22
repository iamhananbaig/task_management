<?php

namespace App\Policies;

use App\Models\Project;
use App\Models\User;

/**
 * View: members, or anyone with "view all projects".
 * Manage (settings, members, workflow, archive): the project's managers, or "manage projects"
 * holders who can see it.
 */
class ProjectPolicy
{
    public function view(User $user, Project $project): bool
    {
        return $user->can('view all projects') || $project->isMember($user);
    }

    public function create(User $user): bool
    {
        return $user->can('manage projects');
    }

    public function manage(User $user, Project $project): bool
    {
        return $project->isManager($user) || ($user->can('manage projects') && $this->view($user, $project));
    }

    public function delete(User $user, Project $project): bool
    {
        return $user->can('manage projects') && $this->view($user, $project);
    }
}
