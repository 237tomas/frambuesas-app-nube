-- The application accesses these tables only from trusted server-side code
-- through Prisma. Do not grant direct Data API access to browser roles.
ALTER TABLE public."Cliente" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."Comprobante" ENABLE ROW LEVEL SECURITY;

REVOKE ALL PRIVILEGES ON TABLE public."Cliente" FROM anon;
REVOKE ALL PRIVILEGES ON TABLE public."Cliente" FROM authenticated;
REVOKE ALL PRIVILEGES ON TABLE public."Comprobante" FROM anon;
REVOKE ALL PRIVILEGES ON TABLE public."Comprobante" FROM authenticated;
