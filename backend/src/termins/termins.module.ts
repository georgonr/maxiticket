import { Module } from '@nestjs/common';
import { TerminsService } from './termins.service';
import { TerminsController } from './termins.controller';

@Module({ controllers: [TerminsController], providers: [TerminsService], exports: [TerminsService] })
export class TerminsModule {}
