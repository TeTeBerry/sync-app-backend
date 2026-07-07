import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import * as path from 'node:path';
import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { Resvg } from '@resvg/resvg-js';
import satori, { type SatoriOptions } from 'satori';
import { buildPosterRendererLabel } from './build-poster-spec';
import { buildTravelGuideRendererLabel } from './build-travel-guide-poster-spec';
import { buildPosterElement } from './poster.template';
import { buildTravelGuidePosterElement } from './travel-guide-poster.template';
import {
  POSTER_FONT_BODY,
  POSTER_FONT_DISPLAY,
} from './travel-guide-poster.typography';
import type { PosterSpec } from './poster.types';
import type { TravelGuidePosterSpec } from './travel-guide-poster.types';

type LoadedFont = NonNullable<SatoriOptions['fonts']>[number];

const EDITORIAL_FONT_FILES: Array<{
  filename: string;
  name: string;
  weight: 400 | 700;
}> = [
  {
    filename: 'PlayfairDisplay-Bold.ttf',
    name: POSTER_FONT_DISPLAY,
    weight: 700,
  },
  {
    filename: 'PlayfairDisplay-Regular.ttf',
    name: POSTER_FONT_DISPLAY,
    weight: 400,
  },
  {
    filename: 'LibreBaskerville-Regular.ttf',
    name: POSTER_FONT_BODY,
    weight: 400,
  },
  {
    filename: 'LibreBaskerville-Bold.ttf',
    name: POSTER_FONT_BODY,
    weight: 700,
  },
];

const LEGACY_FONT_FILES: Array<{
  filename: string;
  name: string;
  weight: 400 | 700;
}> = [
  { filename: 'NotoSans-Regular.ttf', name: 'Noto Sans', weight: 400 },
  { filename: 'NotoSans-Bold.ttf', name: 'Noto Sans', weight: 700 },
];

@Injectable()
export class PosterImageRendererService {
  private readonly logger = new Logger(PosterImageRendererService.name);
  private fontsPromise: Promise<LoadedFont[]> | null = null;

  async renderTravelGuidePoster(spec: TravelGuidePosterSpec): Promise<Buffer> {
    const fonts = await this.loadFonts();
    const element = buildTravelGuidePosterElement(spec);
    const { width, height } = spec.size;

    const svg = await satori(element as Parameters<typeof satori>[0], {
      width,
      height,
      fonts,
    });

    const resvg = new Resvg(svg, {
      fitTo: { mode: 'width', value: width },
    });

    return Buffer.from(resvg.render().asPng());
  }

  buildTravelGuideRendererLabel(spec: TravelGuidePosterSpec): string {
    return buildTravelGuideRendererLabel(spec);
  }

  async renderPoster(spec: PosterSpec): Promise<Buffer> {
    const fonts = await this.loadFonts();
    const date = new Date().toISOString().slice(0, 10);
    const element = buildPosterElement(spec, date);
    const { width, height } = spec.size;

    const svg = await satori(element as Parameters<typeof satori>[0], {
      width,
      height,
      fonts,
    });

    const resvg = new Resvg(svg, {
      fitTo: { mode: 'width', value: width },
    });

    return Buffer.from(resvg.render().asPng());
  }

  buildRendererLabel(spec: PosterSpec): string {
    return buildPosterRendererLabel(spec);
  }

  private loadFonts(): Promise<LoadedFont[]> {
    if (!this.fontsPromise) {
      this.fontsPromise = this.readFonts().catch((error) => {
        this.fontsPromise = null;
        throw error;
      });
    }
    return this.fontsPromise;
  }

  private async readFonts(): Promise<LoadedFont[]> {
    const fontDir = this.resolveFontDir();
    const fonts: LoadedFont[] = [];

    for (const entry of [...EDITORIAL_FONT_FILES, ...LEGACY_FONT_FILES]) {
      const fontPath = path.join(fontDir, entry.filename);
      if (!existsSync(fontPath)) {
        throw new ServiceUnavailableException(
          `Poster font missing: ${entry.filename} (run pnpm run poster:fonts)`,
        );
      }

      const data = await readFile(fontPath);
      fonts.push({
        name: entry.name,
        data,
        weight: entry.weight,
        style: 'normal',
      });
    }

    this.logger.log('Loaded editorial poster fonts');

    return fonts;
  }

  private resolveFontDir(): string {
    const candidates = [
      path.join(__dirname, '../assets/fonts'),
      path.join(process.cwd(), 'src/modules/marketing-ai/assets/fonts'),
      path.join(process.cwd(), 'dist/src/modules/marketing-ai/assets/fonts'),
    ];

    for (const candidate of candidates) {
      if (existsSync(path.join(candidate, 'PlayfairDisplay-Bold.ttf'))) {
        return candidate;
      }
    }

    return candidates[0];
  }
}
