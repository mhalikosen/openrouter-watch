import { HttpModule } from '@nestjs/axios';
import { Module } from '@nestjs/common';
import { OpenrouterService } from './openrouter.service.js';

@Module({
  imports: [HttpModule],
  providers: [OpenrouterService],
  exports: [OpenrouterService],
})
export class OpenrouterModule {}
