<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Support\Audit;
use App\Support\Permissions;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;
use Spatie\Permission\PermissionRegistrar;

/** Roles and what each may do. The admin role always keeps every permission. */
class RoleController extends Controller
{
    public function index(): JsonResponse
    {
        return response()->json([
            'data' => Role::with('permissions:id,name')->withCount('users')->orderBy('id')->get()->map(fn (Role $role) => [
                'id' => $role->id,
                'name' => $role->name,
                'users_count' => $role->users_count,
                'permissions' => $role->permissions->pluck('name')->values(),
                'locked' => $role->name === 'admin',
            ]),
            'groups' => Permissions::GROUPS,
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'name' => ['required', 'string', 'max:50', 'regex:/^[a-z0-9-]+$/', 'unique:roles,name'],
            'permissions' => ['array'],
            'permissions.*' => [Rule::exists('permissions', 'name')],
        ]);
        $role = Role::create(['name' => $validated['name'], 'guard_name' => 'web']);
        $role->syncPermissions($validated['permissions'] ?? []);
        Audit::log('role created', "Created role {$role->name}", $role, [], 'Role');

        return response()->json(['message' => 'Role created.'], 201);
    }

    public function update(Request $request, Role $role): JsonResponse
    {
        abort_if($role->name === 'admin', 422, 'The admin role always has every permission.');
        $validated = $request->validate([
            'permissions' => ['present', 'array'],
            'permissions.*' => [Rule::exists('permissions', 'name')],
        ]);
        $before = $role->permissions->pluck('name')->sort()->values()->all();
        $role->syncPermissions($validated['permissions']);
        app(PermissionRegistrar::class)->forgetCachedPermissions();
        $after = collect($validated['permissions'])->sort()->values()->all();

        $added = array_diff($after, $before);
        $removed = array_diff($before, $after);
        if ($added || $removed) {
            Audit::log('permissions changed', "Role {$role->name}: ".implode('; ', array_filter([
                $added ? '+ '.implode(', ', $added) : null,
                $removed ? '− '.implode(', ', $removed) : null,
            ])), $role, ['permissions' => [$before, $after]], 'Role');
        }

        return response()->json(['message' => 'Permissions saved.']);
    }

    public function destroy(Role $role): JsonResponse
    {
        abort_if(in_array($role->name, Permissions::BUILT_IN_ROLES, true), 422, 'Built-in roles cannot be deleted.');
        abort_if($role->users()->exists(), 422, 'Move this role\'s users to another role first.');
        $role->delete();
        Audit::log('role deleted', "Deleted role {$role->name}", null, [], 'Role');

        return response()->json(['message' => 'Role deleted.']);
    }

    /** Every permission name (for the Roles page). */
    public function permissions(): JsonResponse
    {
        return response()->json(['data' => Permission::orderBy('name')->pluck('name')]);
    }
}
