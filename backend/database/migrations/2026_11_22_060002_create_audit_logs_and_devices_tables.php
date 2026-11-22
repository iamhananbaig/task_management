<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Who did what and when: one row per change (App\Support\Audit). Rows are never edited.
        // task_id / project_id have no FK so history outlives a purge; a task's Activity tab reads them.
        Schema::create('audit_logs', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->nullable()->constrained()->nullOnDelete();
            $table->string('user_name')->nullable();          // kept if the user is later deleted
            $table->string('action', 40);                     // created, updated, deleted, moved, ...
            $table->string('subject_type', 40);               // Task, Project, User, Role, Auth, ...
            $table->unsignedBigInteger('subject_id')->nullable();
            $table->string('subject_label')->nullable();
            $table->unsignedBigInteger('project_id')->nullable()->index();
            $table->unsignedBigInteger('task_id')->nullable()->index();
            $table->string('summary', 500);
            $table->json('changes')->nullable();              // {field: [old, new]}
            $table->string('ip_address', 45)->nullable();
            $table->timestamp('created_at')->useCurrent()->index();
            $table->index(['subject_type', 'subject_id']);
        });

        // Expo push tokens of the signed-in phones (one user can have several devices)
        Schema::create('device_tokens', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('token')->unique();
            $table->string('platform', 10);                   // ios | android
            $table->string('device_name')->nullable();
            $table->timestamp('last_used_at')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('device_tokens');
        Schema::dropIfExists('audit_logs');
    }
};
