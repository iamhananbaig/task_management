import * as React from 'react';
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text as RNText,
  TextInput,
  View,
  type PressableProps,
  type StyleProp,
  type TextInputProps,
  type TextProps,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CheckIcon, XIcon } from 'phosphor-react-native';

import { radius, space, useTheme } from '@/lib/theme';

/** Body text in the theme's colours. `tone="muted"` for secondary text. */
export function Text({ style, tone, size = 15, weight, ...props }: TextProps & { tone?: 'muted' | 'danger' | 'primary' | 'warning'; size?: number; weight?: TextStyle['fontWeight'] }) {
  const theme = useTheme();
  const color = tone === 'muted' ? theme.textMuted : tone === 'danger' ? theme.danger : tone === 'primary' ? theme.primary : tone === 'warning' ? theme.warning : theme.text;
  return <RNText style={[{ color, fontSize: size, fontWeight: weight }, style]} {...props} />;
}

export function Heading({ children, style }: { children: React.ReactNode; style?: StyleProp<TextStyle> }) {
  return (
    <Text size={13} weight="600" tone="muted" style={[{ textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: space.sm }, style]}>
      {children}
    </Text>
  );
}

type ButtonProps = Omit<PressableProps, 'children' | 'style'> & {
  title: string;
  variant?: 'primary' | 'outline' | 'ghost' | 'danger';
  loading?: boolean;
  icon?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  small?: boolean;
};

/** Tap target at least 44 pt tall (36 when small). */
export function Button({ title, variant = 'primary', loading, icon, disabled, style, small, ...props }: ButtonProps) {
  const theme = useTheme();
  const background = variant === 'primary' ? theme.primary : variant === 'danger' ? theme.dangerSoft : 'transparent';
  const color = variant === 'primary' ? theme.primaryText : variant === 'danger' ? theme.danger : variant === 'outline' ? theme.text : theme.primary;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!disabled || loading, busy: loading }}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.button,
        small && { minHeight: 36, paddingHorizontal: space.md },
        { backgroundColor: background, borderColor: variant === 'outline' ? theme.border : 'transparent', opacity: disabled ? 0.45 : pressed ? 0.75 : 1 },
        style,
      ]}
      {...props}
    >
      {loading ? <ActivityIndicator color={color} size="small" /> : icon}
      <Text style={{ color }} weight="600" size={small ? 14 : 15}>
        {title}
      </Text>
    </Pressable>
  );
}

export function Input({ label, error, style, ...props }: TextInputProps & { label?: string; error?: string }) {
  const theme = useTheme();
  return (
    <View style={{ gap: space.xs }}>
      {label && (
        <Text size={13} weight="600">
          {label}
        </Text>
      )}
      <TextInput
        placeholderTextColor={theme.textMuted}
        style={[styles.input, { color: theme.text, borderColor: error ? theme.danger : theme.border, backgroundColor: theme.card }, props.multiline && { minHeight: 88, textAlignVertical: 'top', paddingTop: 10 }, style]}
        {...props}
      />
      {error && (
        <Text size={13} tone="danger">
          {error}
        </Text>
      )}
    </View>
  );
}

export function Card({ children, style, onPress }: { children: React.ReactNode; style?: StyleProp<ViewStyle>; onPress?: () => void }) {
  const theme = useTheme();
  const base = [styles.card, { backgroundColor: theme.card, borderColor: theme.border }, style];
  if (!onPress) return <View style={base}>{children}</View>;
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [base, pressed && { opacity: 0.7 }]}>
      {children}
    </Pressable>
  );
}

/** Horizontal filter chip. */
export function Chip({ label, selected, onPress }: { label: string; selected?: boolean; onPress: () => void }) {
  const theme = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={[styles.chip, { borderColor: selected ? theme.primary : theme.border, backgroundColor: selected ? theme.primary : theme.card }]}
    >
      <Text size={13} weight="600" style={{ color: selected ? theme.primaryText : theme.text }}>
        {label}
      </Text>
    </Pressable>
  );
}

