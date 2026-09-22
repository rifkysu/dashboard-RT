// Prisma configuration is intentionally minimal for Prisma versions that use schema.prisma.
// Prisma CLI no longer auto-loads .env when this config file is present, so load it explicitly
// (the app itself already does this separately in src/index.js).
require('dotenv').config();
