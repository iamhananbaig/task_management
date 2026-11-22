import { useColorScheme } from 'react-native';
import { NativeTabs } from 'expo-router/native-tabs';

import { useNotifications } from '@/lib/queries';
import { useTheme } from '@/lib/theme';

/** Bottom tabs, each with its own stack: My tasks, Projects, Notifications, Me. */
export default function AppTabs() {
  const theme = useTheme();
  const scheme = useColorScheme();
  const notifications = useNotifications();
  const unread = notifications.data?.unread ?? 0;

  return (
    <NativeTabs backgroundColor={theme.background} labelStyle={{ selected: { color: theme.primary } }} tintColor={theme.primary} key={scheme}>
      <NativeTabs.Trigger name="my-tasks">
        <NativeTabs.Trigger.Label>My tasks</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="checklist" md="checklist" />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="projects">
        <NativeTabs.Trigger.Label>Projects</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="folder" md="folder" />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="notifications">
        <NativeTabs.Trigger.Label>Alerts</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="bell" md="notifications" />
        <NativeTabs.Trigger.Badge>{unread > 0 ? String(Math.min(unread, 99)) : undefined}</NativeTabs.Trigger.Badge>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="me">
        <NativeTabs.Trigger.Label>Me</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="person.crop.circle" md="account_circle" />
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
