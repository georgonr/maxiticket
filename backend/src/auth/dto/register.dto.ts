import { IsEmail, IsString, MinLength, IsBoolean, IsIn, IsOptional } from 'class-validator';

export class RegisterOrganizerDto {
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

  @IsString()
  @MinLength(2)
  organizerName: string;

  /**
   * DEPRECATED – slug sa už nezadáva, backend ho auto-generuje z organizerName.
   * Pole tu ostáva len preto, že ValidationPipe má forbidNonWhitelisted: true:
   * starý klient s nacachovaným JS by inak dostal 400. Hodnota sa IGNORUJE.
   */
  @IsOptional()
  @IsString()
  organizerSlug?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  // Must be true – user must accept ToS
  @IsIn([true], { message: 'You must accept the terms and conditions' })
  acceptTerms: boolean;
}
