import 'server-only';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { EvaluationError } from './security';

interface ImagePipeline {
    metadata(): Promise<{ format?: string; pages?: number }>;
    rotate(): ImagePipeline;
    resize(options: { width: number; height: number; fit: 'inside'; withoutEnlargement: boolean }): ImagePipeline;
    jpeg(options: { quality: number }): ImagePipeline;
    toBuffer(): Promise<Buffer>;
}
type ImageFactory = (input: Buffer, options: { limitInputPixels: number; failOn: 'warning' }) => ImagePipeline;
let runtime: ImageFactory | undefined;

/**
 * Reuse the native image runtime that the existing Next installation already
 * provides. Resolving relative to Next is important: a separate root Sharp can
 * load a conflicting libvips DLL in Windows. No shared package change is needed.
 */
function nextImageRuntime(): ImageFactory {
    if (!runtime) {
        const appRequire = createRequire(join(process.cwd(), 'package.json'));
        const nextRequire = createRequire(appRequire.resolve('next/package.json'));
        runtime = nextRequire('sharp') as ImageFactory;
    }
    return runtime;
}

export async function normalizePhoto(input: Buffer): Promise<Buffer> {
    let sharp: ImageFactory;
    try { sharp = nextImageRuntime(); }
    catch { throw new EvaluationError(503, 'IMAGE_RUNTIME_UNAVAILABLE', 'The Next.js image runtime is unavailable. Install this project’s optional dependencies using the same operating system that runs the app.'); }
    try {
        const options = { limitInputPixels: 20000000, failOn: 'warning' as const };
        const metadata = await sharp(input, options).metadata();
        if (!['jpeg', 'png', 'webp'].includes(metadata.format ?? '') || (metadata.pages ?? 1) !== 1) throw new Error('Unsupported raster image');
        // Decode real pixels, strip metadata (including EXIF/GPS), and bound output.
        return await sharp(input, options).rotate().resize({ width: 2400, height: 2400, fit: 'inside', withoutEnlargement: true }).jpeg({ quality: 85 }).toBuffer();
    } catch { throw new EvaluationError(400, 'INVALID_PHOTO', 'The image could not be decoded. Use a non-animated JPEG, PNG or WebP under 20 megapixels.'); }
}
