/** @type {import('tailwindcss').Config} */
import tailwindcssAnimate from "tailwindcss-animate";
import typography from "@tailwindcss/typography";

export default {
  darkMode: ["class"],
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  // Tailwind 3.4 не создаёт класс font-display автоматически по ключу display в extend.fontFamily.
  // Принудительно перечисляем кастомные классы, чтобы они попали в сборку.
  safelist: [
    'font-display',
    'bg-alpine-ink',
    'bg-alpine-night',
    'bg-alpine-card',
    'text-alpine-paper',
    'text-alpine-vellum',
    'text-alpine-smoke',
    'text-alpine-ash',
    'text-alpine-ember',
    'text-alpine-gold',
    'text-alpine-sage',
    'text-alpine-line',
    'text-alpine-edge',
    'border-alpine-edge',
    'border-alpine-line',
    'border-alpine-ember',
  ],
  theme: {
    extend: {
      fontFamily: {
        // Антиква для крупных заголовков и pull-quotes
        display: ['"Cormorant Garamond"', "Georgia", "serif"],
        // Гротеск для основного текста и UI
        sans: ['Manrope', "system-ui", "sans-serif"],
        // Моноширинный для kicker-меток, римских цифр, акцентных подписей
        mono: ['"JetBrains Mono"', "ui-monospace", "monospace"],
      },
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive) / <alpha-value>)",
          foreground: "hsl(var(--destructive-foreground) / <alpha-value>)",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        sidebar: {
          DEFAULT: "hsl(var(--sidebar-background))",
          foreground: "hsl(var(--sidebar-foreground))",
          primary: "hsl(var(--sidebar-primary))",
          "primary-foreground": "hsl(var(--sidebar-primary-foreground))",
          accent: "hsl(var(--sidebar-accent))",
          "accent-foreground": "hsl(var(--sidebar-accent-foreground))",
          border: "hsl(var(--sidebar-border))",
          ring: "hsl(var(--sidebar-ring))",
        },
        // Палитра «Полевого журнала Кавказа» — тёплый графит, терракот, шалфей
        alpine: {
          // тёплый графит вместо slate
          ink: "#0F0F0E",
          night: "#171714",
          card: "#1F1D1A",
          edge: "#2C2925",
          line: "#3A362F",
          // тёплый off-white
          paper: "#F2EDE3",
          vellum: "#E8E1D3",
          // приглушённый серый
          smoke: "#8C8678",
          ash: "#6E6A5C",
          // акценты
          ember: "#C97B4B", // терракот
          sage: "#7A8F6C", // шалфей/горная зелень
          gold: "#D4A857", // старая позолота
        },
      },
      borderRadius: {
        xl: "calc(var(--radius) + 4px)",
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
        xs: "calc(var(--radius) - 6px)",
      },
      boxShadow: {
        xs: "0 1px 2px 0 rgb(0 0 0 / 0.05)",
      },
      typography: ({ theme }) => ({
        DEFAULT: {
          css: {
            "--tw-prose-body": theme("colors.alpine.paper"),
            "--tw-prose-headings": theme("colors.alpine.paper"),
            "--tw-prose-lead": theme("colors.alpine.vellum"),
            "--tw-prose-links": theme("colors.alpine.ember"),
            "--tw-prose-bold": theme("colors.alpine.paper"),
            "--tw-prose-counters": theme("colors.alpine.smoke"),
            "--tw-prose-bullets": theme("colors.alpine.line"),
            "--tw-prose-hr": theme("colors.alpine.edge"),
            "--tw-prose-quotes": theme("colors.alpine.vellum"),
            "--tw-prose-quote-borders": theme("colors.alpine.ember"),
            "--tw-prose-captions": theme("colors.alpine.smoke"),
            "--tw-prose-code": theme("colors.alpine.paper"),
            "--tw-prose-pre-code": theme("colors.alpine.vellum"),
            "--tw-prose-pre-bg": theme("colors.alpine.ink"),
            "--tw-prose-th-borders": theme("colors.alpine.edge"),
            "--tw-prose-td-borders": theme("colors.alpine.line"),

            maxWidth: "none",
            fontFamily: theme("fontFamily.sans").join(", "),
            color: theme("colors.alpine.paper"),
            lineHeight: "1.75",
            fontSize: "1.125rem",
            h2: {
              fontFamily: theme("fontFamily.display").join(", "),
              fontWeight: "500",
              fontStyle: "italic",
              letterSpacing: "-0.01em",
              marginTop: "3rem",
              marginBottom: "1.25rem",
              fontSize: "1.875rem",
              lineHeight: "1.2",
              color: theme("colors.alpine.paper"),
              "&::before": {
                content: "counter(prose-h2-counter, decimal-leading-zero) ' — '",
                counterIncrement: "prose-h2-counter",
                fontFamily: theme("fontFamily.mono").join(", "),
                fontStyle: "normal",
                fontWeight: "400",
                color: theme("colors.alpine.smoke"),
                marginRight: "0.5rem",
                fontSize: "0.75rem",
                letterSpacing: "0.15em",
                verticalAlign: "middle",
              },
              "&:first-of-type": {
                counterReset: "prose-h2-counter",
              },
            },
            h3: {
              fontFamily: theme("fontFamily.display").join(", "),
              fontWeight: "600",
              marginTop: "2rem",
              marginBottom: "0.75rem",
              fontSize: "1.4rem",
              color: theme("colors.alpine.vellum"),
            },
            p: {
              marginTop: "0",
              marginBottom: "1.25rem",
            },
            "p:has(+ ul), p:has(+ ol), p:has(+ blockquote)": {
              marginBottom: "0.75rem",
            },
            "ul, ol": {
              marginTop: "0.25rem",
              marginBottom: "1.5rem",
              paddingLeft: "1.25rem",
            },
            li: {
              marginTop: "0.4rem",
              marginBottom: "0.4rem",
            },
            "li::marker": {
              color: theme("colors.alpine.ember"),
            },
            strong: {
              color: theme("colors.alpine.paper"),
              fontWeight: "600",
            },
            em: {
              fontStyle: "italic",
              color: theme("colors.alpine.vellum"),
            },
            a: {
              color: theme("colors.alpine.ember"),
              textDecoration: "none",
              borderBottom: `1px solid ${theme("colors.alpine.ember").replace("0.65", "0.4")}`,
              transition: "border-color 200ms ease, color 200ms ease",
              fontWeight: "500",
              "&:hover": {
                color: theme("colors.alpine.gold"),
                borderBottomColor: theme("colors.alpine.gold"),
              },
            },
            blockquote: {
              fontFamily: theme("fontFamily.display").join(", "),
              fontStyle: "italic",
              fontWeight: "500",
              fontSize: "1.5rem",
              lineHeight: "1.4",
              marginTop: "2rem",
              marginBottom: "2rem",
              paddingLeft: "1.5rem",
              borderLeftWidth: "2px",
              borderLeftColor: theme("colors.alpine.ember"),
              color: theme("colors.alpine.vellum"),
            },
            "blockquote p": {
              margin: "0",
            },
            hr: {
              marginTop: "3rem",
              marginBottom: "3rem",
              borderColor: theme("colors.alpine.edge"),
            },
            "blockquote p::before": { content: "none" },
            "blockquote p::after": { content: "none" },
          },
        },
      }),
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
        "caret-blink": {
          "0%,70%,100%": { opacity: "1" },
          "20%,50%": { opacity: "0" },
        },
        // «Поднимающаяся» буква для заголовков
        "rise-in": {
          from: { opacity: "0", transform: "translateY(0.75rem)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        // Лёгкое появление для блоков
        "fade-up": {
          from: { opacity: "0", transform: "translateY(0.5rem)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        // Растяжение reading-progress
        "progress-grow": {
          from: { transform: "scaleX(0)" },
          to: { transform: "scaleX(var(--progress, 1))" },
        },
        // Фоновое смещение шума
        "grain-shift": {
          "0%, 100%": { transform: "translate(0, 0)" },
          "10%": { transform: "translate(-5%, -10%)" },
          "30%": { transform: "translate(7%, -15%)" },
          "50%": { transform: "translate(12%, 9%)" },
          "70%": { transform: "translate(-8%, 18%)" },
          "90%": { transform: "translate(-5%, 5%)" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        "caret-blink": "caret-blink 1.25s ease-out infinite",
        "rise-in": "rise-in 1s cubic-bezier(0.16, 1, 0.3, 1) both",
        "fade-up": "fade-up 0.8s cubic-bezier(0.16, 1, 0.3, 1) both",
        "grain-shift": "grain-shift 8s steps(10) infinite",
      },
    },
  },
  plugins: [tailwindcssAnimate, typography],
};
