import { Module } from '@nestjs/common';
import { DocumentsController } from './documents.controller';
import { DocumentsService } from './documents.service';
import { SunatService } from './sunat.service';

@Module({
  controllers: [DocumentsController],
  providers: [DocumentsService, SunatService],
})
export class DocumentsModule {}