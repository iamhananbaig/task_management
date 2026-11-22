import * as React from 'react';
import { FlatList, RefreshControl, ScrollView, View } from 'react-native';
import { router } from 'expo-router';

import { TaskRow } from '@/components/task-bits';
import { Chip, Empty, ErrorView, Loading, Screen, Segmented, Text } from '@/components/ui';
import { errorMessage } from '@/lib/api';
import { useDashboard, useTasks, type TaskFilters } from '@/lib/queries';
import { space, useTheme } from '@/lib/theme';

const dueChips = [
  { value: '', label: 'All' },
  { value: 'overdue', label: 'Overdue' },
  { value: 'today', label: 'Today' },
  { value: 'week', label: 'Next 7 days' },
  { value: 'none', label: 'No date' },
];

/** Tasks assigned to me (by due date) or waiting for my review. */
export default function MyTasks() {
  const theme = useTheme();
  const [tab, setTab] = React.useState<'assigned' | 'review'>('assigned');
  const [due, setDue] = React.useState('');
  const dashboard = useDashboard();
  const filters: TaskFilters = tab === 'review' ? { reviewer: 'me', status_type: 'review', per_page: 100 } : { assignee: 'me', due: due || undefined, sort: 'due_date', per_page: 100 };
  const tasks = useTasks(filters);
  const counts = dashboard.data?.counts;

  return (
    <Screen>
      <FlatList
        contentInsetAdjustmentBehavior="automatic"
        data={tasks.data ?? []}
        keyExtractor={(task) => String(task.id)}
        contentContainerStyle={{ padding: space.lg, gap: space.sm, flexGrow: 1 }}
        refreshControl={<RefreshControl refreshing={tasks.isRefetching} onRefresh={() => { void tasks.refetch(); void dashboard.refetch(); }} tintColor={theme.textMuted} />}
        ListHeaderComponent={
          <View style={{ gap: space.md, marginBottom: space.sm }}>
            {counts && (
              <View style={{ flexDirection: 'row', gap: space.sm }}>
                <Count label="Open" value={counts.open} />
                <Count label="Overdue" value={counts.overdue} danger={counts.overdue > 0} />
                <Count label="Due today" value={counts.due_today} />
                <Count label="To review" value={counts.to_review} />
              </View>
            )}
            <Segmented
              value={tab}
              onChange={setTab}
              options={[
                { value: 'assigned', label: 'Assigned to me' },
                { value: 'review', label: `To review${counts?.to_review ? ` (${counts.to_review})` : ''}` },
              ]}
            />
            {tab === 'assigned' && (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space.sm }}>
                {dueChips.map((chip) => (
                  <Chip key={chip.value} label={chip.label} selected={due === chip.value} onPress={() => setDue(chip.value)} />
                ))}
              </ScrollView>
            )}
          </View>
        }
        ListEmptyComponent={
          tasks.isLoading ? <Loading /> : tasks.error ? <ErrorView message={errorMessage(tasks.error)} onRetry={() => tasks.refetch()} /> : <Empty title={tab === 'review' ? 'Nothing to review' : 'No tasks here'} description={tab === 'review' ? 'Tasks submitted to you for review appear here.' : undefined} />
        }
        renderItem={({ item }) => <TaskRow task={item} showProject onPress={() => router.push(`/task/${item.id}`)} />}
      />
    </Screen>
  );
}

function Count({ label, value, danger }: { label: string; value: number; danger?: boolean }) {
  const theme = useTheme();
  return (
    <View style={{ flex: 1, borderRadius: 10, borderWidth: 1, borderColor: danger ? theme.danger : theme.border, backgroundColor: theme.card, paddingVertical: space.sm, paddingHorizontal: space.sm }}>
      <Text size={12} tone="muted" numberOfLines={1}>
        {label}
      </Text>
      <Text size={18} weight="700" tone={danger ? 'danger' : undefined}>
        {value}
      </Text>
    </View>
  );
}
