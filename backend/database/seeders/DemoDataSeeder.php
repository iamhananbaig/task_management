<?php

namespace Database\Seeders;

use App\Enums\ProjectRole;
use App\Models\Project;
use App\Models\Routine;
use App\Models\TagGroup;
use App\Models\User;
use App\Services\RoutineService;
use App\Services\TaskService;
use App\Services\WorkflowService;
use App\Support\DefaultWorkflow;
use Carbon\CarbonImmutable;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Auth;

/** Local demo data: users for each role and a project with tasks. Never runs in production. */
class DemoDataSeeder extends Seeder
{
    public function run(WorkflowService $workflow, TaskService $tasks, RoutineService $routines): void
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
        $this->financeDemo($users, $workflow, $routines);

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

    /**
     * Finance demo: tag groups, a Finance operations project with a month-end close routine and a
     * quarterly advance-tax routine (the current period's run is started), and a restricted Payroll project.
     *
     * @param  array<string, User>  $users
     */
    private function financeDemo(array $users, WorkflowService $workflow, RoutineService $routines): void
    {
        $tags = [];
        foreach (['Entity' => ['Holding Co', 'Trading Co'], 'Branch' => ['Lahore', 'Karachi', 'Islamabad'], 'Cost centre' => ['Finance', 'Sales', 'Admin']] as $groupName => $names) {
            $group = TagGroup::create(['name' => $groupName]);
            foreach ($names as $name) {
                $tags[$name] = $group->tags()->create(['name' => $name])->id;
            }
        }

        Auth::login($users['manager']);
        $finance = Project::create(['name' => 'Finance operations', 'key' => 'FIN', 'color' => 'green', 'owner_id' => $users['manager']->id, 'description' => 'Month-end close, tax filings and payments.']);
        $finance->members()->attach([
            $users['manager']->id => ['role' => ProjectRole::Manager->value],
            $users['member']->id => ['role' => ProjectRole::Member->value],
        ]);
        $workflow->install($finance, DefaultWorkflow::definition());

        $item = fn (string $title, string $rule, int $value, array $extra = []) => array_merge([
            'title' => $title, 'assignee_id' => $users['member']->id, 'reviewer_id' => $users['manager']->id,
            'priority' => 'medium', 'due_rule' => $rule, 'due_value' => $value, 'checklist' => [], 'tag_ids' => [$tags['Holding Co'], $tags['Finance']],
        ], $extra);

        $close = Routine::create(['project_id' => $finance->id, 'name' => 'Month-end close', 'frequency' => 'monthly', 'lead_days' => 5, 'next_period_end' => today()->endOfMonth(), 'created_by' => $users['manager']->id]);
        foreach ([
            $item('Bank reconciliations', 'days_after_end', 3, ['checklist' => ['Bank statements downloaded', 'Reconciliation sheet', 'Unreconciled items explained'], 'priority' => 'high']),
            $item('Accruals and prepayments', 'days_after_end', 4),
            $item('Fixed asset depreciation run', 'days_after_end', 4),
            $item('Payables aging review', 'days_after_end', 5),
            $item('Sales tax return (FBR)', 'day_of_next_month', 18, ['priority' => 'urgent']),
            $item('Withholding tax statement', 'day_of_next_month', 15, ['priority' => 'high']),
            $item('Management accounts pack', 'days_after_end', 7, ['assignee_id' => $users['manager']->id, 'reviewer_id' => $users['admin']->id]),
        ] as $position => $data) {
            $close->items()->create($data + ['position' => $position]);
        }
        $routines->startRun($close, $users['manager']);

        $tax = Routine::create(['project_id' => $finance->id, 'name' => 'Advance tax', 'frequency' => 'quarterly', 'lead_days' => 10, 'next_period_end' => today()->endOfMonth()->addMonth()->endOfMonth(), 'created_by' => $users['manager']->id]);
        $tax->update(['next_period_end' => $tax->frequency->periodEndFor(CarbonImmutable::today())]);
        $tax->items()->create($item('Advance income tax payment', 'day_of_next_month', 25, ['priority' => 'high']));

        $payroll = Project::create(['name' => 'Payroll', 'key' => 'PAY', 'color' => 'purple', 'is_restricted' => true, 'owner_id' => $users['admin']->id, 'description' => 'Restricted: salaries and HR.']);
        $payroll->members()->attach([$users['admin']->id => ['role' => ProjectRole::Manager->value]]);
        $workflow->install($payroll, DefaultWorkflow::definition());
        Auth::logout();
    }
}
