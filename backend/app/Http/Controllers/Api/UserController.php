<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Support\Audit;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Rules\Password;

/**
 * Accounts, created by administrators (no public sign-up). A new account or an admin password
 * reset must set its own password at next sign-in. Users with history are deactivated, not deleted.
 */
class UserController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $users = User::with('roles:id,name')
            ->when($request->string('search')->trim()->value(), fn ($query, string $search) => $query->where(fn ($inner) => $inner->where('name', 'like', "%{$search}%")->orWhere('email', 'like', "%{$search}%")))
            ->when($request->filled('active'), fn ($query) => $query->where('is_active', $request->boolean('active')))
            ->orderBy('name')
            ->paginate(50);

        return response()->json($users->through(fn (User $user) => $this->row($user)));
    }

    /** Active users for pickers (add member). Any signed-in user. */
    public function options(): JsonResponse
    {
        return response()->json(['data' => User::where('is_active', true)->orderBy('name')->get(['id', 'name', 'email'])]);
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'email' => ['required', 'email', 'max:255', 'unique:users,email'],
            'password' => ['required', 'string', Password::min(10)],
            'role' => ['required', 'exists:roles,name'],
        ]);
        $this->assertCanGrant($request, $validated['role']);

        // password_changed_at stays null: the new user sets their own password at first sign-in
        $user = User::create([
            'name' => $validated['name'],
            'email' => strtolower($validated['email']),
            'password' => $validated['password'],
        ]);
        $user->assignRole($validated['role']);
        Audit::log('role changed', "Role → {$validated['role']}", $user, ['role' => [null, $validated['role']]]);

        return response()->json(['data' => $this->row($user)], 201);
    }

    public function update(Request $request, User $user): JsonResponse
    {
        $validated = $request->validate([
            'name' => ['sometimes', 'required', 'string', 'max:255'],
            'email' => ['sometimes', 'required', 'email', 'max:255', Rule::unique('users', 'email')->ignore($user)],
            'role' => ['sometimes', 'required', 'exists:roles,name'],
            'is_active' => ['sometimes', 'boolean'],
            'password' => ['nullable', 'string', Password::min(10)],
        ]);
        $isSelf = $user->id === $request->user()->id;
        $oldRoles = $user->getRoleNames()->all();

        if (isset($validated['role'])) {
            $this->assertCanGrant($request, $validated['role']);
            if (in_array('admin', $oldRoles, true) && $validated['role'] !== 'admin') {
                abort_if($isSelf, 422, 'You cannot remove your own admin role.');
                abort_if(User::role('admin')->where('is_active', true)->count() <= 1, 422, 'At least one administrator is required.');
            }
        }
        if (array_key_exists('is_active', $validated) && ! $validated['is_active']) {
            abort_if($isSelf, 422, 'You cannot deactivate your own account.');
        }

        $user->fill(collect($validated)->only(['name', 'email', 'is_active'])->all());
        if (! empty($validated['password'])) {
            $user->password = $validated['password'];
            // An admin reset is a temporary password: it must be replaced at next sign-in
            $user->password_changed_at = null;
        }
        $user->save();

        if (! empty($validated['password'])) {
            $user->tokens()->delete();
            Audit::log('password reset', 'Password reset by an administrator (must be changed at next sign-in)', $user);
        }
        if (array_key_exists('is_active', $validated) && ! $user->is_active) {
            $user->tokens()->delete();
            $user->deviceTokens()->delete();
        }
        if (isset($validated['role']) && $oldRoles !== [$validated['role']]) {
            $user->syncRoles([$validated['role']]);
            Audit::log('role changed', 'Role '.(implode(', ', $oldRoles) ?: 'none')." → {$validated['role']}", $user, ['role' => [implode(', ', $oldRoles), $validated['role']]]);
        }

        return response()->json(['data' => $this->row($user->fresh())]);
    }

    /** Only the admin role may grant admin. */
    private function assertCanGrant(Request $request, string $role): void
    {
        abort_if($role === 'admin' && ! $request->user()->hasRole('admin'), 403, 'Only an administrator can grant the admin role.');
    }

    /** @return array<string, mixed> */
    private function row(User $user): array
    {
        return [
            'id' => $user->id,
            'name' => $user->name,
            'email' => $user->email,
            'is_active' => $user->is_active,
            'role' => $user->getRoleNames()->first(),
            'must_change_password' => $user->password_changed_at === null,
            'created_at' => $user->created_at,
        ];
    }
}
