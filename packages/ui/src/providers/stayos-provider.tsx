'use client';

import { MantineProvider, createTheme } from '@mantine/core';
import { Notifications } from '@mantine/notifications';
import type { BrandPaletteName } from '@stayos/theme';
import {
  brandPalettes,
  createColorTokens,
  radius,
  shadows,
  typography,
  zIndex,
} from '@stayos/theme';
import type { ReactNode } from 'react';

type StayOSProviderProps = {
  children: ReactNode;
  brand?: BrandPaletteName;
};

const toMantineColorTuple = (brand: BrandPaletteName) =>
  Object.values(brandPalettes[brand]) as [
    string,
    string,
    string,
    string,
    string,
    string,
    string,
    string,
    string,
    string,
  ];

export function StayOSProvider({ children, brand = 'green' }: StayOSProviderProps) {
  const colorTokens = createColorTokens(brand);

  // Keep brand choice centralized so future white-label themes do not touch components.
  const theme = createTheme({
    primaryColor: 'stayosBrand',
    primaryShade: 5,
    colors: {
      stayosBrand: toMantineColorTuple(brand),
    },
    fontFamily: typography.fontFamily,
    headings: {
      fontFamily: typography.fontFamily,
      fontWeight: String(typography.weights.semibold),
    },
    defaultRadius: radius.md,
    shadows,
    breakpoints: {
      xs: '36em',
      sm: '48em',
      md: '62em',
      lg: '75em',
      xl: '88em',
    },
    components: {
      Button: {
        defaultProps: {
          radius: radius.md,
        },
      },
      Card: {
        defaultProps: {
          radius: radius.md,
          withBorder: true,
        },
      },
      TextInput: {
        defaultProps: {
          radius: radius.md,
        },
      },
      Select: {
        defaultProps: {
          radius: radius.md,
        },
      },
    },
  });

  return (
    <MantineProvider
      defaultColorScheme="light"
      theme={theme}
      cssVariablesSelector=":root"
      forceColorScheme="light"
    >
      <div
        style={{
          minHeight: '100vh',
          background: colorTokens.surface.app,
          color: colorTokens.text.strong,
        }}
      >
        {children}
      </div>
      <Notifications position="top-right" zIndex={zIndex.toast} />
    </MantineProvider>
  );
}
