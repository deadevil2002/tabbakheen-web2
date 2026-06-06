import { useColorScheme } from "react-native";

import colors from "@/constants/colors";

/**
 * Returns the design tokens for the current color scheme.
 *
 * Returns all color tokens from constants/colors. When a `dark` key
 * is later added to the colors object, this hook will automatically
 * switch palettes based on the device's appearance setting.
 *
 * Falls back to the default palette when no dark key is defined.
 */
export function useColors() {
  const scheme = useColorScheme();
  const defaultPalette = "dark" in colors && "light" in colors
    ? (colors as unknown as Record<string, typeof colors>)
    : null;

  if (defaultPalette && scheme === "dark" && "dark" in defaultPalette) {
    return defaultPalette.dark;
  }

  if (defaultPalette && "light" in defaultPalette) {
    return defaultPalette.light;
  }

  return colors;
}
