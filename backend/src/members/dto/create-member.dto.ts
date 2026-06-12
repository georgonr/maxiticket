import { IsEmail, IsString, IsOptional } from 'class-validator';

export class CreateMemberDto {
  @IsEmail()
  email: string;

  @IsOptional()
  @IsString()
  name?: string;

  /** Len SUPERADMIN/STAFF – cieľový organizer. */
  @IsOptional()
  @IsString()
  organizerId?: string;
}
