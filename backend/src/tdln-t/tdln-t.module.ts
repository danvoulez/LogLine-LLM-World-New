import { Module } from '@nestjs/common';
import { TdlnTService } from './tdln-t.service';
import { TdlnTTool } from './tdln-t.tool';
import { ToolsModule } from '../tools/tools.module';

@Module({
  imports: [ToolsModule],
  providers: [TdlnTService, TdlnTTool],
  exports: [TdlnTService, TdlnTTool],
})
export class TdlnTModule {}

