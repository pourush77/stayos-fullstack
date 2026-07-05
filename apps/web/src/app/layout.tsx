import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import '@mantine/core/styles.css';
import '@mantine/dates/styles.css';
import '@mantine/notifications/styles.css';
import { BackendConnectivityProvider, StayOSProvider } from '@stayos/ui';
import { AppFrame } from '../features/auth/AppFrame';
import { AuthProvider } from '../features/auth/auth-context';
import './globals.css';

export const metadata: Metadata = {
  title: 'StayOS',
  description: 'Simple Hospitality Operating System',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <StayOSProvider brand="purple">
          <BackendConnectivityProvider>
            <AuthProvider>
              <AppFrame>{children}</AppFrame>
            </AuthProvider>
          </BackendConnectivityProvider>
        </StayOSProvider>
      </body>
    </html>
  );
}
