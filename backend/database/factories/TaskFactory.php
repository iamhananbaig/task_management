<?php

namespace Database\Factories;

use App\Models\Project;
use App\Models\Task;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * A task in its project's first status, numbered like TaskService does.
 *
 * @extends Factory<Task>
 */
class TaskFactory extends Factory
{
    public function definition(): array
    {
        return [
            'project_id' => Project::factory(),
            'title' => fake()->sentence(4),
            'priority' => 'medium',
        ];
    }

    public function configure(): static
    {
        return $this->afterMaking(function (Task $task) {
            $project = Project::findOrFail($task->project_id);
            $task->number ??= $project->next_task_number;
            $task->status_id ??= $project->initialStatus()->id;
            $project->increment('next_task_number');
        });
    }

    /** Put the task in the project's status with this name. */
    public function inStatus(string $name): static
    {
        return $this->afterMaking(function (Task $task) use ($name) {
            $task->status_id = Project::findOrFail($task->project_id)->statuses()->where('name', $name)->firstOrFail()->id;
        });
    }
}
