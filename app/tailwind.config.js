/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        forest: {
          50:  '#f2f8ed',
          100: '#deefd1',
          200: '#bcdfa5',
          300: '#93c872',
          400: '#6eb046',
          500: '#529530',
          600: '#427726',
          700: '#355f1f',  // header / nav / footer
          800: '#284a18',
          900: '#1b3410',
        },
        sage: {
          50:  '#f6faf2',
          100: '#e8f3de',
          200: '#d4e8c2',  // content-area background (matches screenshot)
          300: '#b8d99e',
        },
        cream: {
          DEFAULT: '#f0db6e',
          50:  '#fefce8',
          100: '#fdf4a3',
          200: '#f9e96a',
          300: '#f0d940',
        },
      },
    },
  },
  plugins: [],
};
