<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Projects, their members and their workflow.
 *
 * Each project defines its own statuses (board columns) and the moves allowed between them
 * (transitions). A transition says who may make it (assignee, reviewer, …) and whether a
 * comment is required. Workflow templates hold a reusable definition copied into new projects.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('workflow_templates', function (Blueprint $table) {
            $table->id();
            $table->string('name')->unique();
            $table->string('description')->nullable();
            // {statuses: [{key, name, color, type}], transitions: [{from, to, label, actors, requires_comment}]}
            $table->json('definition');
            $table->boolean('is_default')->default(false);
            $table->timestamps();
        });

        Schema::create('projects', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            // Short code used in task numbers: WEB-12
            $table->string('key', 10)->unique();
            $table->text('description')->nullable();
            $table->string('color', 20)->default('blue');
            $table->foreignId('owner_id')->constrained('users')->restrictOnDelete();
            // Next task number in this project (WEB-1, WEB-2, …), incremented under a row lock
            $table->unsignedInteger('next_task_number')->default(1);
            $table->timestamp('archived_at')->nullable()->index();
            $table->timestamps();
        });

        Schema::create('project_members', function (Blueprint $table) {
            $table->id();
            $table->foreignId('project_id')->constrained()->cascadeOnDelete();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            // manager: can change the project's settings, members and workflow
            $table->string('role', 20)->default('member');
            $table->timestamps();
            $table->unique(['project_id', 'user_id']);
        });

        Schema::create('project_statuses', function (Blueprint $table) {
            $table->id();
            $table->foreignId('project_id')->constrained()->cascadeOnDelete();
            $table->string('name', 50);
            $table->string('color', 20)->default('gray');
            // App\Enums\StatusType: open | active | review | done — reports and reminders read this
            $table->string('type', 10);
            // Board order; the first status is where new tasks start
            $table->unsignedInteger('position')->default(0);
            $table->timestamps();
            $table->unique(['project_id', 'name']);
        });

        Schema::create('project_transitions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('project_id')->constrained()->cascadeOnDelete();
            $table->foreignId('from_status_id')->constrained('project_statuses')->cascadeOnDelete();
            $table->foreignId('to_status_id')->constrained('project_statuses')->cascadeOnDelete();
            $table->string('label', 50);                       // button text: "Submit for review"
            $table->json('actors');                            // App\Enums\TransitionActor values
            $table->boolean('requires_comment')->default(false);
            $table->unsignedInteger('position')->default(0);
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('project_transitions');
        Schema::dropIfExists('project_statuses');
        Schema::dropIfExists('project_members');
        Schema::dropIfExists('projects');
        Schema::dropIfExists('workflow_templates');
    }
};
