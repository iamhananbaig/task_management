import { Stack } from 'expo-router';

export default function MyTasksStack() {
  return <Stack screenOptions={{ headerLargeTitle: true }}><Stack.Screen name="index" options={{ title: 'My tasks' }} /></Stack>;
}
