/** Document stub with pageContent/metadata for RAG-related tests. */
module.exports = {
  Document: class MockDocument {
    pageContent: string;
    metadata: Record<string, unknown>;

    constructor(init: { pageContent: string; metadata?: Record<string, unknown> }) {
      this.pageContent = init.pageContent;
      this.metadata = init.metadata ?? {};
    }
  },
};
