export const typography = {
  fontFamily: "'Plus Jakarta Sans', Inter, system-ui, sans-serif",
  weights: {
    regular: 400,
    medium: 500,
    semibold: 600,
    bold: 700,
  },
  styles: {
    display: { fontSize: '48px', lineHeight: '56px', fontWeight: 700 },
    h1: { fontSize: '36px', lineHeight: '44px', fontWeight: 700 },
    h2: { fontSize: '28px', lineHeight: '36px', fontWeight: 600 },
    h3: { fontSize: '22px', lineHeight: '30px', fontWeight: 600 },
    bodyLarge: { fontSize: '18px', lineHeight: '28px', fontWeight: 400 },
    body: { fontSize: '15px', lineHeight: '24px', fontWeight: 400 },
    small: { fontSize: '13px', lineHeight: '20px', fontWeight: 400 },
    caption: { fontSize: '12px', lineHeight: '16px', fontWeight: 400 },
    label: { fontSize: '13px', lineHeight: '18px', fontWeight: 600 },
    button: { fontSize: '14px', lineHeight: '20px', fontWeight: 600 },
  },
} as const;
