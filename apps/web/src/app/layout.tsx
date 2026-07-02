import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import '@mantine/core/styles.css';
import '@mantine/dates/styles.css';
import '@mantine/notifications/styles.css';
import { BackendConnectivityProvider, StayOSAppShell, StayOSProvider } from '@stayos/ui';
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
            <StayOSAppShell>{children}</StayOSAppShell>
          </BackendConnectivityProvider>
        </StayOSProvider>
      </body>
    </html>
  );
}
