import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AssistantController } from './assistant.controller';
import { GuestAssistantController } from './guest-assistant.controller';
import { AssistantService } from './assistant.service';
import { AssistantToolsService } from './assistant-tools.service';
import { VerifyService } from './verify.service';
import { OpenAiProvider } from './llm/openai.provider';
import { AnthropicProvider } from './llm/anthropic.provider';
import { ASSISTANT_LLM } from './llm/llm.types';
import { OrdersModule } from '../orders/orders.module';

@Module({
  imports: [ConfigModule, OrdersModule],
  controllers: [AssistantController, GuestAssistantController],
  providers: [
    AssistantService,
    AssistantToolsService,
    VerifyService,
    OpenAiProvider,
    AnthropicProvider,
    // ASSISTANT_PROVIDER=anthropic (default) | openai. OpenAI provider ostáva v kóde pre fallback.
    {
      provide: ASSISTANT_LLM,
      inject: [ConfigService, AnthropicProvider, OpenAiProvider],
      useFactory: (config: ConfigService, anthropic: AnthropicProvider, openai: OpenAiProvider) =>
        (config.get<string>('ASSISTANT_PROVIDER') ?? 'anthropic').toLowerCase() === 'openai'
          ? openai
          : anthropic,
    },
  ],
})
export class AssistantModule {}
