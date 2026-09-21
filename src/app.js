import express from 'express';
import mongoose from 'mongoose';
import helmet from 'helmet';
import cors from 'cors';
import morgan from 'morgan';
import mongoSanitize from 'express-mongo-sanitize';
import swaggerJsdoc from 'swagger-jsdoc';
import swaggerUi from 'swagger-ui-express';
import { env } from './config/env.js';
import { createCorsOptions } from './config/cors.js';
import routes from './routes/index.js';
import { errorHandler, notFound } from './middleware/error.middleware.js';

const app = express();
app.disable('x-powered-by');
app.use(helmet());
app.use(cors(createCorsOptions(env)));
app.use(express.json({ limit: '100kb' }));
app.use(mongoSanitize());
app.use(morgan(env.nodeEnv === 'production' ? 'combined' : 'dev'));
app.get('/health', (_req, res) => {
  const connected = mongoose.connection.readyState === 1;
  res.status(connected ? 200 : 503).json({ success: connected, status: connected ? 'OK' : 'UNAVAILABLE', database: connected ? 'connected' : 'disconnected', timestamp: new Date().toISOString() });
});
if (env.swagger) {
  const spec = swaggerJsdoc({
    definition: {
      openapi: '3.0.3',
      info: { title: 'Chirag Eye Care API', version: '1.0.0', description: 'JWT-protected API. Login is the only public business endpoint.' },
      components: { securitySchemes: { bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' } } },
      paths: {
        '/api/v1/auth/login': { post: { summary: 'Owner login' } },
        '/api/v1/patients': { get: { summary: 'List/search patients', security: [{ bearerAuth: [] }] }, post: { summary: 'Create patient', security: [{ bearerAuth: [] }] } },
        '/api/v1/visits': { get: { summary: 'List visits', security: [{ bearerAuth: [] }] }, post: { summary: 'Create immutable visit', security: [{ bearerAuth: [] }] } },
        '/api/v1/medicines': { get: { summary: 'List medicines', security: [{ bearerAuth: [] }] }, post: { summary: 'Create medicine', security: [{ bearerAuth: [] }] } },
        '/api/v1/spectacle-orders': { get: { summary: 'List orders', security: [{ bearerAuth: [] }] }, post: { summary: 'Create order', security: [{ bearerAuth: [] }] } },
        '/api/v1/payments': { get: { summary: 'List payments', security: [{ bearerAuth: [] }] }, post: { summary: 'Record manual payment', security: [{ bearerAuth: [] }] } },
        '/api/v1/dashboard/summary': { get: { summary: 'Dashboard summary', security: [{ bearerAuth: [] }] } },
        '/api/v1/reports/collection': { get: { summary: 'Custom collection report', security: [{ bearerAuth: [] }] } }
      }
    },
    apis: []
  });
  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(spec));
}
app.use('/api/v1', routes);
app.use(notFound);
app.use(errorHandler);
export default app;
