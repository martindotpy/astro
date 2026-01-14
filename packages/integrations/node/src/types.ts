import type { SSRManifest } from 'astro';
import type { IncomingMessage, ServerResponse } from 'node:http';

/**
 * Standard compression encodings and their conventional file extensions.
 * These are the most commonly used compression algorithms for web content.
 */
interface StandardCompression {
	/** Zstandard compression - excellent compression ratio and speed */
	zstd: '.zst';
	/** Brotli compression - optimized for web content, best compression ratio */
	br: '.br';
	/** Gzip compression - widely supported, good compatibility */
	gzip: '.gz';
}

/**
 * Defines a compression algorithm configuration for serving pre-compressed static files.
 *
 * The adapter will look for pre-compressed versions of static files (e.g., `styles.css.gz`)
 * and serve them when the client's `Accept-Encoding` header includes the specified encoding.
 *
 * Standard encodings (`zstd`, `br`, `gzip`) and extensions (`.zst`, `.br`, `.gz`) are provided
 * for better developer experience with autocomplete, but custom encodings and extensions
 * are also fully supported.
 *
 * @example
 * ```ts
 * // Standard compression with conventional extension
 * { encoding: 'gzip', extension: '.gz' }
 *
 * // Custom extension for a standard encoding
 * { encoding: 'gzip', extension: '.gzip' }
 *
 * // Fully custom compression algorithm
 * { encoding: 'lz4', extension: '.lz4' }
 * ```
 */
type Compression =
	| {
			[K in keyof StandardCompression]: {
				encoding: K;
				extension: StandardCompression[K] | (string & {});
			};
	  }[keyof StandardCompression]
	| {
			[K in keyof StandardCompression]: {
				encoding: K | (string & {});
				extension: StandardCompression[K];
			};
	  }[keyof StandardCompression]
	| {
			encoding: string;
			extension: string;
	  };

export interface UserOptions {
	/**
	 * Specifies the mode that the adapter builds to.
	 *
	 * - 'middleware' - Build to middleware, to be used within another Node.js server, such as Express.
	 * - 'standalone' - Build to a standalone server. The server starts up just by running the built script.
	 */
	mode: 'middleware' | 'standalone';

	/**
	 * Disables HTML streaming. This is useful for example if there are constraints from your host.
	 */
	experimentalDisableStreaming?: boolean;

	/**
	 * Enables serving pre-compressed static files when the client supports the specified encodings.
	 *
	 * When enabled, the adapter will check if a compressed version of the requested file exists
	 * (e.g., `styles.css.gz` for a request to `styles.css`) and serve it with the appropriate
	 * `Content-Encoding` header if the client's `Accept-Encoding` header includes the encoding.
	 *
	 * **Important:** This option does NOT compress files automatically. You must pre-compress
	 * your static files during the build process using tools like `gzip`, `brotli`, or build plugins.
	 *
	 * If multiple algorithms are specified, the order matters: the first algorithm in the array
	 * will be preferred when the client supports multiple algorithms. This allows you to prioritize
	 * more efficient compression methods (like Brotli) over more widely supported ones (like gzip).
	 *
	 * When a compressed file is served, the following headers are automatically set:
	 * - `Content-Encoding`: The compression algorithm used
	 * - `Vary: Accept-Encoding`: Ensures proper caching behavior
	 * - `Content-Type`: The MIME type of the original (uncompressed) file
	 *
	 * @default undefined (compression disabled)
	 *
	 * @example
	 * ```ts
	 * // Enable gzip compression with .gz extension
	 * compression: [{ encoding: 'gzip', extension: '.gz' }]
	 *
	 * // Enable Brotli compression with .br extension
	 * compression: [{ encoding: 'br', extension: '.br' }]
	 *
	 * // Enable custom compression algorithm
	 * compression: [{ encoding: 'deflate', extension: '.zz' }]
	 *
	 * // Enable multiple compression algorithms (order matters!).
	 * // Brotli will be preferred, then gzip as fallback.
	 * compression: [
	 *   { encoding: 'zstd', extension: '.zst' },
	 *   { encoding: 'br', extension: '.br' },
	 *   { encoding: 'gzip', extension: '.gz' }
	 * ]
	 *
	 * // Enable gzip compression with a custom extension
	 * compression: [{ encoding: 'gzip', extension: '.custom-gz' }]
	 *
	 * // Enable a custom compression algorithm with a standard extension
	 * compression: [{ encoding: 'custom-compression', extension: '.br' }]
	 *
	 * // Enable a fully custom compression algorithm
	 * compression: [{ encoding: 'custom-compression', extension: '.custom-ext' }]
	 * ```
	 */
	compression?: Compression[];

	/**
	 * If enabled, the adapter will save [static headers in the framework API file](https://docs.netlify.com/frameworks-api/#headers).
	 *
	 * Here the list of the headers that are added:
	 * - The CSP header of the static pages is added when CSP support is enabled.
	 */
	experimentalStaticHeaders?: boolean;

	/**
	 * The host that should be used if the server needs to fetch the prerendered error page.
	 * If not provided, this will default to the host of the server. This should be set if the server
	 * should fetch prerendered error pages from a different host than the public URL of the server.
	 * This is useful for example if the server is behind a reverse proxy or a load balancer, or if
	 * static files are hosted on a different domain. Do not include a path in the URL: it will be ignored.
	 */
	experimentalErrorPageHost?: string | URL;
}

export interface Options extends UserOptions {
	host: string | boolean;
	port: number;
	server: string;
	client: string;
	assets: string;
	trailingSlash?: SSRManifest['trailingSlash'];
	experimentalStaticHeaders: boolean;
}

export type RequestHandler = (...args: RequestHandlerParams) => void | Promise<void>;
type RequestHandlerParams = [
	req: IncomingMessage,
	res: ServerResponse,
	next?: (err?: unknown) => void,
	locals?: object,
];
