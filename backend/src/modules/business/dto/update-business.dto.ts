import { IsString, IsOptional, IsEmail, MaxLength } from 'class-validator';

export class UpdateBusinessDto {
  @IsString() @MaxLength(200) @IsOptional()
  razonSocial?: string;

  @IsString() @MaxLength(200) @IsOptional()
  nombreComercial?: string;

  @IsString() @MaxLength(500) @IsOptional()
  direccion?: string;

  @IsString() @MaxLength(20) @IsOptional()
  telefono?: string;

  @IsEmail() @MaxLength(100) @IsOptional()
  email?: string;

  @IsString() @IsOptional()
  logoUrl?: string;
}