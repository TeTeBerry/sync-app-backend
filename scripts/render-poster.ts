import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import * as path from 'node:path';
import { buildPosterSpec } from '../src/modules/marketing-ai/image-renderer/build-poster-spec';
import { resolvePosterCoverDataUrlForCli } from '../src/modules/marketing-ai/image-renderer/poster-cover-image.cli';
import { PosterImageRendererService } from '../src/modules/marketing-ai/image-renderer/poster-image-renderer.service';
import {
  isPosterSizeId,
  resolvePosterSize,
} from '../src/modules/marketing-ai/image-renderer/poster-size.presets';
import type { InstagramAssetRequest } from '../src/modules/marketing-ai/marketing-ai-instagram-asset.types';

export const SAMPLE_POSTER_REQUEST: InstagramAssetRequest = {
  festival: {
    id: 'tomorrowland-thailand-2026',
    name: 'Tomorrowland Thailand 2026',
    location: 'Pattaya',
    country: 'Thailand',
    dates: 'Dec 5–7',
    genres: ['EDM', 'House', 'Trance'],
    artists: ['Tiësto', 'Armin van Buuren', 'Charlotte de Witte'],
    image: 'static/activity/tomorrowland.jpg',
  },
  publishingPackage: {
    topic: 'Travel + vibe guide',
    caption: 'Save this before you fly.',
    hashtags: ['Tomorrowland'],
  },
  brandStyle: {
    brandName: 'Raven',
    mood: 'premium',
    background: 'dark',
    colorPalette: ['#8b7cf8', '#6e66e8', '#08080c'],
    typography: 'clean sans-serif',
    visualTone: ['festival travel', 'minimal', 'premium'],
    avoid: ['crowded party photos'],
  },
  carousel: [
    {
      slide: 1,
      headline: 'Tomorrowland Thailand 2026',
      body: 'Your essential travel + vibe guide',
      imageDescription: 'Cover',
      overlayText: ['Tomorrowland Thailand 2026'],
      aspectRatio: '4:5',
    },
    {
      slide: 2,
      headline: 'Getting there',
      body: 'Fly into U-Tapao (UTP) or Bangkok, then transfer to Pattaya.',
      imageDescription: 'Travel',
      overlayText: ['Getting there'],
      aspectRatio: '4:5',
    },
    {
      slide: 3,
      headline: 'Where to stay',
      body: 'Book early near the festival shuttle routes or beach hotels.',
      imageDescription: 'Stay',
      overlayText: ['Where to stay'],
      aspectRatio: '4:5',
    },
    {
      slide: 4,
      headline: 'Festival essentials',
      body: 'Comfortable shoes, hydration pack, and cash for food stalls.',
      imageDescription: 'Essentials',
      overlayText: ['Festival essentials'],
      aspectRatio: '4:5',
    },
    {
      slide: 5,
      headline: 'Plan with Raven',
      body: 'Build your lineup itinerary and travel checklist in the app.',
      imageDescription: 'CTA',
      overlayText: ['Plan with Raven'],
      aspectRatio: '4:5',
    },
  ],
};

type CliOptions = {
  inputPath?: string;
  outputPath?: string;
  size?: string;
  sample: boolean;
  validateOnly: boolean;
};

function parseArgs(argv: string[]): CliOptions {
  const options: CliOptions = {
    sample: false,
    validateOnly: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--sample') {
      options.sample = true;
      continue;
    }
    if (arg === '--validate-only') {
      options.validateOnly = true;
      continue;
    }
    if (arg === '--input') {
      options.inputPath = argv[index + 1];
      index += 1;
      continue;
    }
    if (arg === '--output') {
      options.outputPath = argv[index + 1];
      index += 1;
      continue;
    }
    if (arg === '--size') {
      options.size = argv[index + 1];
      index += 1;
    }
  }

  return options;
}

function loadRequest(options: CliOptions): InstagramAssetRequest {
  if (options.sample) {
    return structuredClone(SAMPLE_POSTER_REQUEST);
  }

  if (!options.inputPath) {
    throw new Error('Missing --input <request.json> (or pass --sample)');
  }

  const raw = readFileSync(path.resolve(options.inputPath), 'utf8');
  return JSON.parse(raw) as InstagramAssetRequest;
}

function applySizeOverride(
  request: InstagramAssetRequest,
  size?: string,
): InstagramAssetRequest {
  if (!size) {
    return request;
  }

  if (!isPosterSizeId(size)) {
    throw new Error(
      `Unknown size "${size}". Use one of: 4:5, 1:1, 9:16, 4:3, 16:9, mobile, desktop`,
    );
  }

  return {
    ...request,
    outputSize: size,
    carousel: request.carousel.map((slide) => ({
      ...slide,
      aspectRatio: size,
    })),
  };
}

function defaultOutputPath(
  sizeId: string,
  width: number,
  height: number,
): string {
  return `/tmp/poster-sync-web-${sizeId.replace(':', '-')}-${width}x${height}.png`;
}

export async function renderPosterFromRequest(
  request: InstagramAssetRequest,
  outputPath?: string,
): Promise<{
  outputPath: string;
  bytes: number;
  width: number;
  height: number;
  sizeId: string;
  label: string;
}> {
  const spec = buildPosterSpec(request);
  spec.coverImageDataUrl = await resolvePosterCoverDataUrlForCli({
    image: request.festival.image,
    coverImageUrl: request.festival.coverImageUrl,
  });
  const service = new PosterImageRendererService();
  const png = await service.renderPoster(spec);
  const resolvedOutput =
    outputPath ??
    defaultOutputPath(spec.size.id, spec.size.width, spec.size.height);

  mkdirSync(path.dirname(path.resolve(resolvedOutput)), { recursive: true });
  writeFileSync(path.resolve(resolvedOutput), png);

  return {
    outputPath: path.resolve(resolvedOutput),
    bytes: png.length,
    width: spec.size.width,
    height: spec.size.height,
    sizeId: spec.size.id,
    label: spec.size.label,
  };
}

async function main(): Promise<void> {
  const options = parseArgs(
    process.argv.slice(2).filter((arg) => arg !== '--'),
  );
  const request = applySizeOverride(loadRequest(options), options.size);
  const spec = buildPosterSpec(request);

  if (options.validateOnly) {
    console.log(
      JSON.stringify(
        {
          valid: true,
          festival: spec.festivalName,
          sections: spec.sections.length,
          size: spec.size,
        },
        null,
        2,
      ),
    );
    return;
  }

  const result = await renderPosterFromRequest(request, options.outputPath);
  console.log(
    JSON.stringify(
      {
        ok: true,
        outputPath: result.outputPath,
        bytes: result.bytes,
        width: result.width,
        height: result.height,
        sizeId: result.sizeId,
        label: result.label,
      },
      null,
      2,
    ),
  );
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  });
}
