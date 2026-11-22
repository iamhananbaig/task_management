<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Tag;
use App\Models\TagGroup;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

/** Tag groups (Entity, Branch, Cost centre) and their tags. Everyone reads; "manage tags" edits. */
class TagController extends Controller
{
    public function index(): JsonResponse
    {
        $groups = TagGroup::with('tags')->orderBy('position')->orderBy('name')->get();

        return response()->json(['data' => $groups->map(fn (TagGroup $group) => [
            'id' => $group->id,
            'name' => $group->name,
            'tags' => $group->tags->map(fn (Tag $tag) => $tag->only(['id', 'name', 'color', 'is_active', 'tag_group_id'])),
        ])]);
    }

    public function storeGroup(Request $request): JsonResponse
    {
        $validated = $request->validate(['name' => ['required', 'string', 'max:50', 'unique:tag_groups,name']]);
        $group = TagGroup::create($validated + ['position' => (int) TagGroup::max('position') + 1]);

        return response()->json(['data' => $group], 201);
    }

    public function updateGroup(Request $request, TagGroup $group): JsonResponse
    {
        $validated = $request->validate(['name' => ['required', 'string', 'max:50', Rule::unique('tag_groups', 'name')->ignore($group)]]);
        $group->update($validated);

        return response()->json(['data' => $group]);
    }

    public function destroyGroup(TagGroup $group): JsonResponse
    {
        $used = Tag::where('tag_group_id', $group->id)->whereHas('tasks')->count();
        abort_if($used > 0, 422, "Tags in {$group->name} are on tasks. Make them inactive instead.");
        $group->delete();

        return response()->json(['message' => 'Group deleted.']);
    }

    public function store(Request $request, TagGroup $group): JsonResponse
    {
        $validated = $request->validate([
            'name' => ['required', 'string', 'max:50', Rule::unique('tags', 'name')->where('tag_group_id', $group->id)],
            'color' => ['nullable', 'string', 'max:20'],
        ]);
        $tag = $group->tags()->create($validated + ['color' => $validated['color'] ?? 'gray']);

        return response()->json(['data' => $tag], 201);
    }

    /** Rename, recolour, or make inactive (inactive tags stay on old tasks but can't be chosen). */
    public function update(Request $request, Tag $tag): JsonResponse
    {
        $validated = $request->validate([
            'name' => ['sometimes', 'required', 'string', 'max:50', Rule::unique('tags', 'name')->where('tag_group_id', $tag->tag_group_id)->ignore($tag)],
            'color' => ['sometimes', 'nullable', 'string', 'max:20'],
            'is_active' => ['sometimes', 'boolean'],
        ]);
        $tag->update($validated);

        return response()->json(['data' => $tag]);
    }

    public function destroy(Tag $tag): JsonResponse
    {
        abort_if($tag->tasks()->exists(), 422, "{$tag->name} is on tasks. Make it inactive instead.");
        $tag->delete();

        return response()->json(['message' => 'Tag deleted.']);
    }
}
