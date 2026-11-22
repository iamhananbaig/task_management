<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Support\Audit;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\Rules\Password;
use Illuminate\Validation\ValidationException;

/**
 * Sign-in for the web app and the phone app (Sanctum bearer tokens). There is no public
 * sign-up: administrators create accounts (UserController).
 */
class AuthController extends Controller
{
    public function login(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'email' => ['required', 'string', 'email'],
            'password' => ['required', 'string'],
            // "web" or the phone's name ("Ali's iPhone"), shown on the token
            'device_name' => ['nullable', 'string', 'max:100'],
        ]);

        $user = User::where('email', $validated['email'])->first();

        if (! $user || ! Hash::check($validated['password'], $user->password)) {
            Audit::log('sign-in failed', "Failed sign-in for {$validated['email']}", $user, [], 'Auth', $user);
            throw ValidationException::withMessages(['email' => ['The email or password is incorrect.']]);
        }
        if (! $user->is_active) {
            Audit::log('sign-in failed', 'Sign-in refused: account deactivated', $user, [], 'Auth', $user);
            throw ValidationException::withMessages(['email' => ['This account has been deactivated. Ask an administrator.']]);
        }

        $token = $user->createToken($validated['device_name'] ?? 'web')->plainTextToken;
        Audit::log('signed in', 'Signed in'.(isset($validated['device_name']) ? " ({$validated['device_name']})" : ''), $user, [], 'Auth', $user);

        return response()->json(['user' => $this->userPayload($user), 'token' => $token]);
    }

    public function user(Request $request): JsonResponse
    {
        return response()->json($this->userPayload($request->user()));
    }

    /** Set your own password. Also clears the "must change password" flag. */
    public function changePassword(Request $request): JsonResponse
    {
        $user = $request->user();
        $request->validate([
            'current_password' => ['required', 'string'],
            'password' => ['required', 'string', 'confirmed', Password::min(10)->letters()->numbers(), 'not_in:password,password123,admin12345'],
        ]);
        if (! Hash::check($request->input('current_password'), $user->password)) {
            throw ValidationException::withMessages(['current_password' => ['Your current password is incorrect.']]);
        }
        if (Hash::check($request->input('password'), $user->password)) {
            throw ValidationException::withMessages(['password' => ['Choose a password different from the current one.']]);
        }

        $user->forceFill(['password' => $request->input('password'), 'password_changed_at' => now()])->saveQuietly();
        // Sign out every other session
        $user->tokens()->where('id', '!=', $user->currentAccessToken()?->id)->delete();
        Audit::log('password changed', 'Changed own password', $user, [], 'User');

        return response()->json($this->userPayload($user));
    }

    public function logout(Request $request): JsonResponse
    {
        // Stop pushing to this phone once it signs out
        if ($pushToken = $request->input('push_token')) {
            $request->user()->deviceTokens()->where('token', $pushToken)->delete();
        }
        $request->user()->currentAccessToken()?->delete();

        return response()->json(['message' => 'Signed out.']);
    }

    /**
     * User with roles and the flattened permission names (the apps hide what you cannot do).
     *
     * @return array<string, mixed>
     */
    private function userPayload(User $user): array
    {
        $user->load('roles:id,name');

        return [
            'id' => $user->id,
            'name' => $user->name,
            'email' => $user->email,
            'is_active' => $user->is_active,
            'roles' => $user->roles->map(fn ($role) => ['name' => $role->name])->values(),
            'permissions' => $user->getAllPermissions()->pluck('name')->values(),
            // true → the apps show only the "set a new password" screen (RequirePasswordChange)
            'must_change_password' => $user->password_changed_at === null,
            'unread_notifications' => $user->unreadNotifications()->count(),
        ];
    }
}
