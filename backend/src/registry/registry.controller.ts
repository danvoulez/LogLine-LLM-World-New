import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
  UseGuards,
  BadRequestException, // NEW
  Request, // NEW
} from '@nestjs/common';
import { PeopleService } from './people/people.service';
import { ObjectsService } from './objects/objects.service';
import { AgentsRegistryService } from './agents/agents-registry.service';
import { AgentExecutionLogsService } from './agents/agent-execution-logs.service';
import { IdeasService } from './ideas/ideas.service';
import { ContractsService } from './contracts/contracts.service';
import { ContractTemplatesService } from './contracts/contract-templates.service';
import { RelationshipsService } from './relationships/relationships.service';
import { RegisterPersonDto } from './people/dto/register-person.dto';
import { SearchPeopleDto } from './people/dto/search-people.dto';
import { CreateObjectDto } from './objects/dto/create-object.dto';
import { TransferObjectDto } from './objects/dto/transfer-object.dto';
import { CreateMovementDto } from './objects/dto/create-movement.dto';
import { CreateAgentRegistryDto } from './agents/dto/create-agent-registry.dto';
import { TrainAgentDto } from './agents/dto/train-agent.dto';
import { EvaluateAgentDto } from './agents/dto/evaluate-agent.dto';
import { CreateExecutionLogDto } from './agents/dto/create-execution-log.dto';
import { CreateIdeaDto } from './ideas/dto/create-idea.dto';
import { VoteIdeaDto } from './ideas/dto/vote-idea.dto';
import { CreateContractDto } from './contracts/dto/create-contract.dto';
import { CreateContractTemplateDto } from './contracts/dto/create-contract-template.dto';
import { CreateFromTemplateDto } from './contracts/dto/create-from-template.dto';
import { CreateRelationshipDto } from './relationships/dto/create-relationship.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

/**
 * Registry Controller - Universal Registry API
 * 
 * Unified API for managing:
 * - People (Universal Identity)
 * - Objects (Trackable Items)
 * 
 * All endpoints under /api/v1/registry/*
 */
@Controller('api/v1/registry')
@UseGuards(JwtAuthGuard)
export class RegistryController {
  constructor(
    private readonly peopleService: PeopleService,
    private readonly objectsService: ObjectsService,
    private readonly agentsRegistryService: AgentsRegistryService,
    private readonly agentExecutionLogsService: AgentExecutionLogsService,
    private readonly ideasService: IdeasService,
    private readonly contractsService: ContractsService,
    private readonly contractTemplatesService: ContractTemplatesService,
    private readonly relationshipsService: RelationshipsService,
  ) {}

  // ============================================
  // People Endpoints
  // ============================================

  @Post('people/register')
  async registerPerson(@Body() dto: RegisterPersonDto) {
    return this.peopleService.register(dto);
  }

  @Get('people/:loglineId')
  async getPerson(@Param('loglineId') loglineId: string) {
    return this.peopleService.findByLogLineId(loglineId);
  }

  @Get('people')
  async searchPeople(@Query() query: SearchPeopleDto) {
    return this.peopleService.search(query);
  }

  @Post('people/:loglineId/link-tenant')
  async linkToTenant(
    @Param('loglineId') loglineId: string,
    @Body() body: { tenant_id: string; role: string; data?: Record<string, any> },
  ) {
    return this.peopleService.linkToTenant(
      loglineId,
      body.tenant_id,
      body.role as any,
      body.data,
    );
  }

  @Get('people/:loglineId/tenants')
  async getPersonTenants(@Param('loglineId') loglineId: string) {
    return this.peopleService.getTenants(loglineId);
  }

  // ============================================
  // Objects Endpoints
  // ============================================

  @Post('objects')
  async createObject(@Body() dto: CreateObjectDto) {
    return this.objectsService.create(dto);
  }

  @Get('objects/:id')
  async getObject(@Param('id') id: string) {
    return this.objectsService.findOne(id);
  }

  @Get('objects')
  async listObjects(
    @Query('object_type') objectType?: string,
    @Query('tenant_id') tenantId?: string,
    @Query('owner_logline_id') ownerLoglineId?: string,
    @Query('current_custodian_logline_id') custodianLoglineId?: string,
    @Query('lost_found_status') lostFoundStatus?: string,
    @Query('q') q?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.objectsService.findAll({
      object_type: objectType,
      tenant_id: tenantId,
      owner_logline_id: ownerLoglineId,
      current_custodian_logline_id: custodianLoglineId,
      lost_found_status: lostFoundStatus,
      q,
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
    });
  }

