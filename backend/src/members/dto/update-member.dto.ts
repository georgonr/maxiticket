import { IsBoolean } from 'class-validator';

export class UpdateMemberDto {
  @IsBoolean()
  isActive: boolean;
}
