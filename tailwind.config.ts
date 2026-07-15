import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './lib/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        /**
         * Bauhaus primaries, with one substitution: green takes the place red
         * normally holds as the lead colour, because this is an app about
         * recycling and the brand cannot be built on a warning colour.
         *
         * Red does not disappear — it slides into the role it is best at:
         * rejection and error. Blue and yellow keep their Bauhaus jobs.
         */
        bau: {
          green: '#0F7B36', // primary — actions, approval, brand
          'green-dark': '#0A5A26', // hover only
          blue: '#1040C0', // secondary surfaces, information
          yellow: '#F0C020', // highlight, "attention" states
          red: '#D02020', // rejection and errors, never decoration
          ink: '#121212', // every border, every shadow
          canvas: '#F0F0F0', // the off-white the whole poster sits on
          muted: '#E0E0E0',
        },
      },
      fontFamily: {
        /**
         * Outfit has no Thai glyphs and this app is entirely in Thai, so it can
         * never stand alone here. Kanit sits behind it in the chain: Latin and
         * numerals render in Outfit, Thai falls through to Kanit — which is
         * itself a geometric sans with a 900 weight, so the Bauhaus voice
         * survives the handoff instead of collapsing into a system font.
         */
        sans: ['var(--font-outfit)', 'var(--font-kanit)', 'sans-serif'],
      },
      boxShadow: {
        // Hard offsets only. A blurred shadow is a lie about light; Bauhaus
        // builds depth by stacking planes, not by faking atmosphere.
        'hard-sm': '3px 3px 0px 0px #121212',
        hard: '4px 4px 0px 0px #121212',
        'hard-md': '6px 6px 0px 0px #121212',
        'hard-lg': '8px 8px 0px 0px #121212',
        'hard-white': '4px 4px 0px 0px #FFFFFF',
      },
      borderRadius: {
        // Binary by decree: a square or a circle. Nothing in between.
        none: '0px',
        full: '9999px',
      },
      backgroundImage: {
        'dot-grid': 'radial-gradient(#121212 2px, transparent 2px)',
      },
      backgroundSize: {
        dots: '20px 20px',
      },
    },
  },
  plugins: [],
};

export default config;