  @Put('objects/:id')
  async updateObject(
    @Param('id') id: string,
    @Body() dto: Partial<CreateObjectDto>,
  ) {
    return this.objectsService.update(id, dto);
  }

  @Delete('objects/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteObject(@Param('id') id: string) {
    await this.objectsService.remove(id);
  }

  @Put('objects/:id/transfer')
  async transferObject(
    @Param('id') id: string,
    @Body() dto: TransferObjectDto,
  ) {
    return this.objectsService.transfer(id, dto);
  }

  @Post('objects/:id/movements')
  async createMovement(
    @Param('id') id: string,
    @Body() dto: CreateMovementDto,
  ) {
    return this.objectsService.createMovement(id, dto);
  }

  @Get('objects/:id/movements')
  async getObjectMovements(@Param('id') id: string) {
    return this.objectsService.getMovements(id);
  }

  // ============================================
  // Agents Endpoints
  // ============================================

  @Post('agents')
  async registerAgent(@Body() dto: CreateAgentRegistryDto) {
    return this.agentsRegistryService.register(dto);
  }

  @Get('agents/:id')
  async getAgent(@Param('id') id: string) {
    return this.agentsRegistryService.findOne(id);
  }

  @Get('agents')
  async listAgents(
    @Query('tenant_id') tenantId?: string,
    @Query('onboarding_status') onboardingStatus?: string,
    @Query('visibility') visibility?: string,
    @Query('owner_logline_id') ownerLoglineId?: string,
    @Query('q') q?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.agentsRegistryService.findAll({
      tenant_id: tenantId,
      onboarding_status: onboardingStatus,
      visibility,
      owner_logline_id: ownerLoglineId,
      q,
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
    });
  }

  @Post('agents/:id/train')
  async trainAgent(@Param('id') id: string, @Body() dto: TrainAgentDto) {
    return this.agentsRegistryService.train(id, dto);
  }

  @Post('agents/:id/complete-training')
  async completeTraining(
    @Param('id') id: string,
    @Body() body: { result: 'success' | 'failed' | 'partial'; performance_metrics?: Record<string, any> },
  ) {
    return this.agentsRegistryService.completeTraining(id, body.result, body.performance_metrics);
  }

  @Post('agents/:id/certify')
  async certifyAgent(
    @Param('id') id: string,
    @Body() body: { certified_by_logline_id: string },
  ) {
    return this.agentsRegistryService.certify(id, body.certified_by_logline_id);
  }

  @Post('agents/:id/contract')
  async assignContract(
    @Param('id') id: string,
    @Body() body: {
      contract_id: string;
      contract_scope: {
        allowed_tools?: string[];
        max_cost_per_run_cents?: number;
        max_llm_calls_per_run?: number;
        allowed_workflows?: string[];
        restricted_actions?: string[];
      };
    },
    @Request() req: any, // NEW
  ) {
    // Assuming req.user.logline_id is populated by JWT Guard
    const assignedBy = req.user?.logline_id || 'unknown';
    return this.agentsRegistryService.assignContract(id, body.contract_id, body.contract_scope, assignedBy);
  }

  @Delete('agents/:id/contract')
  async removeContract(@Param('id') id: string) {
    return this.agentsRegistryService.removeContract(id);
  }

  @Post('agents/:id/evaluate')
  async evaluateAgent(
    @Param('id') id: string,
    @Body() body: EvaluateAgentDto & { evaluator_logline_id: string },
  ) {
    return this.agentsRegistryService.evaluate(id, body.evaluator_logline_id, body);
  }

  @Get('agents/:id/training-history')
  async getTrainingHistory(@Param('id') id: string) {
    return this.agentsRegistryService.getTrainingHistory(id);
  }

  @Get('agents/:id/evaluations')
  async getEvaluations(@Param('id') id: string) {
    return this.agentsRegistryService.getEvaluations(id);
  }

  // ============================================
  // Agent Execution Logs Endpoints
  // ============================================

  @Post('agents/:id/execution-logs')
  async createExecutionLog(
    @Param('id') id: string,
    @Body() dto: Omit<CreateExecutionLogDto, 'agent_id'>,
  ) {
    return this.agentExecutionLogsService.create({
      ...dto,
      agent_id: id,
    });
  }

