import { FlatList, Pressable, RefreshControl, View } from 'react-native';
import { router, Stack } from 'expo-router';
import { useMutation } from '@tanstack/react-query';

import { Divider, Empty, ErrorView, Loading, Screen, Text } from '@/components/ui';
import { api, errorMessage } from '@/lib/api';
import { timeAgo } from '@/lib/format';
import { routeForNotification } from '@/lib/push';
import { useNotifications } from '@/lib/queries';
import { space, useTheme } from '@/lib/theme';

export default function NotificationsScreen() {
  const theme = useTheme();
  const notifications = useNotifications();
  const read = useMutation({ mutationFn: async (id: string) => api.post(`/notifications/${id}/read`) });
  const readAll = useMutation({ mutationFn: async () => api.post('/notifications/read-all') });

  return (
    <Screen>
      <Stack.Screen
        options={{
          headerRight: notifications.data?.unread
            ? () => (
                <Pressable accessibilityRole="button" onPress={() => readAll.mutate()} hitSlop={12}>
                  <Text tone="primary" weight="600">
                    Read all
                  </Text>
                </Pressable>
              )
            : undefined,
        }}
      />
      <FlatList
        contentInsetAdjustmentBehavior="automatic"
        data={notifications.data?.data ?? []}
        keyExtractor={(notification) => notification.id}
        ItemSeparatorComponent={Divider}
        contentContainerStyle={{ flexGrow: 1 }}
        refreshControl={<RefreshControl refreshing={notifications.isRefetching} onRefresh={() => void notifications.refetch()} tintColor={theme.textMuted} />}
        ListEmptyComponent={notifications.isLoading ? <Loading /> : notifications.error ? <ErrorView message={errorMessage(notifications.error)} /> : <Empty title="You're all caught up" />}
        renderItem={({ item }) => {
          const unread = !item.read_at;
          const danger = ['overdue', 'escalated'].includes(item.data.kind);
          return (
            <Pressable
              accessibilityRole="button"
              onPress={() => {
                if (unread) read.mutate(item.id);
                const route = routeForNotification(item.data as unknown as Record<string, unknown>);
                if (route) router.push(route as never);
              }}
              style={({ pressed }) => ({ flexDirection: 'row', gap: space.md, padding: space.lg, backgroundColor: pressed ? theme.surface : unread ? theme.surface : theme.background })}
            >
              <View style={{ width: 8, paddingTop: 6 }}>{unread && <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: theme.primary }} />}</View>
              <View style={{ flex: 1, gap: 2 }}>
                <Text weight={unread ? '700' : '500'} tone={danger ? 'danger' : undefined}>
                  {item.data.title}
                </Text>
                <Text size={14} tone="muted">
                  {item.data.body}
                </Text>
                <Text size={12} tone="muted">
                  {timeAgo(item.created_at)}
                </Text>
              </View>
            </Pressable>
          );
        }}
      />
    </Screen>
  );
}
