import { Paper, Text } from '@mantine/core';
import type { ReactNode } from 'react';
import { radius } from '@stayos/theme';
import styles from '../RoomsPage.module.css';

export function DetailTile({ label, value }: { label: string; value: ReactNode }) {
  return (
    <Paper radius={radius.md} p={12} className={styles.detailTile}>
      <Text className={styles.detailTileLabel}>{label}</Text>
      <Text mt={3} className={styles.detailTileValue}>
        {value}
      </Text>
    </Paper>
  );
}
