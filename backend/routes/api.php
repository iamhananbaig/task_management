<?php

use App\Http\Controllers\Api\AttachmentController;
use App\Http\Controllers\Api\AuditLogController;
use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\CommentController;
use App\Http\Controllers\Api\DashboardController;
use App\Http\Controllers\Api\DeviceController;
use App\Http\Controllers\Api\NotificationController;
use App\Http\Controllers\Api\ProjectController;
use App\Http\Controllers\Api\ProjectMemberController;
use App\Http\Controllers\Api\ReportController;
use App\Http\Controllers\Api\RoleController;
use App\Http\Controllers\Api\RoutineController;
use App\Http\Controllers\Api\SearchController;
use App\Http\Controllers\Api\TagController;
use App\Http\Controllers\Api\TaskController;
use App\Http\Controllers\Api\TaskDetailsController;
use App\Http\Controllers\Api\TaskWorkflowController;
use App\Http\Controllers\Api\UserController;
use App\Http\Controllers\Api\WorkflowController;
use App\Http\Controllers\Api\WorkflowTemplateController;
use Illuminate\Support\Facades\Route;

/*
 * /api/v1 — used by the web app and the phone app (Sanctum bearer tokens).
 *
 * Authorization: app-wide abilities use Spatie permissions (App\Support\Permissions), checked
 * with `permission:` middleware here; access to a project and its tasks is checked by
 * ProjectPolicy / TaskPolicy in the controllers (members, or "view all projects").
 */
