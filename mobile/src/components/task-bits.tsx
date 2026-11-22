import { View, StyleSheet } from 'react-native';
import { CalendarBlankIcon, CaretDoubleUpIcon, CaretDownIcon, CaretUpIcon, ChatCircleIcon, CheckSquareIcon, EqualsIcon, PaperclipIcon } from 'phosphor-react-native';

import { Card, Text } from '@/components/ui';
import { daysFromToday, formatDate, formatShortDate, initials } from '@/lib/format';
import { priorityLabels } from '@/lib/labels';
import { space, useSwatch, useTheme } from '@/lib/theme';
import type { Priority, Status, Task, TaskTag, UserSummary } from '@/lib/types';

export function StatusBadge({ status }: { status?: Pick<Status, 'name' | 'color'> | null }) {
  const swatch = useSwatch(status?.color);
  if (!status) return null;
  return (
    <View style={[styles.pill, { backgroundColor: swatch.background }]}>
      <Text size={12} weight="700" style={{ color: swatch.text }}>
        {status.name}
      </Text>
    </View>
  );
}

export function Dot({ color, size = 8 }: { color?: string | null; size?: number }) {
  const swatch = useSwatch(color);
  return <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: swatch.dot }} />;
}

export function TagChip({ tag }: { tag: TaskTag }) {
  const swatch = useSwatch(tag.color);
  return (
    <View style={[styles.pill, { backgroundColor: swatch.background }]}>
      <Text size={11} weight="600" style={{ color: swatch.text }}>
        {tag.name}
      </Text>
    </View>
  );
}

export function PriorityMark({ priority, showLabel }: { priority: Priority; showLabel?: boolean }) {
  const theme = useTheme();
  const config = {
    urgent: { Icon: CaretDoubleUpIcon, color: theme.danger },
    high: { Icon: CaretUpIcon, color: '#ea580c' },
    medium: { Icon: EqualsIcon, color: '#d97706' },
    low: { Icon: CaretDownIcon, color: '#0284c7' },
  }[priority];
  return (
    <View style={styles.inline} accessibilityLabel={`${priorityLabels[priority]} priority`}>
      <config.Icon size={15} weight="bold" color={config.color} />
      {showLabel && <Text size={14}>{priorityLabels[priority]}</Text>}
    </View>
  );
}

export function DueText({ date, done }: { date: string | null; done?: boolean }) {
  const theme = useTheme();
  if (!date) return null;
  const days = daysFromToday(date);
  const label = days === 0 ? 'Today' : days === 1 ? 'Tomorrow' : days === -1 ? 'Yesterday' : formatShortDate(date);
  const color = done ? theme.textMuted : days < 0 ? theme.danger : days <= 2 ? theme.warning : theme.textMuted;
  return (
    <View style={styles.inline} accessibilityLabel={`Due ${formatDate(date)}`}>
      <CalendarBlankIcon size={14} color={color} />
      <Text size={13} weight={days < 0 && !done ? '700' : '500'} style={{ color }}>
        {label}
      </Text>
    </View>
  );
}

export function Avatar({ user, size = 26 }: { user?: UserSummary | null; size?: number }) {
  const theme = useTheme();
  if (!user) return null;
  return (
    <View accessibilityLabel={user.name} style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: theme.surface, borderWidth: StyleSheet.hairlineWidth, borderColor: theme.border, alignItems: 'center', justifyContent: 'center' }}>
      <Text size={size * 0.4} weight="700" tone="muted">
        {initials(user.name)}
      </Text>
    </View>
  );
}

/** A task in a list: title, reference, due date, counts, assignee. */
export function TaskRow({ task, onPress, showProject }: { task: Task; onPress: () => void; showProject?: boolean }) {
  const theme = useTheme();
  const done = task.status?.type === 'done';
  return (
    <Card onPress={onPress} style={{ gap: space.sm }}>
      <View style={[styles.inline, { alignItems: 'flex-start', justifyContent: 'space-between' }]}>
        <Text weight="600" style={[{ flex: 1 }, done && { color: theme.textMuted, textDecorationLine: 'line-through' }]}>
          {task.title}
        </Text>
        <PriorityMark priority={task.priority} />
      </View>
      {!!task.tags?.length && (
        <View style={[styles.inline, { flexWrap: 'wrap' }]}>
          {task.tags.map((tag) => (
            <TagChip key={tag.id} tag={tag} />
          ))}
        </View>
      )}
      <View style={[styles.inline, { gap: space.md, flexWrap: 'wrap' }]}>
        <Text size={12} tone="muted" style={{ fontVariant: ['tabular-nums'] }}>
          {task.reference}
        </Text>
        {showProject && (
          <View style={styles.inline}>
            <Dot color={task.project.color} />
            <Text size={12} tone="muted" numberOfLines={1}>
              {task.project.name}
            </Text>
          </View>
        )}
        <StatusBadge status={task.status} />
        <DueText date={task.due_date} done={done} />
        {!!task.checklist_total && (
          <View style={styles.inline}>
            <CheckSquareIcon size={14} color={theme.textMuted} />
            <Text size={12} tone="muted">
              {task.checklist_done ?? 0}/{task.checklist_total}
            </Text>
          </View>
        )}
        {!!task.comments_count && (
          <View style={styles.inline}>
            <ChatCircleIcon size={14} color={theme.textMuted} />
            <Text size={12} tone="muted">
              {task.comments_count}
            </Text>
          </View>
        )}
        {!!task.attachments_count && (
          <View style={styles.inline}>
            <PaperclipIcon size={14} color={theme.textMuted} />
            <Text size={12} tone="muted">
              {task.attachments_count}
            </Text>
          </View>
        )}
        <View style={{ marginLeft: 'auto' }}>
          <Avatar user={task.assignee} size={24} />
        </View>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  pill: { borderRadius: 5, paddingHorizontal: 6, paddingVertical: 2, alignSelf: 'flex-start' },
  inline: { flexDirection: 'row', alignItems: 'center', gap: space.xs },
});
