<?php

namespace Database\Seeders;

use App\Models\WorkflowTemplate;
use App\Support\DefaultWorkflow;
use Illuminate\Database\Seeder;

/** The built-in review workflow, created once (later edits on the Templates page are kept). */
class WorkflowTemplateSeeder extends Seeder
{
    public function run(): void
    {
        if (WorkflowTemplate::exists()) {
            return;
        }
        WorkflowTemplate::create([
            'name' => 'Review workflow',
            'description' => 'To do → In progress → Submitted for review → Completed, with pull back / send back.',
            'definition' => DefaultWorkflow::definition(),
            'is_default' => true,
        ]);
    }
}
