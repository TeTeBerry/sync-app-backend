import { Injectable } from '@nestjs/common';
import {
  parseBuddyPostSearchQuery,
  type BuddyPostSearchParsed,
} from '../utils/buddy-post-search.util';

@Injectable()
export class BuddyPostSearchParseService {
  parse(query: string): BuddyPostSearchParsed {
    return parseBuddyPostSearchQuery(query);
  }
}
