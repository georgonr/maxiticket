import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AssistantController } from './assistant.controller';
import { AssistantService } from './assistant.service';
import { AssistantToolsService } from './assistant-tools.service';
import { OpenAiProvider } from './llm/openai.provider';
import { ASSISTANT_LLM } from './llm/llm.types';
import { OrdersModule } from '../orders/orders.module';

@Module({
  imports: [ConfigModule, OrdersModule],
  controllers: [AssistantController],
  providers: [
    AssistantService,
    AssistantToolsService,
    OpenAiProvider,
    { provide: ASSISTANT_LLM, useExisting: OpenAiProvider },
  ],
})
export class AssistantModule {}