Route::prefix('v1')->group(function () {
    Route::post('/login', [AuthController::class, 'login'])->middleware('throttle:10,1');

    Route::middleware(['auth:sanctum', 'password.current'])->group(function () {
        Route::get('/user', [AuthController::class, 'user']);
        Route::put('/user/password', [AuthController::class, 'changePassword'])->middleware('throttle:10,1');
        Route::post('/logout', [AuthController::class, 'logout']);
        Route::post('/devices', [DeviceController::class, 'store']);
        Route::delete('/devices', [DeviceController::class, 'destroy']);

        Route::get('/dashboard', DashboardController::class);
        Route::get('/search', SearchController::class);
        Route::get('/users/options', [UserController::class, 'options']);

        // ---- Notifications (bell) ----
        Route::get('/notifications', [NotificationController::class, 'index']);
        Route::post('/notifications/read-all', [NotificationController::class, 'readAll']);
        Route::post('/notifications/{id}/read', [NotificationController::class, 'read']);

        // ---- Projects ----
        Route::get('/projects', [ProjectController::class, 'index']);
        Route::post('/projects', [ProjectController::class, 'store']);
        Route::get('/projects/{project}', [ProjectController::class, 'show']);
        Route::put('/projects/{project}', [ProjectController::class, 'update']);
        Route::delete('/projects/{project}', [ProjectController::class, 'destroy']);
        Route::post('/projects/{project}/archive', [ProjectController::class, 'archive']);
        Route::post('/projects/{project}/unarchive', [ProjectController::class, 'unarchive']);
        Route::get('/projects/{project}/members', [ProjectMemberController::class, 'index']);
        Route::post('/projects/{project}/members', [ProjectMemberController::class, 'store']);
        Route::delete('/projects/{project}/members/{user}', [ProjectMemberController::class, 'destroy']);
        Route::get('/projects/{project}/workflow', [WorkflowController::class, 'show']);
        Route::put('/projects/{project}/workflow', [WorkflowController::class, 'update']);
        Route::post('/projects/{project}/workflow/save-as-template', [WorkflowController::class, 'saveAsTemplate']);

        // ---- Routines (recurring tasks / period close) ----
        Route::get('/projects/{project}/routines', [RoutineController::class, 'index']);
        Route::post('/projects/{project}/routines', [RoutineController::class, 'store']);
        Route::get('/routines/{routine}', [RoutineController::class, 'show']);
        Route::put('/routines/{routine}', [RoutineController::class, 'update']);
        Route::delete('/routines/{routine}', [RoutineController::class, 'destroy']);
        Route::post('/routines/{routine}/start', [RoutineController::class, 'startNow']);
        Route::get('/runs', [RoutineController::class, 'recentRuns']);
        Route::get('/runs/{run}', [RoutineController::class, 'run']);

        // ---- Tags ----
        Route::get('/tags', [TagController::class, 'index']);
        Route::middleware('permission:manage tags')->group(function () {
            Route::post('/tag-groups', [TagController::class, 'storeGroup']);
            Route::put('/tag-groups/{group}', [TagController::class, 'updateGroup']);
            Route::delete('/tag-groups/{group}', [TagController::class, 'destroyGroup']);
            Route::post('/tag-groups/{group}/tags', [TagController::class, 'store']);
            Route::put('/tags/{tag}', [TagController::class, 'update']);
            Route::delete('/tags/{tag}', [TagController::class, 'destroy']);
        });

        Route::get('/reports', ReportController::class)->middleware('permission:view reports');

        // ---- Workflow templates ----
        Route::get('/workflow-templates', [WorkflowTemplateController::class, 'index']);
        Route::middleware('permission:manage workflow templates')->group(function () {
            Route::post('/workflow-templates', [WorkflowTemplateController::class, 'store']);
            Route::put('/workflow-templates/{workflowTemplate}', [WorkflowTemplateController::class, 'update']);
            Route::delete('/workflow-templates/{workflowTemplate}', [WorkflowTemplateController::class, 'destroy']);
        });

        // ---- Tasks ----
        Route::get('/tasks', [TaskController::class, 'index']);
        Route::get('/tasks/bin', [TaskController::class, 'bin'])->middleware('permission:delete tasks');
        Route::post('/tasks/{task}/restore', [TaskController::class, 'restore'])->whereNumber('task');
        Route::get('/projects/{project}/tasks', [TaskController::class, 'forProject']);
        Route::post('/projects/{project}/tasks', [TaskController::class, 'store']);
        Route::get('/tasks/{task}', [TaskController::class, 'show']);
        Route::put('/tasks/{task}', [TaskController::class, 'update']);
        Route::delete('/tasks/{task}', [TaskController::class, 'destroy']);

        Route::post('/tasks/{task}/transitions/{transition}', [TaskWorkflowController::class, 'transition']);
        Route::put('/tasks/{task}/position', [TaskWorkflowController::class, 'reorder']);

        Route::post('/tasks/{task}/checklist', [TaskDetailsController::class, 'addChecklistItem']);
        Route::put('/checklist-items/{item}', [TaskDetailsController::class, 'updateChecklistItem']);
        Route::delete('/checklist-items/{item}', [TaskDetailsController::class, 'deleteChecklistItem']);
        Route::post('/tasks/{task}/watch', [TaskDetailsController::class, 'watch']);
        Route::delete('/tasks/{task}/watch', [TaskDetailsController::class, 'unwatch']);
        Route::get('/tasks/{task}/activity', [TaskDetailsController::class, 'activity']);
        Route::post('/tasks/{task}/email-reminder', [TaskDetailsController::class, 'emailReminder'])->middleware('throttle:20,1');

        Route::get('/tasks/{task}/comments', [CommentController::class, 'index']);
        Route::post('/tasks/{task}/comments', [CommentController::class, 'store']);
        Route::put('/comments/{comment}', [CommentController::class, 'update']);
        Route::delete('/comments/{comment}', [CommentController::class, 'destroy']);

        Route::post('/tasks/{task}/attachments', [AttachmentController::class, 'store']);
        Route::get('/attachments/{attachment}/download', [AttachmentController::class, 'download']);
        Route::delete('/attachments/{attachment}', [AttachmentController::class, 'destroy']);

        // ---- Administration ----
        Route::get('/users', [UserController::class, 'index'])->middleware('permission:view users');
        Route::middleware('permission:manage users')->group(function () {
            Route::post('/users', [UserController::class, 'store']);
            Route::put('/users/{user}', [UserController::class, 'update']);
        });
        Route::get('/roles', [RoleController::class, 'index'])->middleware('permission:view roles');
        Route::get('/permissions', [RoleController::class, 'permissions'])->middleware('permission:view roles');
        Route::middleware('permission:manage roles')->group(function () {
            Route::post('/roles', [RoleController::class, 'store']);
            Route::put('/roles/{role}', [RoleController::class, 'update']);
            Route::delete('/roles/{role}', [RoleController::class, 'destroy']);
        });
        Route::get('/audit-log', [AuditLogController::class, 'index'])->middleware('permission:view audit log');
    });
});
