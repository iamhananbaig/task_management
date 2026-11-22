<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\DeviceToken;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/** Phones register their Expo push token after sign-in. A token belongs to one user at a time. */
class DeviceController extends Controller
{
    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'token' => ['required', 'string', 'max:255', 'regex:/^Expo(nent)?PushToken\[.+\]$/'],
            'platform' => ['required', 'in:ios,android'],
            'device_name' => ['nullable', 'string', 'max:100'],
        ]);

        DeviceToken::updateOrCreate(
            ['token' => $validated['token']],
            ['user_id' => $request->user()->id, 'platform' => $validated['platform'], 'device_name' => $validated['device_name'] ?? null, 'last_used_at' => now()],
        );

        return response()->json(['message' => 'Device registered.']);
    }

    public function destroy(Request $request): JsonResponse
    {
        $validated = $request->validate(['token' => ['required', 'string']]);
        $request->user()->deviceTokens()->where('token', $validated['token'])->delete();

        return response()->json(['message' => 'Device removed.']);
    }
}
