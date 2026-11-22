<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Resources\TaskCommentResource;
use App\Models\Task;
use App\Models\TaskComment;
use App\Models\User;
use App\Notifications\TaskCommented;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Facades\Notification;

class CommentController extends Controller
{
    public function index(Task $task): AnonymousResourceCollection
    {
        Gate::authorize('view', $task);

        return TaskCommentResource::collection($task->comments()->with('user:id,name,email')->get());
    }

    /** Post a comment; the commenter starts watching, everyone else involved is notified. */
    public function store(Request $request, Task $task): JsonResponse
    {
        Gate::authorize('comment', $task);
        $validated = $request->validate(['body' => ['required', 'string', 'max:5000']]);
        $user = $request->user();

        $comment = $task->comments()->create(['user_id' => $user->id, 'body' => $validated['body']])->load('user:id,name,email');
        $task->watchers()->syncWithoutDetaching([$user->id]);

        $recipients = collect($task->stakeholderIds())->reject(fn ($id) => $id === $user->id);
        Notification::send(User::whereIn('id', $recipients)->where('is_active', true)->get(), new TaskCommented($task->load('project'), $comment));

        return (new TaskCommentResource($comment))->response()->setStatusCode(201);
    }

    /** Only the author edits their comment. */
    public function update(Request $request, TaskComment $comment): TaskCommentResource
    {
        abort_unless($comment->user_id === $request->user()->id, 403, 'You can only edit your own comments.');
        $validated = $request->validate(['body' => ['required', 'string', 'max:5000']]);
        $comment->update(['body' => $validated['body'], 'edited_at' => now()]);

        return new TaskCommentResource($comment->load('user:id,name,email'));
    }

    public function destroy(Request $request, TaskComment $comment): JsonResponse
    {
        $user = $request->user();
        abort_unless($comment->user_id === $user->id || $user->can('delete', $comment->task), 403);
        $comment->delete();

        return response()->json(['message' => 'Comment deleted.']);
    }
}
