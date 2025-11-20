import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Workflow } from '../src/workflows/entities/workflow.entity';
import { Run } from '../src/runs/entities/run.entity';
import { Event } from '../src/runs/entities/event.entity';
import { Step } from '../src/runs/entities/step.entity';

describe('RunsController (e2e)', () => {
  let app: INestApplication;
  let workflowRepository: Repository<Workflow>;
  let runRepository: Repository<Run>;
  let eventRepository: Repository<Event>;
  let stepRepository: Repository<Step>;

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

    workflowRepository = moduleFixture.get<Repository<Workflow>>(
      getRepositoryToken(Workflow),
    );
    runRepository = moduleFixture.get<Repository<Run>>(
      getRepositoryToken(Run),
    );
    eventRepository = moduleFixture.get<Repository<Event>>(
      getRepositoryToken(Event),
    );
    stepRepository = moduleFixture.get<Repository<Step>>(
      getRepositoryToken(Step),
    );

    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    // Clean up test data
    await eventRepository.delete({});
    await stepRepository.delete({});
    await runRepository.delete({});
    await workflowRepository.delete({});
  });

  it('should create a workflow and start a run', async () => {
    // Create a workflow
    const createWorkflowDto = {
      name: 'Test Workflow',
      definition: {
        nodes: [
          { id: 'node1', type: 'static', output: { message: 'Hello' } },
        ],
        edges: [],
        entryNode: 'node1',
      },
    };

    const workflowResponse = await request(app.getHttpServer())
      .post('/workflows')
      .send(createWorkflowDto)
      .expect(201);

    const workflowId = workflowResponse.body.id;

    // Start a run
    const createRunDto = {
      input: { test: 'data' },
      mode: 'draft',
    };

    const runResponse = await request(app.getHttpServer())
      .post(`/workflows/${workflowId}/runs`)
      .send(createRunDto)
      .expect(201);

    expect(runResponse.body).toHaveProperty('id');
    expect(runResponse.body.workflow_id).toBe(workflowId);
    expect(runResponse.body.status).toBe('pending');

    // Wait a bit for async execution
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // Get run details
    const runDetails = await request(app.getHttpServer())
      .get(`/runs/${runResponse.body.id}`)
      .expect(200);

    expect(runDetails.body).toHaveProperty('id');
    expect(runDetails.body.workflow_id).toBe(workflowId);

    // Get events
    const eventsResponse = await request(app.getHttpServer())
      .get(`/runs/${runResponse.body.id}/events`)
      .expect(200);

    expect(Array.isArray(eventsResponse.body)).toBe(true);
    expect(eventsResponse.body.length).toBeGreaterThan(0);
  });

  it('should return 404 for non-existent run', async () => {
    await request(app.getHttpServer())
      .get('/runs/non-existent-id')
      .expect(404);
  });
});

