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
import { buildPosterElement } from './poster.template';
import type { PosterSpec } from './poster.types';

type LoadedFont = NonNullable<SatoriOptions['fonts']>[number];

@Injectable()
export class PosterImageRendererService {
  private readonly logger = new Logger(PosterImageRendererService.name);
  private fontsPromise: Promise<LoadedFont[]> | null = null;

  async renderPoster(spec: PosterSpec): Promise<Buffer> {
    const fonts = await this.loadFonts();
    const date = new Date().toISOString().slice(0, 10);
    const element = buildPosterElement(spec, date);
    const { width, height } = spec.size;

    const svg = await satori(element, {
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
    const regularPath = path.join(fontDir, 'NotoSans-Regular.ttf');
    const boldPath = path.join(fontDir, 'NotoSans-Bold.ttf');

    if (!existsSync(regularPath) || !existsSync(boldPath)) {
      throw new ServiceUnavailableException(
        `Poster fonts missing under ${fontDir}`,
      );
    }

    const [regular, bold] = await Promise.all([
      readFile(regularPath),
      readFile(boldPath),
    ]);

    this.logger.log('Loaded poster fonts');

    return [
      { name: 'Noto Sans', data: regular, weight: 400, style: 'normal' },
      { name: 'Noto Sans', data: bold, weight: 700, style: 'normal' },
    ];
  }

  private resolveFontDir(): string {
    const candidates = [
      path.join(__dirname, '../assets/fonts'),
      path.join(process.cwd(), 'src/modules/marketing-ai/assets/fonts'),
      path.join(process.cwd(), 'dist/src/modules/marketing-ai/assets/fonts'),
    ];

    for (const candidate of candidates) {
      if (existsSync(path.join(candidate, 'NotoSans-Regular.ttf'))) {
        return candidate;
      }
    }

    return candidates[0];
  }
}
