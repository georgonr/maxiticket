import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AssistantController } from './assistant.controller';
import { GuestAssistantController } from './guest-assistant.controller';
import { AdminConversationsController } from './admin-conversations.controller';
import { AssistantService } from './assistant.service';
import { AssistantToolsService } from './assistant-tools.service';
import { AdminConversationsService } from './admin-conversations.service';
import { VerifyService } from './verify.service';
import { ConversationCloserService } from './conversation-closer.service';
import { OpenAiProvider } from './llm/openai.provider';
import { AnthropicProvider } from './llm/anthropic.provider';
import { ASSISTANT_LLM } from './llm/llm.types';
import { OrdersModule } from '../orders/orders.module';
import { PublicModule } from '../public/public.module';
import { TelegramModule } from '../telegram/telegram.module';
import { HelpdeskModule } from '../helpdesk/helpdesk.module';

@Module({
  imports: [ConfigModule, OrdersModule, PublicModule, TelegramModule, HelpdeskModule],
  controllers: [AssistantController, GuestAssistantController, AdminConversationsController],
  providers: [
    AssistantService,
    AssistantToolsService,
    AdminConversationsService,
    VerifyService,
    ConversationCloserService,
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