  @Get('agents/:id/execution-logs')
  async getExecutionLogs(
    @Param('id') id: string,
    @Query('status') status?: string,
    @Query('start_date') startDate?: string,
    @Query('end_date') endDate?: string,
    @Query('limit') limit?: string,
  ) {
    return this.agentExecutionLogsService.getExecutionLogs(id, {
      status: status as any,
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
    });
  }

  @Get('agents/:id/execution-stats')
  async getExecutionStats(
    @Param('id') id: string,
    @Query('period') period?: 'day' | 'week' | 'month',
  ) {
    return this.agentExecutionLogsService.getExecutionStats(id, period || 'week');
  }

  @Get('agents/:id/execution-failures')
  async getRecentFailures(
    @Param('id') id: string,
    @Query('limit') limit?: string,
  ) {
    return this.agentExecutionLogsService.getRecentFailures(
      id,
      limit ? parseInt(limit, 10) : 10,
    );
  }

  // ============================================
  // Ideas Endpoints
  // ============================================

  @Post('ideas')
  async createIdea(@Body() dto: CreateIdeaDto) {
    return this.ideasService.create(dto);
  }

  @Get('ideas/:id')
  async getIdea(@Param('id') id: string) {
    return this.ideasService.findOne(id);
  }

  @Get('ideas')
  async listIdeas(
    @Query('tenant_id') tenantId?: string,
    @Query('status') status?: string,
    @Query('autor_logline_id') autorLoglineId?: string,
    @Query('sort') sort?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.ideasService.findAll({
      tenant_id: tenantId,
      status: status as any,
      autor_logline_id: autorLoglineId,
      sort: sort as any,
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
    });
  }

  @Post('ideas/:id/vote')
  async voteIdea(
    @Param('id') id: string,
    @Body() body: VoteIdeaDto & { voter_logline_id: string },
  ) {
    return this.ideasService.vote(id, body.voter_logline_id, body);
  }

  @Get('ideas/:id/votes')
  async getIdeaVotes(@Param('id') id: string) {
    return this.ideasService.getVotes(id);
  }

  @Get('ideas/matrix/:tenantId')
  async getCostPriorityMatrix(@Param('tenantId') tenantId: string) {
    return this.ideasService.getCostPriorityMatrix(tenantId);
  }

  @Post('ideas/:id/approve')
  async approveIdea(
    @Param('id') id: string,
    @Body() body: { approved_by_logline_id: string },
  ) {
    return this.ideasService.approve(id, body.approved_by_logline_id);
  }

  // ============================================
  // Contracts Endpoints
  // ============================================

  @Post('contracts')
  async createContract(@Body() dto: CreateContractDto) {
    return this.contractsService.create(dto);
  }

  @Get('contracts/:id')
  async getContract(@Param('id') id: string) {
    return this.contractsService.findOne(id);
  }

  @Get('contracts')
  async listContracts(
    @Query('tenant_id') tenantId?: string,
    @Query('estado_atual') estadoAtual?: string,
    @Query('autor_logline_id') autorLoglineId?: string,
    @Query('contraparte_logline_id') contraparteLoglineId?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.contractsService.findAll({
      tenant_id: tenantId,
      estado_atual: estadoAtual as any,
      autor_logline_id: autorLoglineId,
      contraparte_logline_id: contraparteLoglineId,
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
    });
  }

  @Post('contracts/:id/sign')
  async signContract(
    @Param('id') id: string,
    @Body() body: { signed_by_logline_id: string },
  ) {
    return this.contractsService.sign(id, body.signed_by_logline_id);
  }

  @Post('contracts/:id/question')
  async questionContract(
    @Param('id') id: string,
    @Body() body: { razao: string; questioned_by_logline_id: string },
  ) {
    return this.contractsService.question(id, body.razao, body.questioned_by_logline_id);
  }

  @Post('contracts/:id/defend')
  async defendContract(
    @Param('id') id: string,
    @Body() body: { justificativa: string; defended_by_logline_id: string },
  ) {
    return this.contractsService.defend(id, body.justificativa, body.defended_by_logline_id);
  }

  @Post('contracts/:id/resolve')
  async resolveContract(
    @Param('id') id: string,
    @Body() body: { aceita_justificativa: boolean; resolved_by_logline_id: string; penalidade_cents?: number },
  ) {
    return this.contractsService.resolve(
      id,
      body.aceita_justificativa,
      body.resolved_by_logline_id,
      body.penalidade_cents,
    );
  }

