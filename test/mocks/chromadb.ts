/** Shared chromadb stub for unit tests (avoids real client connections). */
module.exports = {
  ChromaClient: jest.fn(),
  IncludeEnum: { Documents: 'documents' },
};
