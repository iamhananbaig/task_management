import * as React from 'react';
import { Pressable, RefreshControl, ScrollView, SectionList, View } from 'react-native';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { PlusIcon } from 'phosphor-react-native';

import { Dot, TaskRow } from '@/components/task-bits';
import { Chip, Empty, ErrorView, Loading, Screen, Text } from '@/components/ui';
import { errorMessage } from '@/lib/api';
import { useBoard, useProject } from '@/lib/queries';
import { space, useTheme } from '@/lib/theme';

/** A project's tasks grouped by status (the board as a list), newest work first in each. */
export default function ProjectScreen() {
  const theme = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const project = useProject(id);
  const [assignee, setAssignee] = React.useState('');
  const tasks = useBoard(id, { assignee: assignee || undefined });

  const sections = React.useMemo(
    () =>
      (project.data?.statuses ?? [])
        .map((status) => ({ status, data: (tasks.data ?? []).filter((task) => task.status?.id === status.id) }))
        .filter((section) => section.data.length > 0),
    [project.data, tasks.data]
  );

  const canCreate = !!project.data?.can?.create_tasks;

  return (
    <Screen>
      <Stack.Screen
        options={{
          title: project.data?.name ?? 'Project',
          headerRight: canCreate
            ? () => (
                <Pressable accessibilityRole="button" accessibilityLabel="New task" hitSlop={12} onPress={() => router.push({ pathname: '/new-task', params: { projectId: String(project.data?.id) } })}>
                  <PlusIcon color={theme.primary} size={24} weight="bold" />
                </Pressable>
              )
            : undefined,
        }}
      />
      <SectionList
        contentInsetAdjustmentBehavior="automatic"
        sections={sections}
        keyExtractor={(task) => String(task.id)}
        stickySectionHeadersEnabled={false}
        contentContainerStyle={{ padding: space.lg, gap: space.sm, flexGrow: 1 }}
        refreshControl={<RefreshControl refreshing={tasks.isRefetching} onRefresh={() => { void tasks.refetch(); void project.refetch(); }} tintColor={theme.textMuted} />}
        ListHeaderComponent={
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space.sm, marginBottom: space.sm }}>
            <Chip label="Everyone" selected={assignee === ''} onPress={() => setAssignee('')} />
            <Chip label="Mine" selected={assignee === 'me'} onPress={() => setAssignee('me')} />
            <Chip label="Unassigned" selected={assignee === 'none'} onPress={() => setAssignee('none')} />
          </ScrollView>
        }
        renderSectionHeader={({ section }) => (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm, marginTop: space.md }}>
            <Dot color={section.status.color} />
            <Text weight="700">{section.status.name}</Text>
            <Text tone="muted" size={13}>
              {section.data.length}
            </Text>
          </View>
        )}
        ListEmptyComponent={
          project.isLoading || tasks.isLoading ? <Loading /> : project.error || tasks.error ? <ErrorView message={errorMessage(project.error ?? tasks.error)} /> : <Empty title="No tasks" description={canCreate ? 'Tap + to add the first one.' : undefined} />
        }
        renderItem={({ item }) => <TaskRow task={item} onPress={() => router.push(`/task/${item.id}`)} />}
      />
    </Screen>
  );
}
