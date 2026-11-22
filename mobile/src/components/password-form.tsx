import * as React from 'react';
import { View } from 'react-native';

import { Button, Input, Text } from '@/components/ui';
import { api, errorMessage } from '@/lib/api';
import { useAuth, type User } from '@/lib/auth';
import { space } from '@/lib/theme';

/** Current password + new password twice (PUT /user/password). Signs other devices out. */
export function PasswordForm({ onDone, submitLabel = 'Change password' }: { onDone?: () => void; submitLabel?: string }) {
  const { setUser } = useAuth();
  const [current, setCurrent] = React.useState('');
  const [next, setNext] = React.useState('');
  const [confirm, setConfirm] = React.useState('');
  const [error, setError] = React.useState('');
  const [busy, setBusy] = React.useState(false);

  const submit = async () => {
    setError('');
    if (next !== confirm) {
      setError('The new passwords do not match.');
      return;
    }
    setBusy(true);
    try {
      const res = await api.put<User>('/user/password', { current_password: current, password: next, password_confirmation: confirm });
      setUser(res.data);
      onDone?.();
    } catch (err) {
      setError(errorMessage(err, 'Could not change the password.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={{ gap: space.lg }}>
      {!!error && <Text tone="danger">{error}</Text>}
      <Input label="Current password" secureTextEntry autoComplete="current-password" value={current} onChangeText={setCurrent} />
      <Input label="New password" secureTextEntry autoComplete="new-password" value={next} onChangeText={setNext} />
      <Text size={13} tone="muted" style={{ marginTop: -space.sm }}>
        At least 10 characters, with letters and numbers.
      </Text>
      <Input label="Repeat new password" secureTextEntry autoComplete="new-password" value={confirm} onChangeText={setConfirm} onSubmitEditing={submit} />
      <Button title={submitLabel} loading={busy} disabled={!current || next.length < 10 || !confirm} onPress={submit} />
    </View>
  );
}
