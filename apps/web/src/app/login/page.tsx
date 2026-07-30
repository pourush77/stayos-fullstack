'use client';

import Image from 'next/image';
import { useEffect, useState } from 'react';
import {
  Anchor,
  Box,
  Button,
  Checkbox,
  Group,
  PasswordInput,
  Stack,
  Text,
  TextInput,
  Title,
} from '@mantine/core';
import { Eye, EyeOff, LockKeyhole, Mail } from 'lucide-react';
import { useAuth } from '../../features/auth/auth-context';
import styles from './login.module.css';

const demoAccounts = [
  ['Front Desk', 'frontdesk@stayos.local'],
  ['Manager', 'manager@stayos.local'],
  ['Housekeeping', 'housekeeping@stayos.local'],
  ['Maintenance', 'maintenance@stayos.local'],
  ['Accounts', 'accounts@stayos.local'],
];

function AuthDevCard() {
  if (process.env.NODE_ENV === 'production') return null;

  return (
    <Box className={styles.devCard}>
      <Text className={styles.devTitle}>Demo Accounts</Text>
      <Stack gap={8}>
        {demoAccounts.map(([role, email]) => (
          <Group key={email} justify="space-between" gap={12} wrap="nowrap">
            <Text className={styles.devRole}>{role}</Text>
            <Text className={styles.devEmail}>{email}</Text>
          </Group>
        ))}
      </Stack>
      <Group justify="space-between" mt={12}>
        <Text className={styles.devRole}>Password</Text>
        <Text className={styles.devEmail}>Password123!</Text>
      </Group>
    </Box>
  );
}

function validateEmail(value: string) {
  if (!value.trim()) return 'Email is required.';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return 'Enter a valid email address.';
  return undefined;
}

export default function LoginPage() {
  const auth = useAuth();
  const [email, setEmail] = useState('');
  const [rememberDevice, setRememberDevice] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [password, setPassword] = useState('');

  const [errors, setErrors] = useState<{ email?: string; password?: string; form?: string }>({});
  const [submitting, setSubmitting] = useState(false);
  const [forgotOpen, setForgotOpen] = useState(false);

  useEffect(() => {
    setMounted(true);
    setEmail(localStorage.getItem('stayos.rememberedEmail') ?? '');
    setRememberDevice(localStorage.getItem('stayos.rememberDevice') === 'true');
  }, []);

  async function submit() {
    const nextErrors = {
      email: validateEmail(email),
      password: password ? undefined : 'Password is required.',
    };
    setErrors(nextErrors);
    if (nextErrors.email || nextErrors.password) return;

    setSubmitting(true);
    try {
      if (rememberDevice) window.localStorage.setItem('stayos.rememberedEmail', email);
      else window.localStorage.removeItem('stayos.rememberedEmail');
      await auth.login({ email, password, rememberDevice });
    } catch (error) {
      setErrors({
        form: error instanceof Error ? error.message : 'Unable to sign in. Please try again.',
      });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className={styles.page}>
      <section className={styles.panel} aria-label="Sign in">
        <Box className={styles.brandRow}>
          <Box className={styles.logo} aria-hidden>
            <Box className={styles.logoRing} />
          </Box>
          <Box>
            <Text className={styles.product}>StayOS</Text>
            <Text className={styles.subtitle}>Hotel Operating System</Text>
          </Box>
        </Box>

        <Stack gap={28} className={styles.formWrap}>
          <Box>
            <Title order={1} className={styles.heading}>
              Welcome back
            </Title>
            <Text className={styles.supporting}>Sign in to continue to your hotel workspace.</Text>
          </Box>

          <form
            className={styles.form}
            onSubmit={(event) => {
              event.preventDefault();
              void submit();
            }}
          >
            <Stack gap={16}>
              <TextInput
                autoComplete="email"
                error={errors.email}
                label="Email"
                leftSection={<Mail size={16} />}
                onChange={(event) => setEmail(event.currentTarget.value)}
                placeholder="frontdesk@stayos.local"
                value={email}
              />
              <PasswordInput
                autoComplete="current-password"
                error={errors.password}
                label="Password"
                leftSection={<LockKeyhole size={16} />}
                onChange={(event) => setPassword(event.currentTarget.value)}
                placeholder="Enter your password"
                value={password}
                visibilityToggleIcon={({ reveal }) =>
                  reveal ? <EyeOff size={16} /> : <Eye size={16} />
                }
              />
              <Group justify="space-between" align="center">
                <Checkbox
                  checked={mounted ? rememberDevice : false}
                  label="Remember this device"
                  onChange={(event) => {
                    const checked = event.currentTarget.checked;
                    setRememberDevice(checked);
                    localStorage.setItem('stayos.rememberDevice', String(checked));
                  }}
                />
                <Anchor
                  component="button"
                  type="button"
                  size="sm"
                  onClick={() => setForgotOpen(true)}
                  data-testid="forgot-password-link"
                >
                  Forgot Password?
                </Anchor>
              </Group>
              {forgotOpen ? (
                <Text
                  className={styles.comingSoon}
                  data-testid="forgot-password-hint"
                >
                  Please contact your administrator to reset your password.
                </Text>
              ) : null}
              {errors.form ? <Text className={styles.formError}>{errors.form}</Text> : null}
              <Button fullWidth size="md" type="submit" loading={submitting}>
                Sign In
              </Button>
            </Stack>
          </form>

          <AuthDevCard />
        </Stack>
      </section>

      <section className={styles.hero} aria-label="StayOS hospitality workspace">
        <Image
          src="/images/reception-hero.png"
          alt="Elegant hotel reception with warm lighting"
          fill
          priority
          sizes="(max-width: 900px) 100vw, 60vw"
          className={styles.heroImage}
        />
        <Box className={styles.heroOverlay} />
        <Box className={styles.heroCopy}>
          <Text className={styles.heroKicker}>One Platform.</Text>
          <Title order={2} className={styles.heroTitle}>
            Every Stay.
          </Title>
          <Text className={styles.heroText}>
            Manage guests, rooms and operations from a single workspace.
          </Text>
        </Box>
      </section>
    </main>
  );
}
