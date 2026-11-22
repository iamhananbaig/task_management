import * as React from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, View } from 'react-native';
import { CheckSquareOffsetIcon } from 'phosphor-react-native';

import { Button, Input, Screen, Text } from '@/components/ui';
import { errorMessage } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { radius, space, useTheme } from '@/lib/theme';

export default function Login() {
  const theme = useTheme();
  const { signIn, server: savedServer } = useAuth();
  const [server, setServer] = React.useState(savedServer);
  const [showServer, setShowServer] = React.useState(false);
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [error, setError] = React.useState('');
  const [busy, setBusy] = React.useState(false);

  const submit = async () => {
    setError('');
    setBusy(true);
    try {
      await signIn(server, email, password);
    } catch (err) {
      setError(errorMessage(err, 'Sign-in failed.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen edges={['top', 'bottom']}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: space.xl, gap: space.xl }} keyboardShouldPersistTaps="handled">
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
            <View style={{ width: 44, height: 44, borderRadius: radius.md, backgroundColor: theme.primary, alignItems: 'center', justifyContent: 'center' }}>
              <CheckSquareOffsetIcon color={theme.primaryText} size={24} weight="bold" />
            </View>
            <View>
              <Text size={20} weight="700">
                Tasks
              </Text>
              <Text tone="muted" size={14}>
                Team task management
              </Text>
            </View>
          </View>
          <View style={{ gap: space.xs }}>
            <Text size={24} weight="700">
              Sign in
            </Text>
            <Text tone="muted">Use the account your administrator created for you.</Text>
          </View>
          <View style={{ gap: space.lg }}>
            {!!error && <Text tone="danger">{error}</Text>}
            <Input label="Email" keyboardType="email-address" autoCapitalize="none" autoComplete="email" textContentType="username" value={email} onChangeText={setEmail} />
            <Input label="Password" secureTextEntry autoComplete="current-password" textContentType="password" value={password} onChangeText={setPassword} onSubmitEditing={submit} />
            <Button title="Sign in" loading={busy} disabled={!email || !password} onPress={submit} />
          </View>
          <View style={{ gap: space.sm }}>
            <Pressable accessibilityRole="button" onPress={() => setShowServer(!showServer)} hitSlop={8}>
              <Text tone="muted" size={13}>
                Server: {server} · {showServer ? 'hide' : 'change'}
              </Text>
            </Pressable>
            {showServer && <Input label="Server address" autoCapitalize="none" autoCorrect={false} keyboardType="url" value={server} onChangeText={setServer} placeholder="https://tasks.example.com" />}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}
