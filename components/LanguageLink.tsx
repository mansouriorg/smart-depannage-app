import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, Text, TouchableOpacity } from 'react-native';

import { LOCALE_NAMES, type Locale } from '@/lib/shared';
import { useI18n } from '../services/i18n';

/**
 * A small link that switches the app to the other language (P3-04): it names that language in its own letters, so that a technician who
 * cannot read the language on screen still finds theirs. Used where there is no settings screen yet, on the login screen.
 */
export function LanguageLink({ color = '#64748b' }: { color?: string }) {
  const { locale, setLocale, t } = useI18n();
  const other: Locale = locale === 'fr' ? 'ar' : 'fr';

  return (
    <TouchableOpacity
      style={styles.link}
      onPress={() => void setLocale(other)}
      accessibilityRole="button"
      accessibilityLabel={t('common.language.switch')}
      hitSlop={8}
    >
      <Ionicons name="language-outline" size={18} color={color} />
      <Text style={[styles.text, { color }]}>{LOCALE_NAMES[other]}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  link: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 12, marginTop: 16 },
  text: { fontSize: 15, fontWeight: '600' },
});