  @Post('contracts/:id/complete')
  async completeContract(
    @Param('id') id: string,
    @Body() body: { completed_by_logline_id: string },
  ) {
    return this.contractsService.complete(id, body.completed_by_logline_id);
  }

  @Post('contracts/:id/cancel')
  async cancelContract(
    @Param('id') id: string,
    @Body() body: { motivo: string; cancelled_by_logline_id: string },
  ) {
    return this.contractsService.cancel(id, body.motivo, body.cancelled_by_logline_id);
  }

  @Get('contracts/:id/state-history')
  async getContractStateHistory(@Param('id') id: string) {
    return this.contractsService.getStateHistory(id);
  }

  // ============================================
  // Contract Templates Endpoints
  // ============================================

  @Post('contracts/templates')
  async createContractTemplate(@Body() dto: CreateContractTemplateDto) {
    return this.contractTemplatesService.create(dto);
  }

  @Get('contracts/templates')
  async listContractTemplates(
    @Query('tenant_id') tenantId?: string,
    @Query('categoria') categoria?: string,
    @Query('ativo') ativo?: string,
  ) {
    return this.contractTemplatesService.findAll({
      tenant_id: tenantId,
      categoria,
      ativo: ativo === 'true' ? true : ativo === 'false' ? false : undefined,
    });
  }

  @Get('contracts/templates/:id')
  async getContractTemplate(@Param('id') id: string) {
    return this.contractTemplatesService.findOne(id);
  }

  @Post('contracts/templates/:id/create')
  async createContractFromTemplate(
    @Param('id') id: string,
    @Body() dto: Omit<CreateFromTemplateDto, 'template_id'>,
  ) {
    return this.contractTemplatesService.createFromTemplate({
      ...dto,
      template_id: id,
    });
  }

  @Put('contracts/templates/:id')
  async updateContractTemplate(
    @Param('id') id: string,
    @Body() updates: Partial<CreateContractTemplateDto>,
  ) {
    return this.contractTemplatesService.update(id, updates);
  }

  @Delete('contracts/templates/:id')
  async deactivateContractTemplate(@Param('id') id: string) {
    return this.contractTemplatesService.deactivate(id);
  }

  // ============================================
  // Relationships Endpoints
  // ============================================

  @Post('relationships')
  async createRelationship(@Body() dto: CreateRelationshipDto) {
    return this.relationshipsService.create(dto);
  }

  @Get('relationships/:id')
  async getRelationship(@Param('id') id: string) {
    return this.relationshipsService.findOne(id);
  }

  @Get('relationships')
  async listRelationships(
    @Query('source_type') sourceType?: string,
    @Query('source_id') sourceId?: string,
    @Query('target_type') targetType?: string,
    @Query('target_id') targetId?: string,
    @Query('relationship_type') relationshipType?: string,
  ) {
    if (sourceType && sourceId) {
      return this.relationshipsService.findBySource(
        sourceType as any,
        sourceId,
        relationshipType as any,
      );
    }

    if (targetType && targetId) {
      return this.relationshipsService.findByTarget(
        targetType as any,
        targetId,
        relationshipType as any,
      );
    }

    if (relationshipType) {
      return this.relationshipsService.findByType(relationshipType as any);
    }

    throw new BadRequestException(
      'Must provide source_type+source_id, target_type+target_id, or relationship_type',
    );
  }

  @Get('relationships/entity/:type/:id')
  async getEntityRelationships(
    @Param('type') type: string,
    @Param('id') id: string,
  ) {
    return this.relationshipsService.getEntityRelationships(type as any, id);
  }

  @Get('relationships/between/:type1/:id1/:type2/:id2')
  async getRelationshipsBetween(
    @Param('type1') type1: string,
    @Param('id1') id1: string,
    @Param('type2') type2: string,
    @Param('id2') id2: string,
  ) {
    return this.relationshipsService.findBetween(type1 as any, id1, type2 as any, id2);
  }

  @Put('relationships/:id/metadata')
  async updateRelationshipMetadata(
    @Param('id') id: string,
    @Body() body: { metadata: Record<string, any> },
  ) {
    return this.relationshipsService.updateMetadata(id, body.metadata);
  }

  @Delete('relationships/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteRelationship(@Param('id') id: string) {
    await this.relationshipsService.remove(id);
  }
}
