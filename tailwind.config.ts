import type { Config } from "tailwindcss";

type OpacityColorOptions = {
  opacityValue?: string;
};

function cssVariableColor(variable: string) {
  return ({ opacityValue }: OpacityColorOptions) => {
    if (opacityValue === undefined) return `var(${variable})`;
    const opacity = Number.parseFloat(opacityValue);
    if (!Number.isFinite(opacity)) return `var(${variable})`;
    return `color-mix(in srgb, var(${variable}) ${opacity * 100}%, transparent)`;
  };
}

export default {
  darkMode: ["class"],
  content: ["./client/index.html", "./client/src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-rubik)", "Inter", "-apple-system", "BlinkMacSystemFont", "Segoe UI", "Roboto", "sans-serif"],
      },
      screens: {
        '4xl': 'var(--breakpoint-4xl)',
        'xxl': 'var(--breakpoint-xxl)'
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
        control: "var(--radius-control)",
        surface: "var(--radius-surface)",
        dialog: "var(--radius-dialog)",
      },
      boxShadow: {
        xs: "var(--shadow-xs)",
        surface: "var(--shadow-sm)",
        overlay: "var(--shadow-md)",
      },
      colors: {
        background: cssVariableColor("--background"),
        foreground: cssVariableColor("--foreground"),
        card: {
          DEFAULT: cssVariableColor("--card"),
          foreground: cssVariableColor("--card-foreground"),
        },
        popover: {
          DEFAULT: cssVariableColor("--popover"),
          foreground: cssVariableColor("--popover-foreground"),
        },
        primary: {
          DEFAULT: cssVariableColor("--primary"),
          foreground: cssVariableColor("--primary-foreground"),
        },
        secondary: {
          DEFAULT: cssVariableColor("--secondary"),
          foreground: cssVariableColor("--secondary-foreground"),
        },
        muted: {
          DEFAULT: cssVariableColor("--muted"),
          foreground: cssVariableColor("--muted-foreground"),
        },
        accent: {
          DEFAULT: cssVariableColor("--accent"),
          foreground: cssVariableColor("--accent-foreground"),
        },
        destructive: {
          DEFAULT: cssVariableColor("--destructive"),
          foreground: cssVariableColor("--destructive-foreground"),
        },
        border: "hsl(var(--app-border) / <alpha-value>)",
        input: "hsl(var(--input) / <alpha-value>)",
        ring: cssVariableColor("--ring"),
        surface: {
          base: cssVariableColor("--surface-base"),
          raised: cssVariableColor("--surface-raised"),
          overlay: cssVariableColor("--surface-overlay"),
          subtle: cssVariableColor("--surface-subtle"),
        },
        success: {
          DEFAULT: cssVariableColor("--success"),
          muted: cssVariableColor("--success-muted"),
        },
        warning: {
          DEFAULT: cssVariableColor("--warning"),
          muted: cssVariableColor("--warning-muted"),
        },
        error: {
          DEFAULT: cssVariableColor("--error"),
          muted: cssVariableColor("--error-muted"),
        },
        info: {
          DEFAULT: cssVariableColor("--info"),
          muted: cssVariableColor("--info-muted"),
        },
        chart: {
          "1": cssVariableColor("--chart-1"),
          "2": cssVariableColor("--chart-2"),
          "3": cssVariableColor("--chart-3"),
          "4": cssVariableColor("--chart-4"),
          "5": cssVariableColor("--chart-5"),
        },
        sidebar: {
          DEFAULT: cssVariableColor("--sidebar-background"),
          foreground: cssVariableColor("--sidebar-foreground"),
          primary: cssVariableColor("--sidebar-primary"),
          "primary-foreground": cssVariableColor("--sidebar-primary-foreground"),
          accent: cssVariableColor("--sidebar-accent"),
          "accent-foreground": cssVariableColor("--sidebar-accent-foreground"),
          border: cssVariableColor("--sidebar-border"),
          ring: cssVariableColor("--sidebar-ring"),
        },
      },
      keyframes: {
        "accordion-down": {
          from: {
            height: "0",
          },
          to: {
            height: "var(--radix-accordion-content-height)",
          },
        },
        "accordion-up": {
          from: {
            height: "var(--radix-accordion-content-height)",
          },
          to: {
            height: "0",
          },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
      },
    },
  },
  plugins: [require("tailwindcss-animate"), require("@tailwindcss/typography"), require("daisyui")],
} satisfies Config;
