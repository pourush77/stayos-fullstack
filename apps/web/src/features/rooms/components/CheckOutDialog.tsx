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
      closeOnClickOutside={!loading}
      closeOnEscape={!loading}
      withCloseButton={!loading}
      centered
      size="min(92vw, 460px)"
      title={<Text className={styles.modalTitle}>Check Out Guest</Text>}
    >
      <Stack gap={spacing[4]}>
        <Text className={styles.dialogBody}>
          This completes the guest stay. The room will leave Occupied status and move into the
          post-checkout housekeeping workflow.
        </Text>
        <Text c="#64748b" size="sm">
          Make sure the guest account is settled and departure is confirmed before continuing.
        </Text>

        <Group justify="flex-end" gap={8} wrap="wrap">
          <Button variant="subtle" color="gray" disabled={loading} onClick={onClose}>
            Cancel
          </Button>
          <Button
            color="red"
            loading={loading}
            onClick={onConfirm}
            className={styles.primaryButtonText}
          >
            Confirm checkout
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
