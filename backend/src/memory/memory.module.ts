import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MemoryItem } from './entities/memory-item.entity';
import { Resource } from './entities/resource.entity';
import { MemoryService } from './memory.service';
import { EmbeddingService } from './embedding.service';

@Module({
  imports: [TypeOrmModule.forFeature([MemoryItem, Resource])],
  providers: [MemoryService, EmbeddingService],
  exports: [MemoryService, EmbeddingService],
})
export class MemoryModule {}

