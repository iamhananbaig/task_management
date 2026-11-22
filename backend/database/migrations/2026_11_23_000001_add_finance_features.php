<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Finance-team features:
 *   - routines: recurring tasks and period close checklists (one routine → a run of tasks per period)
 *   - moves that require an attachment (evidence before submit)
 *   - escalation of overdue tasks to the project's managers
 *   - tags in groups (Entity, Branch, Cost centre, …)
 *   - restricted projects
 *   - task_status_changes: one row per status change, for review-time reports
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('project_transitions', function (Blueprint $table) {
            $table->boolean('requires_attachment')->default(false)->after('requires_comment');
        });

        Schema::table('projects', function (Blueprint $table) {
            // Visible only to members and holders of "view restricted projects"
            $table->boolean('is_restricted')->default(false)->after('color');
            // Notify the project's managers when a task is this many days overdue (null = never)
            $table->unsignedTinyInteger('escalate_after_days')->nullable()->default(2)->after('is_restricted');
        });

        Schema::create('tag_groups', function (Blueprint $table) {
            $table->id();
            $table->string('name', 50)->unique();
            $table->unsignedInteger('position')->default(0);
            $table->timestamps();
        });

        Schema::create('tags', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tag_group_id')->constrained()->cascadeOnDelete();
            $table->string('name', 50);
            $table->string('color', 20)->default('gray');
            $table->boolean('is_active')->default(true);
            $table->timestamps();
            $table->unique(['tag_group_id', 'name']);
        });

        Schema::create('task_tag', function (Blueprint $table) {
            $table->foreignId('task_id')->constrained()->cascadeOnDelete();
            $table->foreignId('tag_id')->constrained()->cascadeOnDelete();
            $table->primary(['task_id', 'tag_id']);
        });

        Schema::create('routines', function (Blueprint $table) {
            $table->id();
            $table->foreignId('project_id')->constrained()->cascadeOnDelete();
            $table->string('name');
            $table->text('description')->nullable();
            $table->string('frequency', 15);                  // App\Enums\RoutineFrequency
            // Create each run this many days before its period ends
            $table->unsignedSmallInteger('lead_days')->default(5);
            // End of the next period to create a run for; advanced after each run
            $table->date('next_period_end');
            $table->boolean('is_active')->default(true);
            // Tasks of automatic runs are created in this user's name
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
        });

        Schema::create('routine_items', function (Blueprint $table) {
            $table->id();
            $table->foreignId('routine_id')->constrained()->cascadeOnDelete();
            $table->string('title');
            $table->text('description')->nullable();
            $table->string('priority', 10)->default('medium');
            $table->foreignId('assignee_id')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('reviewer_id')->nullable()->constrained('users')->nullOnDelete();
            $table->json('checklist')->nullable();             // ["Bank statement", "Reconciliation sheet"]
            $table->json('tag_ids')->nullable();
            // App\Enums\DueRule + its number: e.g. day_of_next_month 15, days_after_end 3
            $table->string('due_rule', 25)->default('days_after_end');
            $table->smallInteger('due_value')->default(0);
            $table->unsignedInteger('position')->default(0);
            $table->timestamps();
        });

        Schema::create('routine_runs', function (Blueprint $table) {
            $table->id();
            $table->foreignId('routine_id')->constrained()->cascadeOnDelete();
            $table->foreignId('project_id')->constrained()->cascadeOnDelete();
            $table->string('name');                           // "June 2026 close", "Q4 FY26"
            $table->date('period_start');
            $table->date('period_end');
            $table->foreignId('started_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
            $table->unique(['routine_id', 'period_end']);
        });

        Schema::table('tasks', function (Blueprint $table) {
            $table->foreignId('routine_run_id')->nullable()->after('project_id')->constrained()->nullOnDelete();
            $table->foreignId('routine_item_id')->nullable()->after('routine_run_id')->constrained()->nullOnDelete();
            // Set when the overdue escalation went to the managers; cleared when the due date changes
            $table->timestamp('escalated_at')->nullable()->after('last_reminded_on');
        });

        Schema::create('task_status_changes', function (Blueprint $table) {
            $table->id();
            $table->foreignId('task_id')->constrained()->cascadeOnDelete();
            $table->foreignId('project_id')->constrained()->cascadeOnDelete();
            $table->unsignedBigInteger('from_status_id')->nullable();
            $table->unsignedBigInteger('to_status_id');
            $table->string('from_type', 10)->nullable();      // status types at the time of the change
            $table->string('to_type', 10);
            $table->foreignId('user_id')->nullable()->constrained()->nullOnDelete();
            $table->timestamp('created_at')->useCurrent();
            $table->index(['task_id', 'created_at']);
            $table->index(['to_type', 'created_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('task_status_changes');
        Schema::table('tasks', function (Blueprint $table) {
            $table->dropConstrainedForeignId('routine_item_id');
            $table->dropConstrainedForeignId('routine_run_id');
            $table->dropColumn('escalated_at');
        });
        Schema::dropIfExists('routine_runs');
        Schema::dropIfExists('routine_items');
        Schema::dropIfExists('routines');
        Schema::dropIfExists('task_tag');
        Schema::dropIfExists('tags');
        Schema::dropIfExists('tag_groups');
        Schema::table('projects', function (Blueprint $table) {
            $table->dropColumn(['is_restricted', 'escalate_after_days']);
        });
        Schema::table('project_transitions', function (Blueprint $table) {
            $table->dropColumn('requires_attachment');
        });
    }
};
