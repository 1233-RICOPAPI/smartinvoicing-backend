/**
 * Carga .env antes de que se evalúe AppModule (para SKIP_MONGODB, etc.).
 * Debe importarse como primera línea en main.ts.
 */
// eslint-disable-next-line @typescript-eslint/no-require-imports
require('dotenv').config({ path: '.env' });
