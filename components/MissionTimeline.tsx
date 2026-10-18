import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { missionTimeline, type MissionMoments } from '@/lib/shared';
import { clockTime, shortDate } from '../services/display';

/**
 * The line of a mission (P1-15): each step the artisan does, with the moment the server recorded it. What is
 * done is green, the step the job waits on is gold, the rest is grey. The steps come from the shared package, so
 * the app and the status table cannot disagree on what a mission is made of.
 */
export function MissionTimeline({ job }: { job: MissionMoments }) {
  const steps = missionTimeline(job);

  return (
    <View>
      {steps.map((step, index) => {
        const color = step.done ? '#10b981' : step.current ? '#D4AF37' : '#475569';
        const last = index === steps.length - 1;

        return (
          <View key={step.key} style={styles.row}>
            <View style={styles.rail}>
              <View style={[styles.dot, { borderColor: color, backgroundColor: step.done ? color : 'transparent' }]}>
                {step.done ? <Ionicons name="checkmark" size={12} color="#0f172a" /> : null}
              </View>
              {!last ? <View style={[styles.line, { backgroundColor: step.done ? '#10b981' : '#334155' }]} /> : null}
            </View>

            <View style={styles.text}>
              <Text style={[styles.label, { color: step.done ? '#e2e8f0' : step.current ? '#D4AF37' : '#64748b' }]}>{step.label}</Text>
              {step.at ? <Text style={styles.time}>{`${shortDate(step.at)} · ${clockTime(step.at)}`}</Text> : null}
            </View>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 12 },
  rail: { alignItems: 'center', width: 20 },
  dot: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  line: { width: 2, flex: 1, minHeight: 16, marginVertical: 2 },
  text: { flex: 1, paddingBottom: 14 },
  label: { fontSize: 15, fontWeight: '600' },
  time: { fontSize: 12, color: '#94a3b8', marginTop: 2 },
});
