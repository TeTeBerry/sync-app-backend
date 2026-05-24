import { Injectable } from '@nestjs/common';
import { BufferMemory } from 'langchain/memory';

@Injectable()
export class MemoryService {
  private readonly store = new Map<string, BufferMemory>();

  getOrCreate(sessionId: string): BufferMemory {
    const existing = this.store.get(sessionId);
    if (existing) {
      return existing;
    }

    const memory = new BufferMemory({
      returnMessages: true,
      inputKey: 'input',
      outputKey: 'output',
      memoryKey: 'chat_history',
    });

    this.store.set(sessionId, memory);
    return memory;
  }
}
