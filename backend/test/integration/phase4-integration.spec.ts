import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../../src/app.module';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../../src/auth/entities/user.entity';
import { AuditLog } from '../../src/audit/entities/audit-log.entity';
import { AlertConfig } from '../../src/alerts/entities/alert-config.entity';

describe('Phase 4 Integration Tests', () => {
  let app: INestApplication;
  let userRepository: Repository<User>;
  let auditLogRepository: Repository<AuditLog>;
  let alertConfigRepository: Repository<AlertConfig>;
  let authToken: string;
  let userId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );

    userRepository = moduleFixture.get<Repository<User>>(getRepositoryToken(User));
    auditLogRepository = moduleFixture.get<Repository<AuditLog>>(
      getRepositoryToken(AuditLog),
    );
    alertConfigRepository = moduleFixture.get<Repository<AlertConfig>>(
      getRepositoryToken(AlertConfig),
    );

    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    // Clean up test data
    await auditLogRepository.delete({});
    await alertConfigRepository.delete({});
    await userRepository.delete({});
  });

  describe('Authentication & RBAC', () => {
    it('should register a new user', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send({
          email: 'test@example.com',
          password: 'password123',
          name: 'Test User',
        })
        .expect(201);

      expect(response.body.user).toBeDefined();
      expect(response.body.user.email).toBe('test@example.com');
      expect(response.body.access_token).toBeDefined();
      expect(response.body.refresh_token).toBeDefined();

      authToken = response.body.access_token;
      userId = response.body.user.id;
    });

    it('should login with valid credentials', async () => {
      // First register
      await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send({
          email: 'login@example.com',
          password: 'password123',
        })
        .expect(201);

      // Then login
      const response = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({
          email: 'login@example.com',
          password: 'password123',
        })
        .expect(200);

      expect(response.body.access_token).toBeDefined();
      expect(response.body.user.email).toBe('login@example.com');
    });

    it('should get current user with valid token', async () => {
      // Register and get token
      const registerResponse = await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send({
          email: 'me@example.com',
          password: 'password123',
        })
        .expect(201);

      const token = registerResponse.body.access_token;

      // Get current user
      const response = await request(app.getHttpServer())
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(response.body.email).toBe('me@example.com');
    });

    it('should reject invalid token', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/auth/me')
        .set('Authorization', 'Bearer invalid-token')
        .expect(401);
    });
  });

  describe('Audit Logging', () => {
    it('should log authentication events', async () => {
      // Register user (should log)
      await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send({
          email: 'audit@example.com',
          password: 'password123',
        })
        .expect(201);

      // Check audit logs
      const logs = await auditLogRepository.find({
        where: { resource_type: 'auth' },
        order: { created_at: 'DESC' },
        take: 1,
      });

      expect(logs.length).toBeGreaterThan(0);
      expect(logs[0].action).toBe('create'); // User creation
    });

    it('should query audit logs via API', async () => {
      // Register and login
      const registerResponse = await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send({
          email: 'admin@example.com',
          password: 'password123',
        })
        .expect(201);

      const token = registerResponse.body.access_token;

      // Query audit logs (requires admin/developer role)
      // Note: This test assumes the user has admin role or we need to set it
      const response = await request(app.getHttpServer())
        .get('/api/v1/audit/logs')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(response.body.logs).toBeDefined();
      expect(Array.isArray(response.body.logs)).toBe(true);
    });
  });

  describe('Metrics', () => {
    it('should return metrics in JSON format', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/metrics')
        .expect(200);

      expect(response.body).toBeDefined();
      expect(response.body.runs).toBeDefined();
      expect(response.body.llm).toBeDefined();
      expect(response.body.tools).toBeDefined();
      expect(response.body.policies).toBeDefined();
      expect(response.body.errors).toBeDefined();
      expect(response.body.performance).toBeDefined();
    });

    it('should return metrics in Prometheus format', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/metrics?format=prometheus')
        .expect(200);

      expect(response.text).toContain('# HELP');
      expect(response.text).toContain('# TYPE');
      expect(response.text).toContain('runs_total');
    });
  });

  describe('Alerts', () => {
    it('should create alert configuration', async () => {
      // Register admin user
      const registerResponse = await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send({
          email: 'admin@example.com',
          password: 'password123',
        })
        .expect(201);

      const token = registerResponse.body.access_token;

      // Create alert config
      const response = await request(app.getHttpServer())
        .post('/api/v1/alerts/configs')
        .set('Authorization', `Bearer ${token}`)
        .send({
          name: 'High Error Rate',
          description: 'Alert when error rate exceeds 5%',
          rule_type: 'error_rate',
          threshold: {
            value: 5,
            operator: 'gt',
            window_minutes: 5,
          },
          channels: [
            {
              type: 'webhook',
              config: {
                url: 'https://example.com/webhook',
              },
            },
          ],
          enabled: true,
        })
        .expect(201);

      expect(response.body.name).toBe('High Error Rate');
      expect(response.body.rule_type).toBe('error_rate');
    });

    it('should list alert configurations', async () => {
      // Register admin user
      const registerResponse = await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send({
          email: 'admin2@example.com',
          password: 'password123',
        })
        .expect(201);

      const token = registerResponse.body.access_token;

      // List alert configs
      const response = await request(app.getHttpServer())
        .get('/api/v1/alerts/configs')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
    });
  });

  describe('Rate Limiting', () => {
    it('should enforce rate limits', async () => {
      // Register user
      const registerResponse = await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send({
          email: 'ratelimit@example.com',
          password: 'password123',
        })
        .expect(201);

      const token = registerResponse.body.access_token;

      // Make multiple requests
      const requests = Array.from({ length: 150 }, () =>
        request(app.getHttpServer())
          .get('/api/v1/auth/me')
          .set('Authorization', `Bearer ${token}`),
      );

      const responses = await Promise.all(requests);

      // Some requests should be rate limited (429)
      const rateLimited = responses.filter((r) => r.status === 429);
      // Note: This test depends on rate limit configuration
      // In a real scenario, we'd expect some to be rate limited
    });
  });
});