export function Segmented<T extends string>({ value, options, onChange }: { value: T; options: { value: T; label: string }[]; onChange: (value: T) => void }) {
  const theme = useTheme();
  return (
    <View style={[styles.segmented, { backgroundColor: theme.surface, borderColor: theme.border }]}>
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <Pressable
            key={option.value}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            onPress={() => onChange(option.value)}
            style={[styles.segment, selected && { backgroundColor: theme.card, borderColor: theme.border, borderWidth: StyleSheet.hairlineWidth }]}
          >
            <Text size={14} weight={selected ? '700' : '500'} tone={selected ? undefined : 'muted'}>
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function Loading() {
  const theme = useTheme();
  return (
    <View style={styles.center}>
      <ActivityIndicator color={theme.textMuted} />
    </View>
  );
}

export function Empty({ title, description, action }: { title: string; description?: string; action?: React.ReactNode }) {
  return (
    <View style={[styles.center, { gap: space.sm }]}>
      <Text weight="600" style={{ textAlign: 'center' }}>
        {title}
      </Text>
      {description && (
        <Text tone="muted" size={14} style={{ textAlign: 'center' }}>
          {description}
        </Text>
      )}
      {action}
    </View>
  );
}

export function ErrorView({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return <Empty title="Couldn't load" description={message} action={onRetry ? <Button title="Try again" variant="outline" onPress={onRetry} /> : undefined} />;
}

export function Screen({ children, style, edges = [] }: { children: React.ReactNode; style?: StyleProp<ViewStyle>; edges?: ('top' | 'bottom')[] }) {
  const theme = useTheme();
  return (
    <SafeAreaView edges={edges} style={[{ flex: 1, backgroundColor: theme.background }, style]}>
      {children}
    </SafeAreaView>
  );
}

export function Divider() {
  const theme = useTheme();
  return <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: theme.border }} />;
}

export type Option = { value: string; label: string; hint?: string };

/** A select: shows the current choice; tapping opens a sheet with the options. */
export function Select({ label, value, options, onChange, placeholder = 'Choose…', disabled }: { label: string; value: string; options: Option[]; onChange: (value: string) => void; placeholder?: string; disabled?: boolean }) {
  const theme = useTheme();
  const [open, setOpen] = React.useState(false);
  const current = options.find((option) => option.value === value);
  return (
    <View style={{ gap: space.xs, flex: 1 }}>
      <Text size={13} weight="600">
        {label}
      </Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${current?.label ?? placeholder}`}
        disabled={disabled}
        onPress={() => setOpen(true)}
        style={[styles.input, { justifyContent: 'center', borderColor: theme.border, backgroundColor: theme.card, opacity: disabled ? 0.6 : 1 }]}
      >
        <Text numberOfLines={1} tone={current ? undefined : 'muted'}>
          {current?.label ?? placeholder}
        </Text>
      </Pressable>
      <OptionSheet visible={open} title={label} options={options} value={value} onClose={() => setOpen(false)} onSelect={(next) => { setOpen(false); onChange(next); }} />
    </View>
  );
}

export function OptionSheet({ visible, title, options, value, onSelect, onClose }: { visible: boolean; title: string; options: Option[]; value?: string; onSelect: (value: string) => void; onClose: () => void }) {
  const theme = useTheme();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={[StyleSheet.absoluteFill, { backgroundColor: theme.overlay }]} onPress={onClose} accessibilityLabel="Close" />
      <SafeAreaView edges={['bottom']} style={[styles.sheet, { backgroundColor: theme.card }]}>
        <View style={styles.sheetHeader}>
          <Text weight="700" size={17}>
            {title}
          </Text>
          <Pressable accessibilityRole="button" accessibilityLabel="Close" onPress={onClose} hitSlop={12}>
            <XIcon color={theme.textMuted} size={22} />
          </Pressable>
        </View>
        <FlatList
          data={options}
          keyExtractor={(option) => option.value || '__none'}
          ItemSeparatorComponent={Divider}
          renderItem={({ item }) => (
            <Pressable accessibilityRole="button" accessibilityState={{ selected: item.value === value }} onPress={() => onSelect(item.value)} style={({ pressed }) => [styles.option, pressed && { backgroundColor: theme.surface }]}>
              <View style={{ flex: 1 }}>
                <Text>{item.label}</Text>
                {item.hint && (
                  <Text size={13} tone="muted">
                    {item.hint}
                  </Text>
                )}
              </View>
              {item.value === value && <CheckIcon color={theme.primary} size={20} weight="bold" />}
            </Pressable>
          )}
        />
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  button: { minHeight: 44, borderRadius: radius.md, borderWidth: 1, paddingHorizontal: space.lg, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space.sm },
  input: { minHeight: 44, borderWidth: 1, borderRadius: radius.md, paddingHorizontal: space.md, fontSize: 16 },
  card: { borderWidth: StyleSheet.hairlineWidth, borderRadius: radius.lg, padding: space.md },
  chip: { minHeight: 36, borderRadius: 18, borderWidth: 1, paddingHorizontal: space.md, alignItems: 'center', justifyContent: 'center' },
  segmented: { flexDirection: 'row', borderRadius: radius.md, borderWidth: StyleSheet.hairlineWidth, padding: 3 },
  segment: { flex: 1, minHeight: 36, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: space.xl },
  sheet: { position: 'absolute', left: 0, right: 0, bottom: 0, maxHeight: '75%', borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg },
  sheetHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: space.lg },
  option: { minHeight: 52, paddingHorizontal: space.lg, paddingVertical: space.sm, flexDirection: 'row', alignItems: 'center', gap: space.md },
});
