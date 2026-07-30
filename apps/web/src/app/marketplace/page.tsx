'use client';

import { Badge, Box, Card, Group, SimpleGrid, Stack, Text, ThemeIcon, Title } from '@mantine/core';
import { CreditCard, Megaphone, PlugZap, RadioTower } from 'lucide-react';
import { radius, spacing } from '@stayos/theme';

const cardStyle = {
  background: '#ffffff',
  border: '1px solid rgba(226, 232, 240, 0.9)',
  boxShadow: '0 8px 24px rgba(15, 23, 42, 0.035)',
} as const;

const heroStyle = {
  ...cardStyle,
  background: 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)',
} as const;

const tiles = [
  {
    title: 'Channel Managers',
    description: 'Connect OTA inventory, rates, and reservations.',
    icon: <RadioTower size={22} />,
  },
  {
    title: 'Payment Gateways',
    description: 'Add payment providers for deposits and settlements.',
    icon: <CreditCard size={22} />,
  },
  {
    title: 'POS Integrations',
    description: 'Bring restaurant, minibar, and outlet charges into folios.',
    icon: <PlugZap size={22} />,
  },
  {
    title: 'Marketing Tools',
    description: 'Grow repeat visits with campaigns and guest engagement.',
    icon: <Megaphone size={22} />,
  },
];

export default function MarketplacePage() {
  return (
    <Stack gap={spacing[3]} data-testid="marketplace-page">
      <Card radius={radius.lg} p={24} style={heroStyle}>
        <Stack gap={8}>
          <Badge color="stayosBrand" variant="light" radius={radius.full} w="fit-content">
            Coming soon
          </Badge>
          <Title order={1} c="#101828" style={{ fontSize: 30, fontWeight: 750 }}>
            Marketplace coming soon
          </Title>
          <Text c="#64748b" style={{ fontSize: 14, maxWidth: 680 }}>
            Discover integrations, channel managers, and add-ons for your property.
          </Text>
        </Stack>
      </Card>

      <SimpleGrid cols={{ base: 1, sm: 2, lg: 4 }} spacing={spacing[3]}>
        {tiles.map((tile) => (
          <Card key={tile.title} radius={radius.lg} p={20} style={cardStyle}>
            <Group justify="space-between" align="flex-start" wrap="nowrap">
              <Group align="flex-start" gap={12} wrap="nowrap">
                <ThemeIcon color="stayosBrand" variant="light" radius={radius.md} size={44}>
                  {tile.icon}
                </ThemeIcon>
                <Box>
                  <Text c="#101828" fw={800} size="md">
                    {tile.title}
                  </Text>
                  <Text c="#64748b" size="sm" mt={4}>
                    {tile.description}
                  </Text>
                </Box>
              </Group>
            </Group>
            <Badge mt={spacing[4]} color="gray" variant="light" radius={radius.full}>
              Coming soon
            </Badge>
          </Card>
        ))}
      </SimpleGrid>
    </Stack>
  );
}
