<?php

namespace Database\Factories;

use App\Enums\ProjectRole;
use App\Models\Project;
use App\Models\User;
use App\Services\WorkflowService;
use App\Support\DefaultWorkflow;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * Projects come with the default workflow and their owner as manager.
 *
 * @extends Factory<Project>
 */
class ProjectFactory extends Factory
{
    public function definition(): array
    {
        return [
            'name' => fake()->unique()->words(2, true),
            'key' => strtoupper(fake()->unique()->lexify('???')),
            'description' => fake()->sentence(),
            'color' => 'blue',
            'owner_id' => User::factory(),
        ];
    }

    public function configure(): static
    {
        return $this->afterCreating(function (Project $project) {
            $project->members()->syncWithoutDetaching([$project->owner_id => ['role' => ProjectRole::Manager->value]]);
            app(WorkflowService::class)->install($project, DefaultWorkflow::definition());
        });
    }

    public function archived(): static
    {
        return $this->state(['archived_at' => now()]);
    }
}
