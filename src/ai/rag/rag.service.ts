import { Injectable } from '@nestjs/common';
import { ChromaService } from './chroma.service';

@Injectable()
export class RagService {
  constructor(private readonly chroma: ChromaService) {}

  async retrieveContext(question: string): Promise<string> {
    const context = await this.chroma.query(question);
    if (!context) {
      return '';
    }

    return `以下是与用户问题相关的平台知识，回答时可参考：\n${context}`;
  }
}
