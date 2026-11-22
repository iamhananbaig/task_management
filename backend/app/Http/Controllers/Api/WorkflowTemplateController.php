<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\WorkflowTemplate;
use App\Services\WorkflowService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

/** Reusable workflows offered when a project is created. One is the default. */
class WorkflowTemplateController extends Controller
{
    public function __construct(private WorkflowService $workflow) {}

    public function index(): JsonResponse
    {
        return response()->json(['data' => WorkflowTemplate::orderByDesc('is_default')->orderBy('name')->get()]);
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $this->validated($request);
        $template = DB::transaction(fn () => $this->save(new WorkflowTemplate, $validated));

        return response()->json(['data' => $template], 201);
    }

    public function update(Request $request, WorkflowTemplate $workflowTemplate): JsonResponse
    {
        $validated = $this->validated($request, $workflowTemplate);
        $template = DB::transaction(fn () => $this->save($workflowTemplate, $validated));

        return response()->json(['data' => $template]);
    }

    public function destroy(WorkflowTemplate $workflowTemplate): JsonResponse
    {
        abort_if($workflowTemplate->is_default, 422, 'The default template cannot be deleted. Make another one the default first.');
        $workflowTemplate->delete();

        return response()->json(['message' => 'Template deleted.']);
    }

    /** @return array<string, mixed> */
    private function validated(Request $request, ?WorkflowTemplate $template = null): array
    {
        $validated = $request->validate([
            'name' => ['required', 'string', 'max:100', Rule::unique('workflow_templates', 'name')->ignore($template)],
            'description' => ['nullable', 'string', 'max:255'],
            'is_default' => ['boolean'],
        ] + WorkflowService::rules('definition.'));
        $this->workflow->assertConsistent($validated['definition']);

        return $validated;
    }

    /** @param array<string, mixed> $validated */
    private function save(WorkflowTemplate $template, array $validated): WorkflowTemplate
    {
        if (! empty($validated['is_default'])) {
            WorkflowTemplate::where('is_default', true)->whereKeyNot($template->id)->update(['is_default' => false]);
        }
        $template->fill($validated)->save();

        return $template;
    }
}
