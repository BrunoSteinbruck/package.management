// Tema PROVISÓRIO — será substituído pelos tokens do design system
// (claude.ai/design) quando a identidade visual for definida.
export const theme = {
  colors: {
    bg: "#F6F7F9",
    surface: "#FFFFFF",
    text: "#17181C",
    textSecondary: "#5C6270",
    textMuted: "#9AA0AC",
    border: "#E3E6EB",
    accent: "#185FA5",
    accentBg: "#E6F1FB",
    success: "#0F6E56",
    successBg: "#E1F5EE",
    danger: "#A32D2D",
    dangerBg: "#FCEBEB",
    warning: "#854F0B",
    warningBg: "#FAEEDA",
    fill: "#17181C",
    onFill: "#FFFFFF",
  },
  spacing: { xs: 4, sm: 8, md: 16, lg: 24, xl: 32 },
  radius: { sm: 8, md: 12, lg: 16, pill: 999 },
  font: { sm: 13, md: 16, lg: 20, xl: 28 },
  touch: { min: 48 },
} as const;
