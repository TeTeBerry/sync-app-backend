import { BaseCallbackHandler } from '@langchain/core/callbacks/base';
import { TokenStreamBridge } from '../utils/token-stream.bridge';

export class StreamingCallbackHandler extends BaseCallbackHandler {
  name = 'sse_streaming_handler';

  constructor(private readonly bridge: TokenStreamBridge) {
    super();
  }

  async handleLLMNewToken(token: string): Promise<void> {
    if (token) {
      this.bridge.push(token);
    }
  }
}
