import { FlatList, View } from 'react-native';
import { router, Stack, useLocalSearchParams } from 'expo-router';

import { TaskRow } from '@/components/task-bits';
import { Empty, ErrorView, Loading, Screen, Text } from '@/components/ui';
import { errorMessage } from '@/lib/api';
import { formatDate } from '@/lib/format';
import { useRun, useTasks } from '@/lib/queries';
import { space, useTheme } from '@/lib/theme';

/** One period of a routine (e.g. "November 2026 · Month-end close"): progress and its tasks. */
export default function RunScreen() {
  const theme = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const run = useRun(id);
  const tasks = useTasks({ routine_run_id: Number(id), per_page: 200, sort: 'due_date' });

  if (run.isLoading) return <Loading />;
  if (!run.data) return <ErrorView message={errorMessage(run.error)} onRetry={() => run.refetch()} />;
  const { total, done, review, overdue } = run.data.progress;

  return (
    <Screen>
      <Stack.Screen options={{ title: run.data.name }} />
      <FlatList
        data={tasks.data ?? []}
        keyExtractor={(task) => String(task.id)}
        contentContainerStyle={{ padding: space.lg, gap: space.sm }}
        ListHeaderComponent={
          <View style={{ gap: space.sm, marginBottom: space.sm }}>
            <Text tone="muted" size={14}>
              {run.data.project?.name} · {formatDate(run.data.period_start)} – {formatDate(run.data.period_end)}
            </Text>
            <View style={{ height: 8, borderRadius: 4, backgroundColor: theme.surface, overflow: 'hidden' }}>
              <View style={{ height: 8, width: `${total ? (done / total) * 100 : 0}%`, backgroundColor: theme.primary }} />
            </View>
            <Text size={14}>
              {done}/{total} done · {review} in review · <Text size={14} tone={overdue ? 'danger' : 'muted'} weight={overdue ? '700' : '500'}>{overdue} overdue</Text>
            </Text>
          </View>
        }
        ListEmptyComponent={tasks.isLoading ? <Loading /> : <Empty title="No tasks" />}
        renderItem={({ item }) => <TaskRow task={item} onPress={() => router.push(`/task/${item.id}`)} />}
      />
    </Screen>
  );
}
