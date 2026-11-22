import * as React from 'react';
import { router } from 'expo-router';
import * as Notifications from 'expo-notifications';

import { routeForNotification } from '@/lib/push';

/** Tapping a push notification opens its task (or routine run) once the app is signed in. */
export function useNotificationTaps(appOpen: boolean) {
  const last = Notifications.useLastNotificationResponse();
  React.useEffect(() => {
    if (!appOpen || !last) return;
    const route = routeForNotification(last.notification.request.content.data as Record<string, unknown>);
    if (route) router.push(route as never);
    void Notifications.clearLastNotificationResponseAsync();
  }, [appOpen, last]);
}
