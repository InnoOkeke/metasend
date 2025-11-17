export type ColorPalette = {
  background: string;
  cardBackground: string;
  textPrimary: string;
  textSecondary: string;
  inverseText: string;
  primary: string;
  primaryDisabled: string;
  accent: string;
  accentDisabled: string;
  border: string;
  error: string;
  success: string;
  warning: string;
};

export const lightColors: ColorPalette = {
  background: "#F8FAFC",
  cardBackground: "#FFFFFF",
  textPrimary: "#1E293B",
  textSecondary: "#475569",
  inverseText: "#FFFFFF",
  primary: "#3A80F7",
  primaryDisabled: "#A8C2FF",
  accent: "#10B981",
  accentDisabled: "#74E0C4",
  border: "#CBD5F5",
  error: "#DC2626",
  success: "#10B981",
  warning: "#F59E0B",
};

export const darkColors: ColorPalette = {
  background: "#0B1324",
  cardBackground: "#1E293B",
  textPrimary: "#F8FAFC",
  textSecondary: "#94A3B8",
  inverseText: "#FFFFFF",
  primary: "#3A80F7",
  primaryDisabled: "#6AA0F9",
  accent: "#10B981",
  accentDisabled: "#1F8F6E",
  border: "#233044",
  error: "#F87171",
  success: "#10B981",
  warning: "#F59E0B",
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
};

export const typography = {
  title: {
    fontSize: 28,
    fontWeight: "700" as const,
  },
  subtitle: {
    fontSize: 18,
    fontWeight: "500" as const,
  },
  body: {
    fontSize: 16,
    fontWeight: "400" as const,
  },
  caption: {
    fontSize: 14,
    fontWeight: "400" as const,
  },
};
