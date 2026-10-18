import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

// 🧩 Words and colours of a status, shared with the server and the other apps (P1-09)
import { canonicalStatus, statusColor, statusLabel, statusTone, type CanonicalStatus } from '@/lib/shared';

/**
 * The one badge of the app (P1-15): the home list, the missions list and the mission screen all show a status
 * with it. It reads the status whichever spelling the server stored it with (PENDING or CREATED, ACCEPTED or
 * ARTISAN_ACCEPTED), so no screen has a table of statuses of its own.
 */

/** The four looks the app has always had (the gold of "accepted" is the brand's, not a tone). */
const LOOKS: Partial<Record<CanonicalStatus, { color: string; text: string }>> = {
  CREATED: { color: '#f59e0b', text: 'En Attente' },
  ARTISAN_ACCEPTED: { color: '#D4AF37', text: 'Accepté' },
  IN_PROGRESS: { color: '#8b5cf6', text: 'En Cours' },
  COMPLETED: { color: '#10b981', text: 'Terminé' },
};

const hexToRgba = (hex: string, alpha: number) => {
  const value = parseInt(hex.slice(1), 16);

  return `rgba(${(value >> 16) & 255}, ${(value >> 8) & 255}, ${value & 255}, ${alpha})`;
};

/**
 * A status as a small coloured pill. The four statuses above keep their look; any other the server
 * knows (assigned, on the way, arrived, waiting for validation, paid...) gets its French words and the
 * colour of its family from the shared package; one nobody knows is shown as it came, in grey.
 */
export const StatusBadge = ({
  status,
  paddingVertical = 4,
  large = false,
}: {
  status: string | null | undefined;
  paddingVertical?: number;
  /** A bigger pill, for the top of a screen. */
  large?: boolean;
}) => {
  const canonical = canonicalStatus(status);
  const tone = statusTone(status);
  const look = canonical ? LOOKS[canonical] : undefined;

  let bgColor = 'rgba(51, 65, 85, 0.5)';
  let borderColor = '#334155';
  let textColor = '#cbd5e1';
  let text = status ?? '';

  if (look) {
    bgColor = hexToRgba(look.color, 0.15);
    borderColor = look.color;
    textColor = look.color;
    text = look.text;
  } else if (tone) {
    const color = statusColor(tone);

    bgColor = hexToRgba(color, 0.15);
    borderColor = color;
    textColor = color;
    text = statusLabel(status);
  }

  return (
    <View style={[styles.badge, large && styles.badgeLarge, { backgroundColor: bgColor, borderColor, paddingVertical: large ? 8 : paddingVertical }]}>
      <Text style={[styles.text, large && styles.textLarge, { color: textColor }]}>{text}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: 10,
    borderRadius: 8,
    borderWidth: 1,
  },
  badgeLarge: {
    paddingHorizontal: 16,
    borderRadius: 12,
    alignSelf: 'flex-start',
  },
  text: {
    fontSize: 10,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  textLarge: {
    fontSize: 13,
    letterSpacing: 1,
  },
});
