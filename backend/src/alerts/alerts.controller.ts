import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import { AlertService } from './alert.service';
import { AlertConfig } from './entities/alert-config.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { JwtPayload } from '../auth/auth.service';

@Controller('alerts')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin', 'developer')
export class AlertsController {
  constructor(
    private alertService: AlertService,
    @InjectRepository(AlertConfig)
    private alertConfigRepository: Repository<AlertConfig>,
  ) {}

  @Get('configs')
  async listConfigs(@Query('tenant_id') tenantId?: string) {
    return this.alertConfigRepository.find({
      where: {
        ...(tenantId ? { tenant_id: tenantId } : {}),
      },
      order: { created_at: 'DESC' },
    });
  }

  @Post('configs')
  @HttpCode(HttpStatus.CREATED)
  async createConfig(
    @Body() configData: Partial<AlertConfig>,
    @CurrentUser() user: JwtPayload,
  ) {
    const config = this.alertConfigRepository.create({
      ...configData,
      tenant_id: configData.tenant_id || user.tenant_id,
    });
    return this.alertConfigRepository.save(config);
  }

  @Patch('configs/:id')
  async updateConfig(
    @Param('id') id: string,
    @Body() updates: Partial<AlertConfig>,
  ) {
    await this.alertConfigRepository.update(id, updates);
    return this.alertConfigRepository.findOne({ where: { id } });
  }

  @Delete('configs/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteConfig(@Param('id') id: string) {
    await this.alertConfigRepository.delete(id);
  }

  @Post('check')
  @HttpCode(HttpStatus.OK)
  async checkAlerts(@Query('tenant_id') tenantId?: string) {
    await this.alertService.checkAlerts(tenantId);
    return { message: 'Alert check completed' };
  }

  @Post('history/:id/resolve')
  @HttpCode(HttpStatus.OK)
  async resolveAlert(@Param('id') id: string) {
    await this.alertService.resolveAlert(id);
    return { message: 'Alert resolved' };
  }
}

