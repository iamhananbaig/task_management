import * as React from 'react';
import { ActionSheetIOS, Alert, KeyboardAvoidingView, Modal, Platform, Pressable, RefreshControl, ScrollView, StyleSheet, Switch, TextInput, View } from 'react-native';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useMutation, useQuery } from '@tanstack/react-query';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CameraIcon, CheckCircleIcon, CircleIcon, DotsThreeCircleIcon, FileArrowUpIcon, PaperclipIcon, PlusIcon } from 'phosphor-react-native';

import { DateField } from '@/components/date-field';
import { Avatar, Dot, DueText, StatusBadge, TagChip } from '@/components/task-bits';
import { Button, Divider, ErrorView, Heading, Input, Loading, Screen, Select, Text } from '@/components/ui';
import { api, errorMessage } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { openAttachment, pickDocument, pickPhoto, takePhoto, uploadAttachment, type PickedFile } from '@/lib/files';
import { fileSize, timeAgo } from '@/lib/format';
import { priorities, priorityLabels } from '@/lib/labels';
import { useComments, useMembers, useTask } from '@/lib/queries';
import { radius, space, useTheme } from '@/lib/theme';
import type { AvailableTransition, Task, TagGroup } from '@/lib/types';

const BACKWARD = /back|reopen|reject|return/i;

type Patch = Partial<Pick<Task, 'title' | 'description' | 'priority' | 'start_date' | 'due_date'>> & { assignee_id?: number | null; reviewer_id?: number | null; tag_ids?: number[] };

/** Everything about one task: workflow moves, people, dates, checklist, files, comments. */
export default function TaskScreen() {
  const theme = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const task = useTask(id);

  if (task.isLoading) return <Loading />;
  if (!task.data) return <ErrorView message={errorMessage(task.error, 'Task not found.')} onRetry={() => task.refetch()} />;
  const t = task.data;

  return (
    <Screen>
      <Stack.Screen options={{ title: t.reference, headerRight: () => <TaskMenu task={t} /> }} />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }} keyboardVerticalOffset={90}>
        <ScrollView
          contentContainerStyle={{ padding: space.lg, gap: space.xl, paddingBottom: 48 }}
          keyboardShouldPersistTaps="handled"
          refreshControl={<RefreshControl refreshing={task.isRefetching} onRefresh={() => void task.refetch()} tintColor={theme.textMuted} />}
        >
          <Header task={t} />
          <Moves task={t} />
          <Fields task={t} />
          <Description task={t} />
          <Checklist task={t} />
          <Files task={t} />
          <Comments task={t} />
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

function useUpdate(taskId: number) {
  return useMutation({ mutationFn: async (patch: Patch) => api.put(`/tasks/${taskId}`, patch) });
}

function Header({ task }: { task: Task }) {
  const theme = useTheme();
  const update = useUpdate(task.id);
  const [title, setTitle] = React.useState(task.title);
  // Follow changes from the server (adjusted during render, not in an effect)
  const [shownTitle, setShownTitle] = React.useState(task.title);
  if (shownTitle !== task.title) {
    setShownTitle(task.title);
    setTitle(task.title);
  }

  return (
    <View style={{ gap: space.sm }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
        <Dot color={task.project.color} />
        <Text size={13} tone="muted">
          {task.project.name} · {task.reference}
        </Text>
      </View>
      {task.can?.update ? (
        <TextInput
          accessibilityLabel="Title"
          value={title}
          onChangeText={setTitle}
          onEndEditing={() => (title.trim() && title.trim() !== task.title ? update.mutate({ title: title.trim() }) : setTitle(task.title))}
          multiline
          style={{ color: theme.text, fontSize: 21, fontWeight: '700', padding: 0 }}
        />
      ) : (
        <Text size={21} weight="700">
          {task.title}
        </Text>
      )}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md, flexWrap: 'wrap' }}>
        <StatusBadge status={task.status} />
        <DueText date={task.due_date} done={task.status?.type === 'done'} />
        {task.routine_run && (
          <Pressable accessibilityRole="link" onPress={() => router.push(`/run/${task.routine_run?.id}`)}>
            <Text size={13} tone="primary">
              {task.routine_run.name}
            </Text>
          </Pressable>
        )}
      </View>
      {!!task.tags?.length && !task.can?.update && (
        <View style={{ flexDirection: 'row', gap: space.xs, flexWrap: 'wrap' }}>
          {task.tags.map((tag) => (
            <TagChip key={tag.id} tag={tag} />
          ))}
        </View>
      )}
    </View>
  );
}

