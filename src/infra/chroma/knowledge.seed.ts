import { Document } from '@langchain/core/documents';
import { buildStaticKnowledgeDocuments } from './build-static-knowledge-documents.util';

/** @deprecated Use buildStaticKnowledgeDocuments() — kept for imports/tests. */
export const KNOWLEDGE_DOCUMENTS: Document[] = buildStaticKnowledgeDocuments();
