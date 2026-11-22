<?php

namespace Database\Seeders;

use App\Enums\ProjectRole;
use App\Models\Project;
use App\Models\User;
use App\Services\TaskService;
use App\Services\WorkflowService;
use App\Support\DefaultWorkflow;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Auth;

/** Local demo data: users for each role and a project with tasks. Never runs in production. */
class DemoDataSeeder extends Seeder
{
    public function run(WorkflowService $workflow, TaskService $tasks): void
    {
        if (app()->isProduction()) {
            $this->command?->warn('DemoDataSeeder skipped in production.');

            return;
        }

        $users = [];
        foreach (['admin' => 'Admin User', 'manager' => 'Maryam Manager', 'member' => 'Ali Member', 'viewer' => 'Vera Viewer'] as $role => $name) {
            $users[$role] = User::firstOrCreate(
                ['email' => "{$role}@tasks.test"],
                ['name' => $name, 'password' => 'password', 'password_changed_at' => now()],
            );
            $users[$role]->syncRoles([$role]);
        }
        if (Project::where('key', 'WEB')->exists()) {
            return;
        }

        Auth::login($users['manager']);
        $project = Project::create(['name' => 'Website relaunch', 'key' => 'WEB', 'color' => 'blue', 'owner_id' => $users['manager']->id, 'description' => 'New marketing site and blog.']);
        $project->members()->attach([
            $users['manager']->id => ['role' => ProjectRole::Manager->value],
            $users['member']->id => ['role' => ProjectRole::Member->value],
            $users['viewer']->id => ['role' => ProjectRole::Member->value],
        ]);
        $workflow->install($project, DefaultWorkflow::definition());

        $samples = [
            ['Design the home page', 'high', 3],
            ['Write the About page copy', 'medium', 5],
            ['Set up analytics', 'low', 10],
            ['Migrate blog posts', 'urgent', -1],
            ['Choose the hosting plan', 'medium', 1],
        ];
        foreach ($samples as [$title, $priority, $dueIn]) {
            $tasks->create($project, [
                'title' => $title,
                'priority' => $priority,
                'assignee_id' => $users['member']->id,
                'reviewer_id' => $users['manager']->id,
                'due_date' => today()->addDays($dueIn)->toDateString(),
            ], $users['manager']);
        }
        Auth::logout();
    }
}
