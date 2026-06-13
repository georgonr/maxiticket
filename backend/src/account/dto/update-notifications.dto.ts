import { IsBoolean } from 'class-validator';

export class UpdateNotificationsDto {
  @IsBoolean()
  marketingOptIn: boolean;
}
