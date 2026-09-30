import { connectDatabase, disconnectDatabase } from '../src/config/database.js';
import { migrateLegacyOwnership } from '../src/services/ownership-migration.service.js';
const args = process.argv.slice(2);
const email = args.find(arg => !arg.startsWith('--'));
if (!email || args.some(arg => arg.startsWith('--') && arg !== '--apply')) {
  throw new Error('Usage: node scripts/assign-legacy-owner.js ACCOUNT_EMAIL [--apply]');
}
try {
  await connectDatabase();
  const result = await migrateLegacyOwnership(email, args.includes('--apply'));
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
} catch (error) {
  // Do not log Mongo connection details or credentials on failure.
  console.error(`Ownership migration failed (${error.name}): ${error.name === 'Error' ? error.message : 'Check database connectivity and migration prerequisites.'}`);
  process.exitCode = 1;
} finally {
  await disconnectDatabase();
}
