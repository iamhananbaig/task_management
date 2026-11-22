import { Alert, ScrollView } from 'react-native';
import { router } from 'expo-router';

import { PasswordForm } from '@/components/password-form';
import { Screen, Text } from '@/components/ui';
import { space } from '@/lib/theme';

export default function ChangePassword() {
  return (
    <Screen>
      <ScrollView contentContainerStyle={{ padding: space.xl, gap: space.xl }} keyboardShouldPersistTaps="handled">
        <Text tone="muted">Other phones and browsers signed in to your account are signed out.</Text>
        <PasswordForm
          onDone={() => {
            Alert.alert('Password changed');
            router.back();
          }}
        />
      </ScrollView>
    </Screen>
  );
}
