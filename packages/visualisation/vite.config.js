// Import the `defineConfig` function from Vite. This function helps define the configuration 
// for the Vite build tool in a type-safe manner.
import { defineConfig } from 'vite';

// Import the React plugin for Vite. This plugin allows Vite to handle React-specific features 
// and transforms, such as JSX syntax and Fast Refresh.
import react from '@vitejs/plugin-react';

// Import the SVGR plugin for Vite. SVGR allows you to import SVG files as React components.
import svgr from 'vite-plugin-svgr';

// Export the Vite configuration using `defineConfig`. This ensures that the configuration is type-safe 
// and provides autocomplete support in editors that support TypeScript.
export default defineConfig({
  // Specify the plugins to use with Vite. Here, we use the React plugin and the SVGR plugin.
  plugins: [
    react(), // Enables React support in Vite
    svgr()   // Enables importing SVG files as React components
  ],
  // Configure `esbuild`, the JavaScript and TypeScript compiler used by Vite.
  esbuild: {
    // Specify the loader for `.tsx` files. This tells esbuild to use the TypeScript loader 
    // for `.tsx` files, which are TypeScript files that may include JSX syntax.
    loader: 'tsx',
    // Include specific file patterns for transformation. Here, we include all `.js` and `.jsx` 
    // files in the `src` directory to ensure they are processed by the specified loader.
    include: ['src/**/*.js', 'src/**/*.jsx'],
  },
})
