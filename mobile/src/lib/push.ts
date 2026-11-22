import { Platform } from 'react-native';
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';

import { api } from '@/lib/api';
import { Keys, storage } from '@/lib/storage';

// Show notices that arrive while the app is open, too
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

/**
 * Ask for permission, get this phone's Expo push token and register it with the API
 * (POST /devices). Quietly does nothing on simulators, web, or without an EAS project id —
 * the app works without push; the bell still shows everything.
 */
export async function registerForPush(): Promise<string | null> {
  if (Platform.OS === 'web' || !Device.isDevice) return null;
  try {
    if (Platform.OS === 'android') {
      // Android 13+: a channel must exist before the permission prompt can appear
      await Notifications.setNotificationChannelAsync('default', {
        name: 'Tasks',
        // Re-exported via `export *`, which eslint-plugin-import cannot follow
        // eslint-disable-next-line import/namespace
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 200, 150, 200],
      });
    }
    let { status } = await Notifications.getPermissionsAsync();
    if (status !== 'granted') status = (await Notifications.requestPermissionsAsync()).status;
    if (status !== 'granted') return null;

    const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
    if (!projectId) {
      console.warn('[push] No EAS projectId in app config — run `npx eas-cli init` to enable push.');
      return null;
    }
    const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId });
    await api.post('/devices', { token, platform: Platform.OS === 'ios' ? 'ios' : 'android', device_name: Device.deviceName ?? Device.modelName ?? null });
    await storage.set(Keys.pushToken, token);
    return token;
  } catch (error) {
    console.warn('[push] Registration failed', error);
    return null;
  }
}

/** Where a tapped notification should open: a task or a routine run. */
export function routeForNotification(data: Record<string, unknown> | undefined): string | null {
  if (!data) return null;
  if (data.task_id) return `/task/${data.task_id}`;
  if (data.run_id) return `/run/${data.run_id}`;
  return null;
}
