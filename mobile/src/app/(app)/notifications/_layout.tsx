import { Stack } from 'expo-router';

export default function NotificationsStack() {
  return <Stack screenOptions={{ headerLargeTitle: true }}><Stack.Screen name="index" options={{ title: 'Notifications' }} /></Stack>;
}
