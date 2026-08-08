import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
	plugins: [sveltekit()],
	server: {
		port: 3000,
		strictPort: false
	},
	css: {
		modules: {
			localsConvention: 'camelCaseOnly'
		}
	},
	optimizeDeps: {
		include: ['three', 'gsap']
	},
	build: {
		target: 'es2020',
		chunkSizeWarningLimit: 1200
	}
});
