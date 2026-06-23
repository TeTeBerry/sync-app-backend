import { Module } from '@nestjs/common';
import { POST_QUERY_PORT } from './ports/post-query.port';
import { POST_WRITE_PORT } from './ports/post-write.port';
import { PostQueryAdapter } from './post-query.adapter';
import { PostWriteAdapter } from './post-write.adapter';
import { PartnerModule } from './partner.module';

/** AI agent surface — ChatAgent / Buddy import this instead of full PartnerModule. */
@Module({
  imports: [PartnerModule],
  providers: [
    PostQueryAdapter,
    PostWriteAdapter,
    { provide: POST_QUERY_PORT, useExisting: PostQueryAdapter },
    { provide: POST_WRITE_PORT, useExisting: PostWriteAdapter },
  ],
  exports: [POST_QUERY_PORT, POST_WRITE_PORT],
})
export class PartnerAgentPortsModule {}
