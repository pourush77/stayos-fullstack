export type BrandPaletteName = 'green' | 'blue' | 'purple' | 'gold';

export const brandPalettes = {
  green: {
    50: '#eef8f7',
    100: '#d7f2e9',
    200: '#afe4d5',
    300: '#7bd0bc',
    400: '#45b69d',
    500: '#155e63',
    600: '#0f4f53',
    700: '#0f4f53',
    800: '#0d4144',
    900: '#0a3336',
  },
  blue: {
    50: '#eef6ff',
    100: '#d9ebff',
    200: '#b9d9ff',
    300: '#88beff',
    400: '#5297f2',
    500: '#2f78d6',
    600: '#1d5fb5',
    700: '#184c92',
    800: '#183f75',
    900: '#19365f',
  },
  purple: {
    50: '#f6f1ff',
    100: '#ede2ff',
    200: '#dbc8ff',
    300: '#c09fff',
    400: '#9d6df2',
    500: '#7d4dd6',
    600: '#6536b5',
    700: '#512b92',
    800: '#432775',
    900: '#38235f',
  },
  gold: {
    50: '#fff8e8',
    100: '#ffedbf',
    200: '#ffdb83',
    300: '#ffc447',
    400: '#f0a91c',
    500: '#cc8610',
    600: '#a5650c',
    700: '#844d10',
    800: '#6b3f13',
    900: '#583515',
  },
} as const;

export const neutral = {
  0: '#ffffff',
  25: '#fcfcfb',
  50: '#f8f8f6',
  100: '#f0f1ee',
  200: '#e4e6e1',
  300: '#ced3cb',
  400: '#9ca69b',
  500: '#6f7a72',
  600: '#536057',
  700: '#3e4842',
  800: '#2b332f',
  900: '#171d1a',
} as const;

export const semantic = {
  success: '#137d6b',
  warning: '#cc8610',
  danger: '#c2413a',
  info: '#2f78d6',
} as const;

export const createColorTokens = (brand: BrandPaletteName = 'green') => ({
  brand: brandPalettes[brand],
  neutral,
  semantic,
  surface: {
    app: brandPalettes[brand][50],
    base: neutral[0],
    subtle: neutral[50],
    raised: neutral[0],
  },
  text: {
    strong: neutral[900],
    body: neutral[700],
    muted: neutral[500],
    inverse: neutral[0],
  },
  border: {
    subtle: neutral[100],
    default: neutral[200],
    strong: neutral[300],
  },
});

export const colors = createColorTokens();
