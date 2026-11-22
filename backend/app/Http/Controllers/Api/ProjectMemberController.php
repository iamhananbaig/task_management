<?php

namespace App\Http\Controllers\Api;

use App\Enums\ProjectRole;
use App\Http\Controllers\Controller;
use App\Http\Resources\UserSummaryResource;
use App\Models\Project;
use App\Models\Task;
use App\Models\User;
use App\Support\Audit;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\Rule;

/** Who belongs to a project (and may be assignee / reviewer), and who manages it. */
class ProjectMemberController extends Controller
{
    public function index(Project $project): AnonymousResourceCollection
    {
        Gate::authorize('view', $project);

        return UserSummaryResource::collection($project->members()->select('users.id', 'users.name', 'users.email')->orderBy('name')->get());
    }

    /** Add a member or change their project role. */
    public function store(Request $request, Project $project): JsonResponse
    {
        Gate::authorize('manage', $project);
        $validated = $request->validate([
            'user_id' => ['required', Rule::exists('users', 'id')->where('is_active', true)],
            'role' => ['required', Rule::enum(ProjectRole::class)],
        ]);
        $user = User::findOrFail($validated['user_id']);

        if ($project->isMember($user)) {
            $old = $project->members()->whereKey($user->id)->first()->pivot->role;
            $this->assertKeepsAManager($project, $user, $validated['role']);
            $project->members()->updateExistingPivot($user->id, ['role' => $validated['role']]);
            Audit::log('member role changed', "{$user->name}: {$old} → {$validated['role']}", $project, ['member' => [$old, $validated['role']]]);
        } else {
            $project->members()->attach($user->id, ['role' => $validated['role']]);
            Audit::log('member added', "Added {$user->name} as {$validated['role']}", $project);
        }

        return response()->json(['message' => 'Member saved.']);
    }

    /** Remove a member. Their open tasks are unassigned (history keeps their name). */
    public function destroy(Project $project, User $user): JsonResponse
    {
        Gate::authorize('manage', $project);
        if (! $project->isMember($user)) {
            return response()->json(['message' => "{$user->name} is not a member of this project."], 422);
        }
        $this->assertKeepsAManager($project, $user, null);

        $project->members()->detach($user->id);
        $unassigned = Task::where('project_id', $project->id)->where('assignee_id', $user->id)->open()->update(['assignee_id' => null]);
        Task::where('project_id', $project->id)->where('reviewer_id', $user->id)->open()->update(['reviewer_id' => null]);
        Audit::log('member removed', "Removed {$user->name}".($unassigned ? " ({$unassigned} open task(s) unassigned)" : ''), $project);

        return response()->json(['message' => 'Member removed.']);
    }

    /** Every project keeps at least one manager. */
    private function assertKeepsAManager(Project $project, User $user, ?string $newRole): void
    {
        if ($newRole === ProjectRole::Manager->value || ! $project->isManager($user)) {
            return;
        }
        $managers = $project->members()->wherePivot('role', ProjectRole::Manager->value)->count();
        abort_if($managers <= 1, 422, 'A project needs at least one manager. Make someone else a manager first.');
    }
}
