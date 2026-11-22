import { ScrollView } from 'react-native';

import { PasswordForm } from '@/components/password-form';
import { Button, Screen, Text } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { space } from '@/lib/theme';

/** Shown instead of the app until a new account / admin reset sets its own password. */
export default function SetPassword() {
  const { user, signOut } = useAuth();
  return (
    <Screen>
      <ScrollView contentContainerStyle={{ padding: space.xl, gap: space.xl }} keyboardShouldPersistTaps="handled">
        <Text tone="muted">{user?.name ? `${user.name}, your` : 'Your'} password was set by an administrator. Choose your own before continuing.</Text>
        <PasswordForm submitLabel="Save and continue" />
        <Button title="Sign out" variant="ghost" onPress={() => signOut()} />
      </ScrollView>
    </Screen>
  );
}
