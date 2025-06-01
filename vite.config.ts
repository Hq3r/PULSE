import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vitest/config';

export default defineConfig({
	plugins: [sveltekit()],
	test: {
		include: ['src/**/*.{test,spec}.{js,ts}']
	},
	server: {
		host: true // This allows the server to be accessible externally
	},
	// ADD THIS: Build configuration to fix BigNumber minification issue
	build: {
		// Disable minification for production to prevent t.isBigNumber error
		minify: process.env.VITE_BUILD_MINIFY === 'false' ? false : 'esbuild',
		
		// Enable source maps for better debugging
		sourcemap: true,
		
		// Remove the problematic manualChunks - let Vite handle chunking automatically
		rollupOptions: {
			// Don't externalize bignumber.js - we want it bundled
			external: (id) => {
				// Allow bignumber.js to be bundled, externalize others as needed
				if (id === 'bignumber.js') return false;
				return false; // Bundle everything by default for SvelteKit static adapter
			}
		}
	},
	
	// ADD THIS: Dependency optimization
	optimizeDeps: {
		include: ['bignumber.js'],
		// Force pre-bundling of BigNumber to prevent runtime issues
		force: true
	},
	
	// ADD THIS: Define global variables for different environments
	define: {
		// This helps with environment detection
		__DEV__: JSON.stringify(process.env.NODE_ENV === 'development'),
		__PROD__: JSON.stringify(process.env.NODE_ENV === 'production')
	}
});