import * as assert from 'node:assert/strict';
import fs from 'node:fs';
import { after, before, describe, it } from 'node:test';
import { gzipSync } from 'node:zlib';
import nodejs from '../dist/index.js';
import { loadFixture, waitServerListen } from './test-utils.js';

describe('Compression', () => {
	/** @type {import('./test-utils').Fixture} */
	let fixture;
	let server;

	describe('With gzip compression enabled', () => {
		before(async () => {
			fixture = await loadFixture({
				root: './fixtures/compression/',
				output: 'server',
				adapter: nodejs({
					mode: 'standalone',
					compression: [{ encoding: 'gzip', extension: '.gz' }],
				}),
			});
			await fixture.build();

			// Create gzip versions of static files in the client directory
			const clientDir = new URL('./fixtures/compression/dist/client/', import.meta.url);
			const cssPath = new URL('styles.css', clientDir);
			const jsPath = new URL('script.js', clientDir);

			if (fs.existsSync(cssPath)) {
				const cssContent = fs.readFileSync(cssPath);
				fs.writeFileSync(new URL('styles.css.gz', clientDir), gzipSync(cssContent));
			}

			if (fs.existsSync(jsPath)) {
				const jsContent = fs.readFileSync(jsPath);
				fs.writeFileSync(new URL('script.js.gz', clientDir), gzipSync(jsContent));
			}

			const { startServer } = await fixture.loadAdapterEntryModule();
			const res = startServer();
			server = res.server;
			await waitServerListen(server.server);
		});

		after(async () => {
			await server.stop();
			await fixture.clean();
		});

		it('Serves compressed file when Accept-Encoding includes gzip', async () => {
			const res = await fetch(`http://${server.host}:${server.port}/styles.css`, {
				headers: {
					'Accept-Encoding': 'gzip, deflate, br',
				},
			});

			assert.equal(res.status, 200);
			assert.equal(res.headers.get('content-encoding'), 'gzip');
			assert.equal(res.headers.get('vary'), 'Accept-Encoding');
			assert.ok(res.headers.get('content-type')?.includes('text/css'));
		});

		it('Serves uncompressed file when Accept-Encoding does not include gzip', async () => {
			const res = await fetch(`http://${server.host}:${server.port}/styles.css`, {
				headers: {
					'Accept-Encoding': 'deflate',
				},
			});

			assert.equal(res.status, 200);
			assert.equal(res.headers.get('content-encoding'), null);
		});

		it('Serves compressed JavaScript file with correct headers', async () => {
			const res = await fetch(`http://${server.host}:${server.port}/script.js`, {
				headers: {
					'Accept-Encoding': 'gzip',
				},
			});

			assert.equal(res.status, 200);
			assert.equal(res.headers.get('content-encoding'), 'gzip');
			assert.equal(res.headers.get('vary'), 'Accept-Encoding');
			assert.ok(res.headers.get('content-type')?.includes('javascript'));
		});

		it('SSR routes still work with compression enabled', async () => {
			const res = await fetch(`http://${server.host}:${server.port}/`, {
				headers: {
					'Accept-Encoding': 'gzip',
				},
			});

			assert.equal(res.status, 200);
			const html = await res.text();
			assert.ok(html.includes('<h1>Compression Test</h1>'));
		});
	});

	describe('With multiple compression algorithms', () => {
		before(async () => {
			fixture = await loadFixture({
				root: './fixtures/compression/',
				output: 'server',
				outDir: './dist/multi-compression',
				adapter: nodejs({
					mode: 'standalone',
					compression: [
						{ encoding: 'br', extension: '.br' },
						{ encoding: 'gzip', extension: '.gz' },
					],
				}),
			});
			await fixture.build();

			// Create compressed versions in the client directory
			const clientDir = new URL(
				'./fixtures/compression/dist/multi-compression/client/',
				import.meta.url,
			);
			const cssPath = new URL('styles.css', clientDir);

			if (fs.existsSync(cssPath)) {
				const cssContent = fs.readFileSync(cssPath);
				// Create both .br and .gz versions
				fs.writeFileSync(new URL('styles.css.br', clientDir), cssContent); // Simulated brotli
				fs.writeFileSync(new URL('styles.css.gz', clientDir), gzipSync(cssContent));
			}

			const { startServer } = await fixture.loadAdapterEntryModule();
			const res = startServer();
			server = res.server;
			await waitServerListen(server.server);
		});

		after(async () => {
			await server.stop();
			await fixture.clean();
		});

		it('Prefers first compression algorithm when client supports both', async () => {
			const res = await fetch(`http://${server.host}:${server.port}/styles.css`, {
				headers: {
					'Accept-Encoding': 'gzip, br',
				},
			});

			assert.equal(res.status, 200);
			// Should prefer 'br' since it's first in the compression array
			assert.equal(res.headers.get('content-encoding'), 'br');
			assert.equal(res.headers.get('vary'), 'Accept-Encoding');
		});

		it('Falls back to second algorithm when first is not supported', async () => {
			const res = await fetch(`http://${server.host}:${server.port}/styles.css`, {
				headers: {
					'Accept-Encoding': 'gzip',
				},
			});

			assert.equal(res.status, 200);
			assert.equal(res.headers.get('content-encoding'), 'gzip');
		});
	});

	describe('Without compression enabled', () => {
		before(async () => {
			fixture = await loadFixture({
				root: './fixtures/compression/',
				output: 'server',
				outDir: './dist/no-compression',
				adapter: nodejs({ mode: 'standalone' }),
			});
			await fixture.build();

			const { startServer } = await fixture.loadAdapterEntryModule();
			const res = startServer();
			server = res.server;
			await waitServerListen(server.server);
		});

		after(async () => {
			await server.stop();
			await fixture.clean();
		});

		it('Serves files without compression headers', async () => {
			const res = await fetch(`http://${server.host}:${server.port}/styles.css`, {
				headers: {
					'Accept-Encoding': 'gzip, deflate, br',
				},
			});

			assert.equal(res.status, 200);
			assert.equal(res.headers.get('content-encoding'), null);
			assert.equal(res.headers.get('vary'), null);
		});
	});
});
