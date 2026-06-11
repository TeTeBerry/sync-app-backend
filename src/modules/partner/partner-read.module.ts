import { Module } from '@nestjs/common';
import { POST_READ_PORT } from './ports/post-read.port';
import { PostReadAdapter } from './post-read.adapter';
import { PartnerModule } from './partner.module';

/** BFF read surface — Home / Profile import this instead of full PartnerModule. */
@Module({
  imports: [PartnerModule],
  providers: [
    PostReadAdapter,
    { provide: POST_READ_PORT, useExisting: PostReadAdapter },
  ],
  exports: [POST_READ_PORT],
})
export class PartnerReadModule {}
