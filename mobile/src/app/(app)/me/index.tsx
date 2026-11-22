import { Alert, ScrollView, View } from 'react-native';
import * as Application from 'expo-application';
import { router } from 'expo-router';

import { Avatar } from '@/components/task-bits';
import { Button, Card, Heading, Screen, Text } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { space } from '@/lib/theme';

export default function Me() {
  const { user, server, signOut } = useAuth();
  if (!user) return null;
  return (
    <Screen>
      <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={{ padding: space.lg, gap: space.xl }}>
        <Card style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
          <Avatar user={user} size={48} />
          <View style={{ flex: 1 }}>
            <Text size={17} weight="700">
              {user.name}
            </Text>
            <Text tone="muted" size={14}>
              {user.email}
            </Text>
            <Text tone="muted" size={13} style={{ textTransform: 'capitalize' }}>
              {user.roles.map((role) => role.name).join(', ') || 'No role'}
            </Text>
          </View>
        </Card>
        <View style={{ gap: space.sm }}>
          <Heading>Account</Heading>
          <Button title="Change password" variant="outline" onPress={() => router.push('/change-password')} />
          <Button
            title="Sign out"
            variant="danger"
            onPress={() =>
              Alert.alert('Sign out?', 'You will stop getting notifications on this phone.', [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Sign out', style: 'destructive', onPress: () => void signOut() },
              ])
            }
          />
        </View>
        <View style={{ gap: space.xs }}>
          <Heading>About</Heading>
          <Text tone="muted" size={13}>
            Server: {server}
          </Text>
          <Text tone="muted" size={13}>
            Version {Application.nativeApplicationVersion ?? '—'} ({Application.nativeBuildVersion ?? 'dev'})
          </Text>
        </View>
      </ScrollView>
    </Screen>
  );
}
