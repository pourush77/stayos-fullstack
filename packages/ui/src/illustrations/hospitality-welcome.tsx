import { colors, radius } from '@stayos/theme';

export function HandWaveIcon() {
  return (
    <svg
      aria-hidden="true"
      width="30"
      height="30"
      viewBox="0 0 30 30"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M10.8 14.4L8.9 10.3C8.5 9.4 8.8 8.4 9.7 8C10.5 7.6 11.5 7.9 11.9 8.8L14 13.3L12.2 6.7C11.9 5.8 12.5 4.9 13.4 4.7C14.3 4.5 15.2 5 15.5 5.9L17.2 12.5L17.3 7.6C17.3 6.6 18.1 5.9 19 5.9C19.9 5.9 20.6 6.7 20.6 7.6L20.5 13.2L21.8 10.8C22.2 10 23.2 9.7 24 10.1C24.8 10.5 25.1 11.5 24.7 12.3L21.7 18.2C20.1 21.4 16.2 22.7 13 21.1C11.8 20.5 10.8 19.5 10.2 18.3L8.7 15.5C8.3 14.7 8.6 13.7 9.4 13.3C10 13 10.6 13.1 10.8 14.4Z"
        fill={colors.brand[100]}
        stroke={colors.brand[500]}
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path
        d="M4.8 8.2C3.8 6.7 3.9 5.1 5.2 3.8M7 6.6C6.8 5.2 7.2 4 8.3 3"
        stroke={colors.brand[500]}
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function MorningSunIcon() {
  return (
    <svg
      aria-hidden="true"
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <circle cx="8" cy="8" r="3.2" fill={colors.brand[100]} stroke={colors.brand[500]} />
      <path
        d="M8 1.5V3M8 13V14.5M1.5 8H3M13 8H14.5M3.4 3.4L4.5 4.5M11.5 11.5L12.6 12.6M12.6 3.4L11.5 4.5M4.5 11.5L3.4 12.6"
        stroke={colors.brand[500]}
        strokeWidth="1.2"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function HospitalityWelcomeIllustration() {
  return (
    <svg
      aria-hidden="true"
      width="720"
      height="220"
      viewBox="0 0 720 220"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      preserveAspectRatio="xMaxYMid meet"
    >
      <rect width="720" height="220" rx={radius.lg} fill={colors.neutral[0]} />
      <path
        d="M70 220C118 132 171 80 236 64C325 42 379 90 440 58C502 26 589 37 688 86V220H70Z"
        fill={colors.brand[50]}
      />
      <path d="M407 82H662V190H407V82Z" fill={colors.neutral[0]} opacity="0.78" />
      <path
        d="M440 98C440 89.2 447.2 82 456 82H613C621.8 82 629 89.2 629 98V190H440V98Z"
        fill={colors.neutral[25]}
        stroke={colors.border.default}
      />
      <path
        d="M382 150H667C677 150 685 158 685 168V190H364V168C364 158 372 150 382 150Z"
        fill={colors.brand[100]}
        opacity="0.68"
      />
      <path
        d="M400 164H648"
        stroke={colors.brand[500]}
        strokeWidth="2"
        strokeLinecap="round"
        opacity="0.7"
      />
      <path
        d="M464 150V122C464 116.5 468.5 112 474 112H552C557.5 112 562 116.5 562 122V150"
        stroke={colors.brand[500]}
        strokeWidth="2"
        opacity="0.7"
      />
      <path d="M481 150V132H545V150" stroke={colors.neutral[400]} strokeWidth="2" opacity="0.7" />
      <circle cx="513" cy="103" r="5" fill={colors.brand[500]} opacity="0.7" />
      <path
        d="M232 148C232 119 249 98 272 98C295 98 312 119 312 148V190H232V148Z"
        fill={colors.neutral[25]}
        stroke={colors.border.default}
      />
      <path d="M272 98V190" stroke={colors.border.default} />
      <path d="M244 136H300" stroke={colors.brand[200]} strokeWidth="2" strokeLinecap="round" />
      <path
        d="M124 190C129 152 143 132 166 124C176 154 171 176 151 190H124Z"
        fill={colors.brand[100]}
        opacity="0.72"
      />
      <path d="M147 190V132" stroke={colors.brand[500]} strokeWidth="2" opacity="0.45" />
      <path
        d="M166 190C169 160 182 143 205 138C210 164 202 181 181 190H166Z"
        fill={colors.brand[100]}
        opacity="0.58"
      />
      <path d="M184 190V144" stroke={colors.brand[500]} strokeWidth="2" opacity="0.4" />
      <path
        d="M606 147C606 126 616 111 631 111C646 111 656 126 656 147V190H606V147Z"
        fill={colors.brand[100]}
        opacity="0.55"
      />
      <path d="M631 111V190" stroke={colors.brand[500]} strokeWidth="2" opacity="0.36" />
      <path d="M347 100H372L366 150H353L347 100Z" fill={colors.brand[100]} opacity="0.74" />
      <circle cx="359.5" cy="82" r="17" fill={colors.brand[100]} opacity="0.74" />
      <path d="M360 98V150" stroke={colors.brand[500]} strokeWidth="2" opacity="0.42" />
      <path d="M108 190H686" stroke={colors.neutral[300]} strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}
