<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Resources\AuditLogResource;
use App\Models\AuditLog;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

class AuditLogController extends Controller
{
    public function index(Request $request): AnonymousResourceCollection
    {
        $request->validate(['from' => ['nullable', 'date'], 'to' => ['nullable', 'date']]);

        $logs = AuditLog::query()
            ->when($request->string('search')->trim()->value(), fn ($query, string $search) => $query->where(fn ($inner) => $inner
                ->where('summary', 'like', "%{$search}%")
                ->orWhere('subject_label', 'like', "%{$search}%")
                ->orWhere('user_name', 'like', "%{$search}%")))
            ->when($request->input('subject_type'), fn ($query, string $type) => $query->where('subject_type', $type))
            ->when($request->integer('user_id'), fn ($query, int $id) => $query->where('user_id', $id))
            ->when($request->integer('project_id'), fn ($query, int $id) => $query->where('project_id', $id))
            ->when($request->input('from'), fn ($query, string $from) => $query->where('created_at', '>=', $from))
            ->when($request->input('to'), fn ($query, string $to) => $query->where('created_at', '<', now()->parse($to)->addDay()))
            ->latest('id')
            ->paginate(50);

        return AuditLogResource::collection($logs);
    }
}
