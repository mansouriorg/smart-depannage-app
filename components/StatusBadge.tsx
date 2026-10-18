import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

// 🧩 Words and colours of a status, shared with the server and the other apps (P1-09)
import { statusColor, statusLabel, statusTone } from '@/lib/shared';

/**
 * The server writes the same status two ways (PENDING / CREATED, ACCEPTED / ARTISAN_ACCEPTED). The
 * screens speak the first spelling of each: this gives it for either, so a badge, a filter and a
 * button agree on what a mission is.
 */
export function displayStatus(raw: string | null | undefined): string {
  if (raw === 'CREATED') return 'PENDING';
  if (raw === 'ARTISAN_ACCEPTED') return 'ACCEPTED';

  return raw ?? '';
}

/** The four looks the app has always had (the gold of "accepted" is the brand's, not a tone). */
const LOOKS: Record<string, { color: string; text: string }> = {
  PENDING: { color: '#f59e0b', text: 'En Attente' },
  ACCEPTED: { color: '#D4AF37', text: 'Accepté' },
  IN_PROGRESS: { color: '#8b5cf6', text: 'En Cours' },
  COMPLETED: { color: '#10b981', text: 'Terminé' },
};

const hexToRgba = (hex: string, alpha: number) => {
  const value = parseInt(hex.slice(1), 16);

  return `rgba(${(value >> 16) & 255}, ${(value >> 8) & 255}, ${value & 255}, ${alpha})`;
};

/**
 * A status as a small coloured pill. The four statuses above keep their look; any other the server
 * knows (on the way, arrived, waiting for validation, paid...) gets its French words and the colour
 * of its family from the shared package; one nobody knows is shown as it came, in grey.
 */
export const StatusBadge = ({ status, paddingVertical = 4 }: { status: string; paddingVertical?: number }) => {
  const shown = displayStatus(status);
  const tone = statusTone(shown);
  const look = LOOKS[shown];

  let bgColor = 'rgba(51, 65, 85, 0.5)';
  let borderColor = '#334155';
  let textColor = '#cbd5e1';
  let text = shown;

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
    text = statusLabel(shown);
  }

  return (
    <View style={[styles.badge, { backgroundColor: bgColor, borderColor, paddingVertical }]}>
      <Text style={[styles.text, { color: textColor }]}>{text}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: 10,
    borderRadius: 8,
    borderWidth: 1,
  },
  text: {
    fontSize: 10,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
});
