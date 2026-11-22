<?php

namespace App\Notifications\Channels;

use App\Models\DeviceToken;
use Illuminate\Notifications\Notification;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Throwable;

/**
 * Sends a notification to the user's phones through Expo's push service.
 * Push is best effort: a failure is logged and never fails the request that caused it.
 * Tokens Expo reports as no longer registered (app uninstalled) are removed.
 */
class ExpoPushChannel
{
    private const ENDPOINT = 'https://exp.host/--/api/v2/push/send';

    public function send(object $notifiable, Notification $notification): void
    {
        if (! config('services.expo.enabled') || ! method_exists($notification, 'toExpo')) {
            return;
        }
        $tokens = $notifiable->routeNotificationFor('expo', $notification);
        if (! $tokens) {
            return;
        }

        /** @var array{title: string, body: string, data?: array<string, mixed>} $message */
        $message = $notification->toExpo($notifiable);
        $messages = array_map(fn (string $token) => [
            'to' => $token,
            'title' => $message['title'],
            'body' => $message['body'],
            'data' => $message['data'] ?? [],
            'sound' => 'default',
            'priority' => 'high',
        ], $tokens);

        try {
            $request = Http::connectTimeout(3)->timeout(5)->acceptJson();
            if ($accessToken = config('services.expo.access_token')) {
                $request = $request->withToken($accessToken);
            }
            $response = $request->post(self::ENDPOINT, $messages);

            foreach ($response->json('data', []) as $index => $ticket) {
                if (($ticket['details']['error'] ?? null) === 'DeviceNotRegistered' && isset($tokens[$index])) {
                    DeviceToken::where('token', $tokens[$index])->delete();
                }
            }
        } catch (Throwable $exception) {
            Log::warning('Expo push failed: '.$exception->getMessage());
        }
    }
}
