<?php

namespace App\Policies;

use App\Models\Task;
use App\Models\User;

/** Everything on a task needs access to its project; changes are refused on archived projects. */
class TaskPolicy
{
    public function view(User $user, Task $task): bool
    {
        return $user->can('view', $task->project);
    }

    public function update(User $user, Task $task): bool
    {
        return $this->writable($task) && $user->can('edit tasks') && $this->view($user, $task);
    }

    public function delete(User $user, Task $task): bool
    {
        return $this->writable($task) && $user->can('delete tasks') && $this->view($user, $task);
    }

    public function restore(User $user, Task $task): bool
    {
        return $this->delete($user, $task);
    }

    public function comment(User $user, Task $task): bool
    {
        return $this->writable($task) && $user->can('comment on tasks') && $this->view($user, $task);
    }

    /** Send the manual reminder email: anyone who may edit, or the project's managers. */
    public function remind(User $user, Task $task): bool
    {
        return $this->update($user, $task) || ($this->writable($task) && $task->project->isManager($user));
    }

    private function writable(Task $task): bool
    {
        return ! $task->project->isArchived();
    }
}
