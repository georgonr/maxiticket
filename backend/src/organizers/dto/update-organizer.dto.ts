import { IsString, IsOptional, IsEmail, IsEnum, IsDecimal } from 'class-validator';
import { OrganizerStatus, VatStatus } from '@prisma/client';

export class UpdateOrganizerDto {
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsEmail() email?: string;
  @IsOptional() @IsString() phone?: string;
  @IsOptional() @IsString() ico?: string;
  @IsOptional() @IsString() dic?: string;
  @IsOptional() @IsEnum(VatStatus) vatStatus?: VatStatus;
  @IsOptional() @IsString() iban?: string;
  @IsOptional() @IsString() bankName?: string;
  @IsOptional() @IsString() payoutEmail?: string;
  @IsOptional() @IsString() payoutNotes?: string;
  @IsOptional() @IsString() ticketFooterText?: string;
  @IsOptional() @IsString() logoUrl?: string;
  @IsOptional() @IsString() websiteUrl?: string;
  @IsOptional() ticketTemplate?: Record<string, unknown>;
}

export class UpdateOrganizerStatusDto {
  @IsEnum(OrganizerStatus)
  status: OrganizerStatus;
}
