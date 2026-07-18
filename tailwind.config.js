/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Couleurs du thème sombre (défaut de l'application)
        // Le thème clair est géré par des surcharges CSS dans index.css (html.light)
        bg: '#0F0F0F',
        surface: '#1A1A1A',
        surface2: '#222222',
        border: '#2A2A2A',
        border2: '#333333',
        txt: '#E8E8E8',
        txt2: '#888888',
        txt3: '#555555',
        accent: '#4F7CFF',
        win: '#3ecf6e',
        loss: '#f04f4f',
        be: '#f0b84f',
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
