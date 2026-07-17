import tailwindcss from '@tailwindcss/vite'
import adapter from '@sveltejs/adapter-auto'
import { sveltekit } from '@sveltejs/kit/vite'
import { defineConfig } from 'vite'

export default defineConfig({
	ssr: {
		noExternal: ['layerchart']
	},
	plugins: [
		tailwindcss(),
		sveltekit({
			compilerOptions: {
				runes: ({ filename }) =>
					filename.split(/[/\\]/).includes('node_modules') ? undefined : true
			},

			adapter: adapter(),

			typescript: {
				config: (config) => {
					config.include.push('../drizzle.config.ts')
				}
			}
		})
	]
})
