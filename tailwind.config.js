/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        sun: { DEFAULT: '#F3F204', deep: '#E6E400', soft: '#F8F77A' },
        neon: '#E8FF1A',
        vinyl: { DEFAULT: '#C4D020', dark: '#9FAA10' },
        ink: '#111111',
        graphite: { DEFAULT: '#2A2928', 700: '#3A3937', 500: '#8C8986', 300: '#C9C6C1' },
        cream: '#F6EEDF',
        paper: '#FBF9F3',
      },
      fontFamily: {
        display: ['Rubik', 'system-ui', 'sans-serif'],
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        hard: '4px 4px 0 0 #111111',
        'hard-sm': '2px 2px 0 0 #111111',
        'hard-lg': '6px 6px 0 0 #111111',
      },
      keyframes: {
        spin: { to: { transform: 'rotate(360deg)' } },
        drift: { '0%,100%': { transform: 'translateX(0)' }, '50%': { transform: 'translateX(14px)' } },
        twinkle: { '0%,100%': { transform: 'scale(1) rotate(0)', opacity: '1' }, '50%': { transform: 'scale(.75) rotate(12deg)', opacity: '.7' } },
        rise: { from: { opacity: '0', transform: 'translateY(16px)' }, to: { opacity: '1', transform: 'translateY(0)' } },
        pop: { '0%': { transform: 'scale(.6)', opacity: '0' }, '60%': { transform: 'scale(1.08)', opacity: '1' }, '100%': { transform: 'scale(1)' } },
        rays: { '0%,100%': { opacity: '1' }, '50%': { opacity: '.35' } },
        burst: { '0%': { transform: 'translate(0,0) scale(.4) rotate(0)', opacity: '1' }, '100%': { transform: 'translate(var(--dx), var(--dy)) scale(1) rotate(var(--rot))', opacity: '0' } },
      },
      animation: {
        'spin-slow': 'spin 14s linear infinite',
        'spin-mid': 'spin 6s linear infinite',
        drift: 'drift 9s ease-in-out infinite',
        'drift-slow': 'drift 13s ease-in-out infinite',
        twinkle: 'twinkle 2.6s ease-in-out infinite',
        rise: 'rise .5s cubic-bezier(.2,.7,.2,1) both',
        pop: 'pop .55s cubic-bezier(.2,.8,.2,1.2) both',
        rays: 'rays 1.6s ease-in-out infinite',
        burst: 'burst 1.4s cubic-bezier(.1,.7,.3,1) forwards',
      },
    },
  },
  plugins: [],
}
