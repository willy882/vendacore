import { IsString, IsOptional, IsEmail, MaxLength } from 'class-validator';

export class CreateSupplierDto {
  @IsString() @MaxLength(200)
  razonSocial: string;

  @IsString() @MaxLength(11) @IsOptional()
  ruc?: string;

  @IsString() @MaxLength(100) @IsOptional()
  nombreContacto?: string;

  @IsEmail({}, { message: 'Email inválido' }) @IsOptional()
  email?: string;

  @IsString() @MaxLength(20) @IsOptional()
  telefono?: string;

  @IsString() @IsOptional()
  direccion?: string;
}
