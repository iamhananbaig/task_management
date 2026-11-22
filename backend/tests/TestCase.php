<?php

namespace Tests;

use App\Enums\ProjectRole;
use App\Models\Project;
use App\Models\User;
use Database\Seeders\RolePermissionSeeder;
use Database\Seeders\WorkflowTemplateSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Foundation\Testing\TestCase as BaseTestCase;
use Laravel\Sanctum\Sanctum;

abstract class TestCase extends BaseTestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed([RolePermissionSeeder::class, WorkflowTemplateSeeder::class]);
    }

    /** A user with one of the built-in roles (admin, manager, member, viewer). */
    protected function userWithRole(string $role, array $attributes = []): User
    {
        return User::factory()->create($attributes)->assignRole($role);
    }

    /** Sign in for the next requests. Resets the guard so tests can switch users. */
    protected function signIn(User $user): User
    {
        $this->app['auth']->forgetGuards();
        Sanctum::actingAs($user);

        return $user;
    }

    /** Add users to a project as members (or managers). */
    protected function addMembers(Project $project, array $users, ProjectRole $role = ProjectRole::Member): void
    {
        foreach ($users as $user) {
            $project->members()->syncWithoutDetaching([$user->id => ['role' => $role->value]]);
        }
        $project->unsetRelation('members');
    }

    /** A project's transition by its label ("Submit for review"). */
    protected function transition(Project $project, string $label): int
    {
        return $project->transitions()->where('label', $label)->firstOrFail()->id;
    }
}
