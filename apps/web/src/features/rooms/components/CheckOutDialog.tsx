import { Button, Group, Modal, Stack, Text } from '@mantine/core';
import { spacing } from '@stayos/theme';
import styles from '../RoomsPage.module.css';

export function CheckOutDialog({
  loading,
  onClose,
  onConfirm,
  opened,
}: {
  loading: boolean;
  onClose: () => void;
  onConfirm: () => void;
  opened: boolean;
}) {
  return (
    <Modal
      opened={opened}
      onClose={onClose}
      centered
      size="min(92vw, 460px)"
      title={<Text className={styles.modalTitle}>Check Out Guest</Text>}
    >
      <Stack gap={spacing[4]}>
        <Text className={styles.dialogBody}>
          This will complete the stay and release the room for housekeeping.
        </Text>

        <Group justify="flex-end">
          <Button variant="subtle" color="gray" onClick={onClose}>
            Cancel
          </Button>
          <Button color="red" loading={loading} onClick={onConfirm} className={styles.primaryButtonText}>
            Confirm Check Out
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
