import adapter from '@sveltejs/adapter-vercel';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	preprocess: vitePreprocess(),

	kit: {
		adapter: adapter({
			runtime: 'nodejs20.x'
		}),
		prerender: {
			handleHttpError: 'warn'
		},
		alias: {
			$components: 'src/lib/components',
			$types: 'src/lib/types',
			$styles: 'src/lib/styles',
			$three: 'src/lib/three'
		}
	}
};

export default config;
