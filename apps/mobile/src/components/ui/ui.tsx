import React from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TextInputProps,
  View,
  ViewStyle,
} from 'react-native';
import Minus from 'lucide-react-native/icons/minus';
import Plus from 'lucide-react-native/icons/plus';

import { palette, RADIUS, SPACING, typo } from '../../theme';

export function Card({ children, style }: { children: React.ReactNode; style?: ViewStyle | ViewStyle[] }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

type ButtonVariant = 'primary' | 'accent' | 'secondary';

export function Button({
  title,
  onPress,
  variant = 'primary',
  disabled,
  style,
}: {
  title: string;
  onPress: () => void;
  variant?: ButtonVariant;
  disabled?: boolean;
  style?: ViewStyle | ViewStyle[];
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.btn,
        variant === 'primary' && styles.btnPrimary,
        variant === 'accent' && styles.btnAccent,
        variant === 'secondary' && styles.btnSecondary,
        (pressed || disabled) && { opacity: disabled ? 0.5 : 0.85 },
        style,
      ]}
    >
      <Text style={[
        styles.btnText,
        variant === 'primary' && { color: palette.surface },
        variant === 'accent' && { color: palette.text },
        variant === 'secondary' && { color: palette.text },
      ]}>
        {title}
      </Text>
    </Pressable>
  );
}

export function Field({ label, ...rest }: TextInputProps & { label?: string }) {
  return (
    <View style={styles.field}>
      {label ? <Text style={[typo.microLabel, { marginBottom: SPACING.xs }]}>{label}</Text> : null}
      <TextInput
        placeholderTextColor={palette.border}
        style={styles.input}
        {...rest}
      />
    </View>
  );
}

export function Stepper({
  value,
  onChange,
  min = 1,
  max = 9999,
}: {
  value: number;
  onChange: (next: number) => void;
  min?: number;
  max?: number;
}) {
  const clamp = (n: number) => Math.max(min, Math.min(max, n));
  return (
    <View style={styles.stepper}>
      <Pressable style={styles.stepBtn} onPress={() => onChange(clamp(value - 1))}>
        <Minus size={20} color={palette.primary} />
      </Pressable>
      <Text style={[typo.kpi, { marginHorizontal: SPACING.lg, minWidth: 48, textAlign: 'center', fontSize: 24 }]}>
        {value}
      </Text>
      <Pressable style={styles.stepBtn} onPress={() => onChange(clamp(value + 1))}>
        <Plus size={20} color={palette.primary} />
      </Pressable>
    </View>
  );
}

export function Segmented<T extends string>({
  options,
  value,
  onChange,
}: {
  options: readonly { value: T; label: string }[];
  value: T;
  onChange: (next: T) => void;
}) {
  return (
    <View style={styles.segmented}>
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <Pressable
            key={opt.value}
            onPress={() => onChange(opt.value)}
            style={[styles.segItem, active && styles.segItemActive]}
          >
            <Text style={[typo.body, { fontSize: 14, fontWeight: '500' }, active && { color: palette.surface }]}>
              {opt.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

// Badge de statut (DESIGN_SYSTEM §4 : texte + couleur, jamais couleur seule).
export function Badge({ label, tone }: { label: string; tone: 'primary' | 'warning' | 'danger' | 'success' }) {
  const bg = { primary: '#E4E9F8', warning: '#FCEBC8', danger: '#FBE2E2', success: '#DDF2E4' }[tone];
  const fg = { primary: palette.primary, warning: palette.warning, danger: palette.danger, success: palette.success }[tone];
  return (
    <View style={[styles.badge, { backgroundColor: bg }]}>
      <Text style={[styles.badgeText, { color: fg }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: palette.surface,
    borderRadius: RADIUS.card,
    borderWidth: 1,
    borderColor: palette.border,
    padding: SPACING.lg,
    marginBottom: SPACING.md,
  },
  btn: {
    borderRadius: RADIUS.field,
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnPrimary: { backgroundColor: palette.background },
  btnAccent: { backgroundColor: palette.accent },
  btnSecondary: { backgroundColor: palette.surface, borderWidth: 1, borderColor: palette.border },
  btnText: { fontFamily: typo.body.fontFamily, fontSize: 16, fontWeight: '700' },
  field: { marginBottom: SPACING.md },
  input: {
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: RADIUS.field,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.md,
    fontSize: 16,
    color: palette.text,
    backgroundColor: palette.surface,
    fontFamily: typo.body.fontFamily,
  },
  stepper: { flexDirection: 'row', alignItems: 'center' },
  stepBtn: {
    width: 44,
    height: 44,
    borderRadius: RADIUS.field,
    borderWidth: 1,
    borderColor: palette.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: palette.surface,
  },
  segmented: {
    flexDirection: 'row',
    borderRadius: RADIUS.field,
    borderWidth: 1,
    borderColor: palette.border,
    overflow: 'hidden',
    backgroundColor: palette.surface,
  },
  segItem: {
    flex: 1,
    paddingVertical: SPACING.md,
    alignItems: 'center',
  },
  segItemActive: { backgroundColor: palette.background },
  badge: { borderRadius: RADIUS.field, paddingHorizontal: SPACING.sm, paddingVertical: 4, alignSelf: 'flex-start' },
  badgeText: { fontFamily: typo.microLabel.fontFamily, fontSize: 11, fontWeight: '600', letterSpacing: 0.5 },
});