<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * A user who has never set their own password (new account or admin reset) can only read
 * their profile, change the password, register a phone, or sign out.
 * Also signs out deactivated users at once.
 */
class RequirePasswordChange
{
    private const ALLOWED = ['api/v1/user', 'api/v1/user/password', 'api/v1/logout', 'api/v1/devices'];

    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();
        if ($user && ! $user->is_active) {
            $user->currentAccessToken()?->delete();

            return response()->json(['message' => 'This account has been deactivated.'], 401);
        }
        if ($user && $user->password_changed_at === null && ! in_array($request->path(), self::ALLOWED, true)) {
            return response()->json([
                'message' => 'Set a new password before continuing.',
                'code' => 'password_change_required',
            ], 403);
        }

        return $next($request);
    }
}
