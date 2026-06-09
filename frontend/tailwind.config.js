/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        cream: {
          50: '#FFFFFF',
          100: '#FDFDFD',
          200: '#FFF2F8',
        },
        college: {
          fuchsia: '#FF007F',
          coral: '#FF6F61',
          teal: '#00CED1',
          orange: '#FF4500',
          black: '#0A0A0C',

          // Legacy aliases, intentionally remapped to the new palette.
          amber: '#FF007F',
          crimson: '#FF007F',
          gold: '#00CED1',
          maroon: '#FF6F61',
          purple: '#0A0A0C',
          navy: '#0A0A0C',
          dark: '#0A0A0C',
          red: '#FF4500',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        display: ['Inter', 'system-ui', 'sans-serif'],
      },
      backgroundImage: {
        'grad-primary': 'linear-gradient(135deg, #FF007F 0%, #FF6F61 100%)',
        'grad-gold': 'linear-gradient(135deg, #00CED1 0%, #FF6F61 100%)',
        'grad-dark': 'linear-gradient(135deg, #0A0A0C 0%, #FF007F 100%)',
        'grad-card-border': 'linear-gradient(90deg, #FF007F, #00CED1, #FF4500)',
      },
      boxShadow: {
        'glow-orange': '0 6px 22px rgba(255,69,0,0.28)',
        'glow-gold': '0 6px 22px rgba(0,206,209,0.28)',
        'glow-card': '0 10px 30px rgba(10,10,12,0.12)',
        sticker: '5px 5px 0 #0A0A0C',
        pop: '8px 8px 0 rgba(10,10,12,0.95)',
      },
      keyframes: {
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-7px)' },
        },
        'pop-in': {
          '0%': { transform: 'scale(0.88)', opacity: '0' },
          '100%': { transform: 'scale(1)', opacity: '1' },
        },
        'slide-down': {
          '0%': { transform: 'translateY(-10px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        'fade-up': {
          '0%': { transform: 'translateY(12px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        'pulse-ring': {
          '0%': { transform: 'scale(0.95)', boxShadow: '0 0 0 0 rgba(255,0,127,0.5)' },
          '70%': { transform: 'scale(1)', boxShadow: '0 0 0 8px rgba(255,0,127,0)' },
          '100%': { transform: 'scale(0.95)', boxShadow: '0 0 0 0 rgba(255,0,127,0)' },
        },
        'card-enter': {
          '0%': { transform: 'translateY(16px) scale(0.97)', opacity: '0' },
          '100%': { transform: 'translateY(0) scale(1)', opacity: '1' },
        },
        wiggle: {
          '0%, 100%': { transform: 'rotate(-2deg)' },
          '50%': { transform: 'rotate(2deg)' },
        },
        marquee: {
          '0%': { transform: 'translateX(0)' },
          '100%': { transform: 'translateX(-50%)' },
        },
      },
      animation: {
        float: 'float 3.5s ease-in-out infinite',
        'pop-in': 'pop-in 0.18s ease-out',
        'slide-down': 'slide-down 0.16s ease-out',
        'fade-up': 'fade-up 0.25s ease-out',
        shimmer: 'shimmer 2s linear infinite',
        'pulse-ring': 'pulse-ring 1.6s ease-out infinite',
        'card-enter': 'card-enter 0.3s ease-out',
        wiggle: 'wiggle 2.3s ease-in-out infinite',
        marquee: 'marquee 18s linear infinite',
      },
      transitionTimingFunction: {
        'bounce-sm': 'cubic-bezier(0.34, 1.56, 0.64, 1)',
      },
    },
  },
  plugins: [],
}
