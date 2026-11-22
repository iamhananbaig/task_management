import * as React from 'react';
import { ScrollView, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useMutation } from '@tanstack/react-query';

import { DateField } from '@/components/date-field';
import { Button, Input, Screen, Select, Text } from '@/components/ui';
import { api, errorMessage } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { priorities, priorityLabels } from '@/lib/labels';
import { useMembers, useProject } from '@/lib/queries';
import { space } from '@/lib/theme';
import type { Priority, Task } from '@/lib/types';

/** New task in a project (modal). It starts in the project's first status. */
export default function NewTask() {
  const { projectId } = useLocalSearchParams<{ projectId: string }>();
  const { user } = useAuth();
  const project = useProject(projectId);
  const members = useMembers(project.data?.id);
  const [title, setTitle] = React.useState('');
  const [description, setDescription] = React.useState('');
  const [assignee, setAssignee] = React.useState(user ? String(user.id) : '');
  const [reviewer, setReviewer] = React.useState('');
  const [priority, setPriority] = React.useState<Priority>('medium');
  const [due, setDue] = React.useState('');

  const create = useMutation({
    mutationFn: async () =>
      (
        await api.post<{ data: Task }>(`/projects/${projectId}/tasks`, {
          title: title.trim(),
          description: description || null,
          priority,
          assignee_id: assignee ? Number(assignee) : null,
          reviewer_id: reviewer ? Number(reviewer) : null,
          due_date: due || null,
        })
      ).data.data,
    onSuccess: (task) => router.replace(`/task/${task.id}`),
    onError: () => undefined,
  });

  const people = [{ value: '', label: 'Nobody' }, ...(members.data ?? []).map((member) => ({ value: String(member.id), label: member.id === user?.id ? `Me (${member.name})` : member.name }))];
  const isMember = members.data?.some((member) => member.id === user?.id);

  return (
    <Screen>
      <ScrollView contentContainerStyle={{ padding: space.lg, gap: space.lg }} keyboardShouldPersistTaps="handled">
        <Text tone="muted">{project.data?.name}</Text>
        {create.error && <Text tone="danger">{errorMessage(create.error)}</Text>}
        <Input label="Title" autoFocus value={title} onChangeText={setTitle} maxLength={255} />
        <Input label="Description" multiline value={description} onChangeText={setDescription} />
        <View style={{ flexDirection: 'row', gap: space.md }}>
          <Select label="Assignee" value={isMember || !assignee ? assignee : ''} options={people} onChange={setAssignee} />
          <Select label="Reviewer" value={reviewer} options={people} onChange={setReviewer} />
        </View>
        <View style={{ flexDirection: 'row', gap: space.md }}>
          <Select label="Priority" value={priority} options={priorities.map((value) => ({ value, label: priorityLabels[value] }))} onChange={(value) => setPriority(value as Priority)} />
          <DateField label="Due" value={due} onChange={setDue} />
        </View>
        <Button title="Create task" disabled={!title.trim()} loading={create.isPending} onPress={() => create.mutate()} />
      </ScrollView>
    </Screen>
  );
}
