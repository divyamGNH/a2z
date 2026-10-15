import dotenv from 'dotenv';
import { fileURLToPath } from 'node:url';
dotenv.config({ path: fileURLToPath(new URL('.env', import.meta.url)), quiet: true });
import { createServer } from './app.mjs';
const service = await createServer();
const port = Number(process.env.PORT || process.env.API_PORT || 4000);
const server = service.app.listen(port, process.env.API_HOST || (process.env.NODE_ENV === 'production' ? '0.0.0.0' : '127.0.0.1'), () => console.log(`A2Z Node API ready at ${process.env.BETTER_AUTH_URL || `http://localhost:${port}`}`));
function shutdown() { server.close(() => { service.close(); process.exit(0); }); }
process.on('SIGTERM', shutdown); process.on('SIGINT', shutdown);
