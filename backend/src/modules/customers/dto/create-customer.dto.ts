import {
  IsString, IsOptional, IsEmail, IsEnum,
  IsNumber, Min, MaxLength, Matches,
} from 'class-validator';
import { Type } from 'class-transformer';

export enum TipoDocumento {
  DNI       = 'DNI',
  RUC       = 'RUC',
  CE        = 'CE',
  PASAPORTE = 'PASAPORTE',
}

export class CreateCustomerDto {
  @IsString() @MaxLength(200)
  nombreCompleto: string;

  @IsEnum(TipoDocumento) @IsOptional()
  tipoDocumento?: TipoDocumento;

  @IsString() @MaxLength(15) @IsOptional()
  numeroDocumento?: string;

  @IsString() @MaxLength(200) @IsOptional()
  razonSocial?: string;

  @IsEmail({}, { message: 'Email inválido' }) @IsOptional()
  email?: string;

  @IsString() @MaxLength(20) @IsOptional()
  telefono?: string;

  @IsString() @IsOptional()
  direccion?: string;

  @IsString() @MaxLength(10) @IsOptional()
  ubigeo?: string;

  @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) @Type(() => Number) @IsOptional()
  creditoLimite?: number;
}
