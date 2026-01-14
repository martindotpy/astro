import nodejs from '@astrojs/node';
import { defineConfig } from 'astro/config';

export default defineConfig({
	output: 'server',
	adapter: nodejs({ mode: 'standalone' }),
});
