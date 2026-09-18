const { PrismaClient } = require('@prisma/client');
const logger = require('./logger');

const prisma = new PrismaClient({
  log: process.env.PRISMA_LOG === 'true' ? ['error', 'warn'] : ['error'],
});

prisma.$connect().then(() => logger.info('Prisma connected')).catch((err) => logger.error('Prisma connection error', { error: err }));

process.once('SIGINT', async () => { await prisma.$disconnect(); process.exit(0); });
process.once('SIGTERM', async () => { await prisma.$disconnect(); process.exit(0); });

module.exports = prisma;
