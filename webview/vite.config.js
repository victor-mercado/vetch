import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import postcssSimpleVars from 'postcss-simple-vars'
import postcssNested from 'postcss-nested'
import postcssImport from 'postcss-import'

const fixScratchLegacyCSS = () => {
  return {
    name: 'fix-scratch-legacy-css',
    enforce: 'pre',
    transform(code, id) {
      // The Double-Barrel Proxy: perfectly links React camelCase classes to CSS kebab-case!
      if (id.includes('scratch-paint') && id.endsWith('.jsx')) {
        return code.replace(
          /import\s+(\w+)\s+from\s+['"]([^'"]+\.css)['"]/g,
          "import '$2'; const $1 = new Proxy({}, { get: (_, prop) => typeof prop === 'string' && prop !== 'default' && prop !== '__esModule' ? prop + ' ' + prop.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase() : undefined });"
        );
      }
      return null;
    }
  }
}

export default defineConfig({
  plugins: [react(), fixScratchLegacyCSS()],
  css: {
    postcss: {
      plugins: [
        postcssImport(), // Natively resolves all the Scratch @imports!
        postcssSimpleVars({
          unknown: function (node, name, result) {
            // Safety Net: Just warn us about missing variables instead of crashing
            node.warn(result, 'Unknown variable ' + name);
          }
        }),
        postcssNested()
      ]
    }
  },
  build: {
    // Keeps the SVGs perfectly inlined so VS Code doesn't block them
    assetsInlineLimit: 100000000, 
    rollupOptions: {
      output: {
        entryFileNames: `assets/[name].js`,
        chunkFileNames: `assets/[name].js`,
        assetFileNames: `assets/[name].[ext]`
      }
    }
  }
})