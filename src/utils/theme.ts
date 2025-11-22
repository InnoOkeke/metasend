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
  background: "#F5F7FA",          // Soft Grey
  cardBackground: "#FFFFFF",
  textPrimary: "#003366",         // Deep Navy
  textSecondary: "#5A6B7C",       // Greyish Navy
  inverseText: "#FFFFFF",
  primary: "#00C2FF",             // Aqua
  primaryDisabled: "#80E0FF",
  accent: "#003366",              // Deep Navy
  accentDisabled: "#4D7099",
  border: "#E1E8ED",              // Light Grey
  error: "#EF4444",
  success: "#00C2FF",
  warning: "#F59E0B",
};

export const darkColors: ColorPalette = {
  background: "#003366",          // Deep Navy
  cardBackground: "#004080",      // Lighter Navy for cards
  textPrimary: "#FFFFFF",         // White
  textSecondary: "#B0C4DE",       // Light Steel Blue
  inverseText: "#003366",
  primary: "#00C2FF",             // Aqua
  primaryDisabled: "#008FBD",
  accent: "#FFFFFF",              // White
  accentDisabled: "#CCCCCC",
  border: "#004080",              // Lighter Navy
  error: "#F87171",
  success: "#34D399",
  warning: "#FBBF24",
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
