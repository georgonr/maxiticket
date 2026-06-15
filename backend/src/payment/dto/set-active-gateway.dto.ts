import { IsEnum } from 'class-validator';
import { PaymentGateway } from '@prisma/client';

export class SetActiveGatewayDto {
  @IsEnum(PaymentGateway)
  gateway: PaymentGateway;
}
