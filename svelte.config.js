import adapter from '@sveltejs/adapter-static';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	// Procesa <style> con soporte para CSS Modules nativo (archivos *.module.css)
	// y TypeScript en <script>. No se usa ningún preprocesador de utilidades (Tailwind).
	preprocess: vitePreprocess(),

	kit: {
		// adapter-static: la app corre 100% en el cliente (Google Antigravity / escritorio),
		// sin backend, ya que todo el parseo de evidencia ocurre localmente por privacidad.
		adapter: adapter({
			pages: 'build',
			assets: 'build',
			fallback: 'index.html',
			precompress: false,
			strict: true
		}),
		alias: {
			$components: 'src/lib/components',
			$types: 'src/lib/types',
			$styles: 'src/lib/styles',
			$three: 'src/lib/three'
		}
	}
};

export default config;
