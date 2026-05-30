import { IsEmail, IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class ContactDto {
  @IsString() @IsNotEmpty() @MaxLength(100) meno: string;
  @IsEmail() email: string;
  @IsString() @IsNotEmpty() @MaxLength(200) predmet: string;
  @IsString() @IsNotEmpty() @MaxLength(2000) sprava: string;
}