/** The workflow moves this user may make, as buttons. Comment / attachment rules are applied here too. */
function Moves({ task }: { task: Task }) {
  const [asking, setAsking] = React.useState<AvailableTransition | null>(null);
  const move = useMutation({
    mutationFn: async ({ transition, comment }: { transition: AvailableTransition; comment?: string }) => api.post(`/tasks/${task.id}/transitions/${transition.id}`, { comment: comment || null }),
  });
  const transitions = task.available_transitions ?? [];
  const hasFiles = (task.attachments?.length ?? 0) > 0;

  if (transitions.length === 0) {
    return (
      <Text size={13} tone="muted">
        No moves available to you at this step.
      </Text>
    );
  }
  const needsFile = transitions.filter((transition) => transition.requires_attachment && !hasFiles);

  return (
    <View style={{ gap: space.sm }}>
      <View style={{ flexDirection: 'row', gap: space.sm, flexWrap: 'wrap' }}>
        {transitions.map((transition) => (
          <Button
            key={transition.id}
            title={transition.label}
            variant={BACKWARD.test(transition.label) ? 'outline' : 'primary'}
            disabled={move.isPending || needsFile.includes(transition)}
            loading={move.isPending && move.variables?.transition.id === transition.id}
            style={{ flexGrow: 1 }}
            onPress={() => (transition.requires_comment ? setAsking(transition) : move.mutate({ transition }))}
          />
        ))}
      </View>
      {needsFile.length > 0 && (
        <Text size={13} tone="warning">
          Attach the supporting document (Files below) before “{needsFile.map((transition) => transition.label).join('”, “')}”.
        </Text>
      )}
      {asking && (
        <CommentSheet
          title={asking.label}
          placeholder="What needs to change?"
          busy={move.isPending}
          onClose={() => setAsking(null)}
          onSubmit={(comment) => move.mutate({ transition: asking, comment }, { onSuccess: () => setAsking(null) })}
        />
      )}
    </View>
  );
}

function Fields({ task }: { task: Task }) {
  const editable = !!task.can?.update;
  const members = useMembers(editable ? task.project.id : undefined);
  const tags = useQuery({ queryKey: ['tags'], queryFn: async () => (await api.get<{ data: TagGroup[] }>('/tags')).data.data, enabled: editable, staleTime: 300_000 });
  const update = useUpdate(task.id);
  const people = [{ value: '', label: 'Nobody' }, ...(members.data ?? []).map((member) => ({ value: String(member.id), label: member.name }))];
  // Keep the current person listed even if they left the project
  for (const person of [task.assignee, task.reviewer]) {
    if (person && !people.some((option) => option.value === String(person.id))) people.push({ value: String(person.id), label: person.name });
  }

  if (!editable) {
    return (
      <View style={{ gap: space.md }}>
        <Row label="Assignee" value={task.assignee?.name ?? 'Unassigned'} />
        <Row label="Reviewer" value={task.reviewer?.name ?? 'No reviewer'} />
        <Row label="Priority" value={priorityLabels[task.priority]} />
        <Row label="Created by" value={task.creator?.name ?? '—'} />
      </View>
    );
  }

  return (
    <View style={{ gap: space.md }}>
      <View style={{ flexDirection: 'row', gap: space.md }}>
        <Select label="Assignee" value={task.assignee ? String(task.assignee.id) : ''} options={people} onChange={(value) => update.mutate({ assignee_id: value ? Number(value) : null })} />
        <Select label="Reviewer" value={task.reviewer ? String(task.reviewer.id) : ''} options={people} onChange={(value) => update.mutate({ reviewer_id: value ? Number(value) : null })} />
      </View>
      <View style={{ flexDirection: 'row', gap: space.md }}>
        <Select label="Priority" value={task.priority} options={priorities.map((value) => ({ value, label: priorityLabels[value] }))} onChange={(value) => update.mutate({ priority: value as Task['priority'] })} />
        <DateField label="Due" value={task.due_date ?? ''} onChange={(value) => update.mutate({ due_date: value || null })} />
      </View>
      {(tags.data ?? []).length > 0 && (
        <View style={{ flexDirection: 'row', gap: space.md, flexWrap: 'wrap' }}>
          {tags.data?.map((group) => {
            const selected = task.tags?.find((tag) => tag.tag_group_id === group.id);
            return (
              <View key={group.id} style={{ minWidth: '45%', flex: 1 }}>
                <Select
                  label={group.name}
                  value={selected ? String(selected.id) : ''}
                  options={[{ value: '', label: '—' }, ...group.tags.filter((tag) => tag.is_active || tag.id === selected?.id).map((tag) => ({ value: String(tag.id), label: tag.name }))]}
                  onChange={(value) => {
                    const others = (task.tags ?? []).filter((tag) => tag.tag_group_id !== group.id).map((tag) => tag.id);
                    update.mutate({ tag_ids: value ? [...others, Number(value)] : others });
                  }}
                />
              </View>
            );
          })}
        </View>
      )}
    </View>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: space.md }}>
      <Text tone="muted">{label}</Text>
      <Text weight="600" style={{ flexShrink: 1, textAlign: 'right' }}>
        {value}
      </Text>
    </View>
  );
}

