import React, { createContext, useContext } from 'react';
import { colors, typography, spacing, radius, shadows, layout, motion } from './tokens';

export type Theme = {
  colors: typeof colors;
  typography: typeof typography;
  spacing: typeof spacing;
  radius: typeof radius;
  shadows: typeof shadows;
  layout: typeof layout;
  motion: typeof motion;
};

const defaultTheme: Theme = { colors, typography, spacing, radius, shadows, layout, motion };

const ThemeContext = createContext<Theme>(defaultTheme);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  return <ThemeContext.Provider value={defaultTheme}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  return useContext(ThemeContext);
}
