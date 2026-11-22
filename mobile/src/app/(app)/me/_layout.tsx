import { Stack } from 'expo-router';

export default function MeStack() {
  return <Stack screenOptions={{ headerLargeTitle: true }}><Stack.Screen name="index" options={{ title: 'Me' }} /></Stack>;
}