function Description({ task }: { task: Task }) {
  const update = useUpdate(task.id);
  const [value, setValue] = React.useState(task.description ?? '');
  const [shown, setShown] = React.useState(task.description);
  if (shown !== task.description) {
    setShown(task.description);
    setValue(task.description ?? '');
  }

  if (!task.can?.update) {
    return task.description ? (
      <View>
        <Heading>Description</Heading>
        <Text>{task.description}</Text>
      </View>
    ) : null;
  }
  return (
    <View>
      <Heading>Description</Heading>
      <Input multiline value={value} onChangeText={setValue} placeholder="Add details…" onEndEditing={() => value !== (task.description ?? '') && update.mutate({ description: value || null })} />
    </View>
  );
}

function Checklist({ task }: { task: Task }) {
  const theme = useTheme();
  const { user } = useAuth();
  const items = task.checklist ?? [];
  const canEdit = !!task.can?.update;
  const canTick = canEdit || task.assignee?.id === user?.id;
  const [title, setTitle] = React.useState('');
  const tick = useMutation({ mutationFn: async ({ id, is_done }: { id: number; is_done: boolean }) => api.put(`/checklist-items/${id}`, { is_done }) });
  const add = useMutation({ mutationFn: async () => api.post(`/tasks/${task.id}/checklist`, { title: title.trim() }), onSuccess: () => setTitle('') });

  if (!canEdit && items.length === 0) return null;
  const done = items.filter((item) => item.is_done).length;

  return (
    <View>
      <Heading>
        Checklist {items.length > 0 && `· ${done}/${items.length}`}
      </Heading>
      <View style={[styles.box, { borderColor: theme.border, backgroundColor: theme.card }]}>
        {items.map((item, index) => (
          <React.Fragment key={item.id}>
            {index > 0 && <Divider />}
            <Pressable
              accessibilityRole="checkbox"
              accessibilityState={{ checked: item.is_done, disabled: !canTick }}
              disabled={!canTick}
              onPress={() => tick.mutate({ id: item.id, is_done: !item.is_done })}
              style={styles.checkRow}
            >
              {item.is_done ? <CheckCircleIcon size={24} weight="fill" color={theme.success} /> : <CircleIcon size={24} color={theme.textMuted} />}
              <Text style={[{ flex: 1 }, item.is_done && { color: theme.textMuted, textDecorationLine: 'line-through' }]}>{item.title}</Text>
            </Pressable>
          </React.Fragment>
        ))}
        {canEdit && (
          <>
            {items.length > 0 && <Divider />}
            <View style={[styles.checkRow, { paddingVertical: 4 }]}>
              <PlusIcon size={20} color={theme.textMuted} />
              <TextInput value={title} onChangeText={setTitle} placeholder="Add an item" placeholderTextColor={theme.textMuted} onSubmitEditing={() => title.trim() && add.mutate()} returnKeyType="done" style={{ flex: 1, color: theme.text, fontSize: 16, minHeight: 40 }} />
            </View>
          </>
        )}
      </View>
    </View>
  );
}

