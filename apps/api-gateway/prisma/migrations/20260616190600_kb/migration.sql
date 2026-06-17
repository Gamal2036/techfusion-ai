-- CreateTable KbArticle
CREATE TABLE IF NOT EXISTS "KbArticle" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "markdown" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KbArticle_pkey" PRIMARY KEY ("id")
);

-- CreateTable KbEmbedding
CREATE TABLE IF NOT EXISTS "KbEmbedding" (
    "id" TEXT NOT NULL,
    "articleId" TEXT NOT NULL,
    "chunkIndex" INTEGER NOT NULL,
    "chunkText" TEXT NOT NULL,
    "embedding" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "KbEmbedding_pkey" PRIMARY KEY ("id")
);

-- CreateIndex for KbArticle
CREATE INDEX IF NOT EXISTS "KbArticle_orgId_idx" ON "KbArticle"("orgId");
CREATE INDEX IF NOT EXISTS "KbArticle_orgId_createdAt_idx" ON "KbArticle"("orgId", "createdAt");

-- CreateIndex for KbEmbedding
CREATE UNIQUE INDEX IF NOT EXISTS "KbEmbedding_articleId_chunkIndex_key" ON "KbEmbedding"("articleId", "chunkIndex");
CREATE INDEX IF NOT EXISTS "KbEmbedding_articleId_idx" ON "KbEmbedding"("articleId");

-- AddForeignKey
ALTER TABLE "KbArticle" ADD CONSTRAINT "KbArticle_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "KbEmbedding" ADD CONSTRAINT "KbEmbedding_articleId_fkey" FOREIGN KEY ("articleId") REFERENCES "KbArticle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Enable RLS
ALTER TABLE "KbArticle" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "KbEmbedding" ENABLE ROW LEVEL SECURITY;

-- RLS policies
DROP POLICY IF EXISTS kb_article_isolation ON "KbArticle";
CREATE POLICY kb_article_isolation ON "KbArticle"
  FOR ALL USING ("orgId" = current_org_id());

DROP POLICY IF EXISTS kb_embedding_isolation ON "KbEmbedding";
CREATE POLICY kb_embedding_isolation ON "KbEmbedding"
  FOR ALL
  USING (
    "articleId" IN (
      SELECT id FROM "KbArticle" WHERE "orgId" = current_org_id()
    )
  );
