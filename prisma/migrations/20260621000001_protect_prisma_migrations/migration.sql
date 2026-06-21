-- Prisma migration history is operational metadata and must not be exposed
-- through Supabase's public Data or GraphQL APIs.
ALTER TABLE public."_prisma_migrations" ENABLE ROW LEVEL SECURITY;

REVOKE ALL PRIVILEGES ON TABLE public."_prisma_migrations" FROM anon;
REVOKE ALL PRIVILEGES ON TABLE public."_prisma_migrations" FROM authenticated;
