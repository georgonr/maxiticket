import { IsEmail, IsString, MinLength, IsIn, IsOptional } from 'class-validator';

export class RegisterCustomerDto {
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(8)
  password: string;

  @IsString()
  @MinLength(2)
  firstName: string;

  @IsString()
  @MinLength(2)
  lastName: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsIn([true], { message: 'You must accept the terms and conditions' })
  acceptTerms: boolean;
}
