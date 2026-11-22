<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Resources\TaskAttachmentResource;
use App\Models\Task;
use App\Models\TaskAttachment;
use App\Support\Audit;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Facades\Storage;
use Symfony\Component\HttpFoundation\StreamedResponse;

/** Files on tasks, kept on the private local disk and served only through the API. */
class AttachmentController extends Controller
{
    /** Office documents, PDFs, images, text and archives up to 20 MB. */
    private const MIMES = 'pdf,doc,docx,xls,xlsx,ppt,pptx,csv,txt,png,jpg,jpeg,gif,webp,heic,zip';

    public function store(Request $request, Task $task): JsonResponse
    {
        Gate::authorize('comment', $task);
        $request->validate(['file' => ['required', 'file', 'max:20480', 'mimes:'.self::MIMES]]);

        $file = $request->file('file');
        $attachment = $task->attachments()->create([
            'user_id' => $request->user()->id,
            'original_name' => mb_substr($file->getClientOriginalName(), 0, 255),
            'path' => $file->store("attachments/{$task->id}", 'local'),
            'mime_type' => $file->getMimeType(),
            'size' => $file->getSize(),
        ]);
        Audit::log('attachment added', "Attached {$attachment->original_name}", $task);

        return (new TaskAttachmentResource($attachment->load('user:id,name,email')))->response()->setStatusCode(201);
    }

    public function download(TaskAttachment $attachment): StreamedResponse
    {
        Gate::authorize('view', $attachment->task);
        abort_unless(Storage::disk('local')->exists($attachment->path), 404, 'The file is missing on the server.');

        return Storage::disk('local')->download($attachment->path, $attachment->original_name);
    }

    public function destroy(Request $request, TaskAttachment $attachment): JsonResponse
    {
        $user = $request->user();
        $task = $attachment->task;
        abort_unless(($attachment->user_id === $user->id && $user->can('comment', $task)) || $user->can('delete', $task), 403);

        Storage::disk('local')->delete($attachment->path);
        $attachment->delete();
        Audit::log('attachment removed', "Removed {$attachment->original_name}", $task);

        return response()->json(['message' => 'Attachment removed.']);
    }
}
