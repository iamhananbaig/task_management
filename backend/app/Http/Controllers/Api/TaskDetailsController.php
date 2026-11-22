<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Resources\AuditLogResource;
use App\Models\AuditLog;
use App\Models\Task;
use App\Models\TaskChecklistItem;
use App\Notifications\TaskEmailReminder;
use App\Support\Audit;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Facades\RateLimiter;

/** Checklist, watching, activity and the manual email reminder of a task. */
class TaskDetailsController extends Controller
{
    public function addChecklistItem(Request $request, Task $task): JsonResponse
    {
        Gate::authorize('update', $task);
        $validated = $request->validate(['title' => ['required', 'string', 'max:255']]);
        $item = $task->checklist()->create($validated + ['position' => (int) $task->checklist()->max('position') + 1]);
        Audit::log('checklist added', "Checklist: added \"{$item->title}\"", $task);

        return response()->json(['data' => $item], 201);
    }

    /** Tick / untick or rename. The assignee may tick even without "edit tasks". */
    public function updateChecklistItem(Request $request, TaskChecklistItem $item): JsonResponse
    {
        $task = $item->task;
        $validated = $request->validate([
            'title' => ['sometimes', 'required', 'string', 'max:255'],
            'is_done' => ['sometimes', 'boolean'],
            'position' => ['sometimes', 'integer', 'min:0'],
        ]);
        $onlyTicking = array_keys($validated) === ['is_done'];
        if (! ($onlyTicking && $task->assignee_id === $request->user()->id && ! $task->project->isArchived())) {
            Gate::authorize('update', $task);
        }

        $item->update($validated);
        if (array_key_exists('is_done', $validated) && $item->wasChanged('is_done')) {
            Audit::log('checklist ticked', ($item->is_done ? 'Ticked' : 'Unticked')." \"{$item->title}\"", $task);
        }

        return response()->json(['data' => $item]);
    }

    public function deleteChecklistItem(TaskChecklistItem $item): JsonResponse
    {
        Gate::authorize('update', $item->task);
        $item->delete();
        Audit::log('checklist removed', "Checklist: removed \"{$item->title}\"", $item->task);

        return response()->json(['message' => 'Removed.']);
    }

    public function watch(Request $request, Task $task): JsonResponse
    {
        Gate::authorize('view', $task);
        $task->watchers()->syncWithoutDetaching([$request->user()->id]);

        return response()->json(['is_watching' => true]);
    }

    public function unwatch(Request $request, Task $task): JsonResponse
    {
        Gate::authorize('view', $task);
        $task->watchers()->detach($request->user()->id);

        return response()->json(['is_watching' => false]);
    }

    /** The task's history (audit rows), newest first. */
    public function activity(Task $task): AnonymousResourceCollection
    {
        Gate::authorize('view', $task);

        return AuditLogResource::collection(AuditLog::where('task_id', $task->id)->latest('id')->limit(200)->get());
    }

    /**
     * Email the assignee (and optionally the reviewer) a reminder now.
     * At most once per task every 10 minutes.
     */
    public function emailReminder(Request $request, Task $task): JsonResponse
    {
        Gate::authorize('remind', $task);
        $validated = $request->validate([
            'include_reviewer' => ['boolean'],
            'note' => ['nullable', 'string', 'max:1000'],
        ]);

        $task->load(['assignee', 'reviewer', 'project', 'status']);
        $recipients = collect([$task->assignee, ! empty($validated['include_reviewer']) ? $task->reviewer : null])
            ->filter(fn ($user) => $user && $user->is_active)
            ->unique('id');
        if ($recipients->isEmpty()) {
            return response()->json(['message' => 'This task has no assignee to remind.'], 422);
        }

        $key = "task-email-reminder:{$task->id}";
        if (RateLimiter::tooManyAttempts($key, 1)) {
            $minutes = (int) ceil(RateLimiter::availableIn($key) / 60);

            return response()->json(['message' => "A reminder was emailed recently. Try again in {$minutes} minute(s)."], 429);
        }
        RateLimiter::hit($key, 600);

        foreach ($recipients as $recipient) {
            $recipient->notify(new TaskEmailReminder($task, $request->user(), $validated['note'] ?? null));
        }
        $names = $recipients->pluck('name')->implode(', ');
        Audit::log('reminder emailed', "Reminder emailed to {$names}", $task);

        return response()->json(['message' => "Reminder emailed to {$names}."]);
    }
}
