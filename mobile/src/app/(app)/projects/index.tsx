import { FlatList, RefreshControl, View } from 'react-native';
import { router } from 'expo-router';
import { LockSimpleIcon, WarningCircleIcon } from 'phosphor-react-native';

import { Dot } from '@/components/task-bits';
import { Card, Empty, ErrorView, Loading, Screen, Text } from '@/components/ui';
import { errorMessage } from '@/lib/api';
import { useProjects } from '@/lib/queries';
import { space, useTheme } from '@/lib/theme';

export default function Projects() {
  const theme = useTheme();
  const projects = useProjects();

  return (
    <Screen>
      <FlatList
        contentInsetAdjustmentBehavior="automatic"
        data={projects.data ?? []}
        keyExtractor={(project) => String(project.id)}
        contentContainerStyle={{ padding: space.lg, gap: space.sm, flexGrow: 1 }}
        refreshControl={<RefreshControl refreshing={projects.isRefetching} onRefresh={() => void projects.refetch()} tintColor={theme.textMuted} />}
        ListEmptyComponent={projects.isLoading ? <Loading /> : projects.error ? <ErrorView message={errorMessage(projects.error)} onRetry={() => projects.refetch()} /> : <Empty title="No projects" description="Ask a manager to add you to a project." />}
        renderItem={({ item }) => {
          const open = item.open_tasks_count ?? 0;
          const done = item.done_tasks_count ?? 0;
          return (
            <Card onPress={() => router.push(`/projects/${item.id}`)} style={{ gap: space.sm }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
                <Dot color={item.color} size={10} />
                <Text weight="700" style={{ flex: 1 }} numberOfLines={1}>
                  {item.name}
                </Text>
                {item.is_restricted && <LockSimpleIcon size={16} color={theme.textMuted} />}
                <Text size={12} tone="muted">
                  {item.key}
                </Text>
              </View>
              <View style={{ height: 6, borderRadius: 3, backgroundColor: theme.surface, overflow: 'hidden' }}>
                <View style={{ height: 6, width: `${open + done ? (done / (open + done)) * 100 : 0}%`, backgroundColor: theme.primary }} />
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
                <Text size={13} tone="muted">
                  {done} of {open + done} done
                </Text>
                {!!item.overdue_tasks_count && (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                    <WarningCircleIcon size={14} color={theme.danger} />
                    <Text size={13} tone="danger" weight="600">
                      {item.overdue_tasks_count} overdue
                    </Text>
                  </View>
                )}
              </View>
            </Card>
          );
        }}
      />
    </Screen>
  );
}
