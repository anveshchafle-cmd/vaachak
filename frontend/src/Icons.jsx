// Hand-tuned line icons (thick strokes read well for low vision). Decorative: the text label carries meaning.
const P = {
  camera: <><path d="M4 8h3l2-3h6l2 3h3a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z" /><circle cx="12" cy="13.5" r="3.6" /></>,
  file: <><path d="M6 3h8l5 5v13H6z" /><path d="M14 3v5h5M9 13h7M9 17h5" /></>,
  chat: <><path d="M4 5h16v11H10l-5 4v-4H4z" /><path d="M8 9.5h8M8 12.5h5" /></>,
  speaker: <><path d="M4 9.5h4l5-4v13l-5-4H4z" /><path d="M16.5 9a4 4 0 0 1 0 6M19 6.5a7.5 7.5 0 0 1 0 11" /></>,
  pay: <><rect x="3" y="6" width="18" height="12" rx="2" /><path d="M9 9.5h6M9 12h6M9 9.5c3 0 3 5 0 5l4 2.5" /></>,
  family: <><circle cx="8" cy="7.5" r="2.6" /><circle cx="16.5" cy="8.5" r="2.2" /><path d="M3.5 19c.5-4 2.3-6 4.5-6s4 2 4.5 6M13 19c.4-3 1.6-5 3.5-5s3.2 2 3.5 5" /></>,
  alarm: <><circle cx="12" cy="13" r="7" /><path d="M12 9v4l2.5 2M4.5 5.5 7 3.5M19.5 5.5 17 3.5" /></>,
  mic: <><rect x="9" y="3" width="6" height="11" rx="3" /><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21" /></>,
  back: <path d="M15 5l-7 7 7 7" />,
  gear: <><circle cx="12" cy="12" r="3" /><path d="M12 3v2.5M12 18.5V21M3 12h2.5M18.5 12H21M5.6 5.6l1.8 1.8M16.6 16.6l1.8 1.8M5.6 18.4l1.8-1.8M16.6 7.4l1.8-1.8" /></>,
  eye: <><path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z" /><circle cx="12" cy="12" r="2.8" /></>,
  bolt: <path d="M13 3 5 13.5h6L10 21l8-10.5h-6z" />,
  pill: <><rect x="3" y="8" width="18" height="8" rx="4" transform="rotate(-35 12 12)" /><path d="m9.2 8 5.6 8" /></>,
  alert: <><path d="M12 3.5 21 19H3z" /><path d="M12 10v4.5M12 17v.3" /></>,
  note: <><path d="M5 3h14v18H5z" /><path d="M8.5 7.5h3.5M8.5 11h7M8.5 14.5h7M8.5 18h4" /></>,
  sun: <><circle cx="12" cy="12" r="4" /><path d="M12 2.5v2.5M12 19v2.5M2.5 12H5M19 12h2.5M5.3 5.3l1.8 1.8M16.9 16.9l1.8 1.8M5.3 18.7l1.8-1.8M16.9 7.1l1.8-1.8" /></>,
  noon: <><circle cx="9" cy="9" r="3.2" /><path d="M9 3v1.5M3 9h1.5M4.8 4.8l1 1M13.2 4.8l-1 1" /><path d="M8 19h9.5a3.5 3.5 0 0 0 0-7 5 5 0 0 0-9.5 1.5A2.8 2.8 0 0 0 8 19z" /></>,
  moon: <path d="M19 15.5A8 8 0 0 1 8.5 5a8 8 0 1 0 10.5 10.5z" />,
  plate: <><circle cx="12" cy="13" r="6" /><circle cx="12" cy="13" r="2.8" /><path d="M3 5v5M4.5 5v15M6 5v5M20 5c-1.5 1-2 3-2 6h2v9" /></>,
  phone: <path d="M5 4h3.5l1.5 4.5-2.2 1.4a11 11 0 0 0 6.3 6.3l1.4-2.2L20 15.5V19a1.5 1.5 0 0 1-1.6 1.5A16.5 16.5 0 0 1 3.5 5.6 1.5 1.5 0 0 1 5 4z" />,
  help: <><circle cx="12" cy="12" r="9" /><path d="M9.5 9.5a2.6 2.6 0 0 1 5 .9c0 1.8-2.5 2.2-2.5 4M12 17.3v.2" /></>,
  shield: <><path d="M12 3 4.5 6v5.5c0 4.5 3.2 8 7.5 9.5 4.3-1.5 7.5-5 7.5-9.5V6z" /><path d="m8.8 12 2.2 2.2 4.4-4.4" /></>,
  paste: <><rect x="6" y="4" width="12" height="17" rx="1.5" /><path d="M9 4V2.8h6V4M9 10h6M9 13.5h6M9 17h3" /></>,
};

export default function Icon({ name, size = 32, className = '', stroke = 2.4 }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={stroke}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      {P[name]}
    </svg>
  );
}
