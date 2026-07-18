import { useEffect, useState } from "react";
import { IconMoon, IconSun } from "@tabler/icons-react";

import { Button } from "@/components/ui/button";
import { getTheme, toggleTheme, type Theme } from "@/lib/theme";

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>("light");

  useEffect(() => {
    setTheme(getTheme());
  }, []);

  return (
    <Button
      variant="ghost"
      size="icon"
      aria-label="Toggle theme"
      onClick={() => setTheme(toggleTheme())}
    >
      {theme === "dark" ? <IconSun /> : <IconMoon />}
    </Button>
  );
}
