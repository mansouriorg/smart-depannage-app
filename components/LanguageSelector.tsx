import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { LOCALES, LOCALE_NAMES } from '@/lib/shared';
import { useI18n } from '../services/i18n';

/**
 * The choice of the language, on the profile screen (P3-04): each language written in its own letters, the current one checked.
 * The choice applies at once to every screen; the system bars (tab bar, headers) follow after the app is closed and reopened,
 * which the provider says when the direction changes.
 */
export function LanguageSelector() {
  const { locale, setLocale, t } = useI18n();

  return (
    <View style={styles.container}>
      <Text style={styles.heading}>{t('common.language.label')}</Text>

      {LOCALES.map((code, index) => {
        const selected = code === locale;

        return (
          <TouchableOpacity
            key={code}
            style={[styles.item, index === LOCALES.length - 1 && styles.itemLast]}
            onPress={() => void setLocale(code)}
            accessibilityRole="radio"
            accessibilityState={{ selected }}
          >
            <Text style={[styles.name, selected && styles.nameOn]}>{LOCALE_NAMES[code]}</Text>
            {selected ? <Ionicons name="checkmark-circle" size={22} color="#D4AF37" /> : null}
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: 24,
    backgroundColor: '#ffffff',
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#f5f5f4',
  },
  heading: {
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 6,
    fontSize: 13,
    fontWeight: '700',
    color: '#78716c',
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f5f5f4',
  },
  itemLast: {
    borderBottomWidth: 0,
  },
  name: {
    fontSize: 16,
    fontWeight: '500',
    color: '#1c1917',
  },
  nameOn: {
    fontWeight: '700',
  },
});
