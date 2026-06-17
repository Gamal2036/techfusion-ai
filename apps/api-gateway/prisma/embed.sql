INSERT INTO "KbEmbedding" (id, "articleId", "chunkIndex", "chunkText", embedding, "createdAt")
SELECT gen_random_uuid()::text, id, 0, substring(markdown FROM 1 FOR 500), '[]'::jsonb, NOW()
FROM "KbArticle";