function Files({ task }: { task: Task }) {
  const theme = useTheme();
  const files = task.attachments ?? [];
  const upload = useMutation({ mutationFn: async (file: PickedFile) => uploadAttachment(task.id, file) });
  const [opening, setOpening] = React.useState<number | null>(null);

  const choose = async (source: 'camera' | 'photo' | 'document') => {
    try {
      const file = source === 'camera' ? await takePhoto() : source === 'photo' ? await pickPhoto() : await pickDocument();
      if (file) upload.mutate(file);
    } catch (error) {
      Alert.alert('Could not attach', error instanceof Error ? error.message : errorMessage(error));
    }
  };

  const addFile = () => {
    const options = ['Take photo', 'Choose photo', 'Choose document', 'Cancel'];
    const handle = (index: number) => (index === 0 ? choose('camera') : index === 1 ? choose('photo') : index === 2 ? choose('document') : undefined);
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions({ options, cancelButtonIndex: 3, title: 'Attach a file' }, handle);
    } else {
      Alert.alert('Attach a file', undefined, [
        { text: 'Take photo', onPress: () => handle(0) },
        { text: 'Choose photo', onPress: () => handle(1) },
        { text: 'Choose document', onPress: () => handle(2) },
        { text: 'Cancel', style: 'cancel' },
      ]);
    }
  };

  return (
    <View>
      <Heading>Files {files.length > 0 && `· ${files.length}`}</Heading>
      {files.length > 0 && (
        <View style={[styles.box, { borderColor: theme.border, backgroundColor: theme.card, marginBottom: space.sm }]}>
          {files.map((file, index) => (
            <React.Fragment key={file.id}>
              {index > 0 && <Divider />}
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Open ${file.original_name}`}
                onPress={async () => {
                  setOpening(file.id);
                  try {
                    await openAttachment(file);
                  } catch (error) {
                    Alert.alert('Could not open the file', error instanceof Error ? error.message : errorMessage(error));
                  } finally {
                    setOpening(null);
                  }
                }}
                style={styles.checkRow}
              >
                <PaperclipIcon size={20} color={theme.textMuted} />
                <View style={{ flex: 1 }}>
                  <Text numberOfLines={1} weight="600">
                    {file.original_name}
                  </Text>
                  <Text size={12} tone="muted">
                    {opening === file.id ? 'Opening…' : `${fileSize(file.size)} · ${file.user?.name ?? '—'} · ${timeAgo(file.created_at)}`}
                  </Text>
                </View>
              </Pressable>
            </React.Fragment>
          ))}
        </View>
      )}
      {task.can?.comment && (
        <View style={{ flexDirection: 'row', gap: space.sm }}>
          <Button title="Photo" variant="outline" icon={<CameraIcon size={18} color={theme.text} />} style={{ flex: 1 }} onPress={() => choose('camera')} disabled={upload.isPending} />
          <Button title={upload.isPending ? 'Uploading…' : 'Attach file'} variant="outline" icon={<FileArrowUpIcon size={18} color={theme.text} />} style={{ flex: 1 }} onPress={addFile} loading={upload.isPending} />
        </View>
      )}
    </View>
  );
}

function Comments({ task }: { task: Task }) {
  const theme = useTheme();
  const comments = useComments(task.id);
  const [body, setBody] = React.useState('');
  const post = useMutation({ mutationFn: async () => api.post(`/tasks/${task.id}/comments`, { body: body.trim() }), onSuccess: () => setBody('') });

  return (
    <View style={{ gap: space.md }}>
      <Heading>Comments {comments.data?.length ? `· ${comments.data.length}` : ''}</Heading>
      {comments.data?.length === 0 && (
        <Text tone="muted" size={14}>
          No comments yet.
        </Text>
      )}
      {comments.data?.map((comment) => (
        <View key={comment.id} style={{ flexDirection: 'row', gap: space.md }}>
          <Avatar user={comment.user} size={30} />
          <View style={{ flex: 1, gap: 2 }}>
            <Text size={13}>
              <Text size={13} weight="700">
                {comment.user?.name ?? 'Deleted user'}
              </Text>
              <Text size={13} tone="muted">
                {'  '}
                {timeAgo(comment.created_at)}
                {comment.edited_at ? ' · edited' : ''}
              </Text>
            </Text>
            <Text>{comment.body}</Text>
          </View>
        </View>
      ))}
      {task.can?.comment && (
        <View style={{ gap: space.sm }}>
          <TextInput
            accessibilityLabel="New comment"
            value={body}
            onChangeText={setBody}
            placeholder="Write a comment…"
            placeholderTextColor={theme.textMuted}
            multiline
            style={[styles.box, { borderColor: theme.border, backgroundColor: theme.card, color: theme.text, padding: space.md, minHeight: 72, fontSize: 16, textAlignVertical: 'top' }]}
          />
          <Button title="Comment" disabled={!body.trim()} loading={post.isPending} onPress={() => post.mutate()} />
        </View>
      )}
    </View>
  );
}

/** ⋯ menu: watch, email reminder, move to bin. */
function TaskMenu({ task }: { task: Task }) {
  const theme = useTheme();
  const [reminding, setReminding] = React.useState(false);
  const watch = useMutation({ mutationFn: async () => (task.is_watching ? api.delete(`/tasks/${task.id}/watch`) : api.post(`/tasks/${task.id}/watch`)) });
  const remove = useMutation({ mutationFn: async () => api.delete(`/tasks/${task.id}`), onSuccess: () => router.back() });

  const actions: { label: string; run: () => void; destructive?: boolean }[] = [
    { label: task.is_watching ? 'Stop watching' : 'Watch for changes', run: () => watch.mutate() },
    ...(task.can?.remind && task.assignee ? [{ label: 'Email reminder…', run: () => setReminding(true) }] : []),
    ...(task.can?.delete
      ? [
          {
            label: 'Move to bin',
            destructive: true,
            run: () => Alert.alert(`Move ${task.reference} to the bin?`, 'It can be restored from the Bin on the web app.', [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Move to bin', style: 'destructive', onPress: () => remove.mutate() },
            ]),
          },
        ]
      : []),
  ];

  const open = () => {
    if (Platform.OS === 'ios') {
      const destructiveIndex = actions.findIndex((action) => action.destructive);
      ActionSheetIOS.showActionSheetWithOptions(
        { options: [...actions.map((action) => action.label), 'Cancel'], cancelButtonIndex: actions.length, destructiveButtonIndex: destructiveIndex >= 0 ? destructiveIndex : undefined },
        (index) => actions[index]?.run()
      );
    } else {
      Alert.alert(task.reference, undefined, [...actions.map((action) => ({ text: action.label, style: action.destructive ? ('destructive' as const) : ('default' as const), onPress: action.run })), { text: 'Cancel', style: 'cancel' }]);
    }
  };

  return (
    <>
      <Pressable accessibilityRole="button" accessibilityLabel="Task actions" hitSlop={12} onPress={open}>
        <DotsThreeCircleIcon size={26} color={theme.primary} />
      </Pressable>
      {reminding && <ReminderSheet task={task} onClose={() => setReminding(false)} />}
    </>
  );
}

function ReminderSheet({ task, onClose }: { task: Task; onClose: () => void }) {
  const [includeReviewer, setIncludeReviewer] = React.useState(false);
  const send = useMutation({
    mutationFn: async (note: string) => (await api.post<{ message: string }>(`/tasks/${task.id}/email-reminder`, { note: note || null, include_reviewer: includeReviewer })).data,
    onSuccess: (data) => {
      Alert.alert('Reminder sent', data.message);
      onClose();
    },
  });
  return (
    <CommentSheet
      title="Email a reminder"
      description={`Emails ${task.assignee?.name} about ${task.reference} now.`}
      placeholder="Note (optional)"
      optional
      submitLabel="Send email"
      busy={send.isPending}
      onClose={onClose}
      onSubmit={(note) => send.mutate(note)}
      extra={
        task.reviewer && task.reviewer.id !== task.assignee?.id ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <Text style={{ flex: 1 }}>Also email the reviewer ({task.reviewer.name})</Text>
            <Switch value={includeReviewer} onValueChange={setIncludeReviewer} />
          </View>
        ) : undefined
      }
    />
  );
}

/** Bottom sheet with a text box: move comments (send back, reopen) and reminder notes. */
function CommentSheet({
  title,
  description,
  placeholder,
  optional,
  submitLabel,
  busy,
  extra,
  onClose,
  onSubmit,
}: {
  title: string;
  description?: string;
  placeholder: string;
  optional?: boolean;
  submitLabel?: string;
  busy?: boolean;
  extra?: React.ReactNode;
  onClose: () => void;
  onSubmit: (text: string) => void;
}) {
  const theme = useTheme();
  const [text, setText] = React.useState('');
  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={[StyleSheet.absoluteFill, { backgroundColor: theme.overlay }]} onPress={onClose} accessibilityLabel="Close" />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, justifyContent: 'flex-end' }} pointerEvents="box-none">
        <SafeAreaView edges={['bottom']} style={{ backgroundColor: theme.card, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg, padding: space.lg, gap: space.md }}>
          <Text size={17} weight="700">
            {title}
          </Text>
          {description && <Text tone="muted">{description}</Text>}
          <Input multiline autoFocus value={text} onChangeText={setText} placeholder={optional ? placeholder : `${placeholder} (required)`} />
          {extra}
          <View style={{ flexDirection: 'row', gap: space.sm }}>
            <Button title="Cancel" variant="outline" style={{ flex: 1 }} onPress={onClose} />
            <Button title={submitLabel ?? title} style={{ flex: 1 }} loading={busy} disabled={!optional && !text.trim()} onPress={() => onSubmit(text.trim())} />
          </View>
        </SafeAreaView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  box: { borderWidth: StyleSheet.hairlineWidth, borderRadius: radius.lg, overflow: 'hidden' },
  checkRow: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: space.md, paddingHorizontal: space.md },
});
