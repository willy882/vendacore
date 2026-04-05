import {
  IsString, IsOptional, IsUUID, IsNumber, IsBoolean,
  IsEnum, Min, MaxLength,
} from 'class-validator';
import { Type } from 'class-transformer';

export enum IgvTipo {
  gravado   = 'gravado',
  exonerado = 'exonerado',
  inafecto  = 'inafecto',
}

export class CreateProductDto {
  @IsString() @MaxLength(200)
  nombre: string;

  @IsString() @MaxLength(50) @IsOptional()
  codigoInterno?: string;

  @IsString() @MaxLength(50) @IsOptional()
  codigoBarras?: string;

  @IsString() @IsOptional()
  descripcion?: string;

  @IsUUID() @IsOptional()
  categoryId?: string;

  @IsString() @MaxLength(20) @IsOptional()
  unidadMedida?: string;

  @IsNumber({ maxDecimalPlaces: 4 }) @Min(0) @Type(() => Number) @IsOptional()
  precioCompra?: number;

  @IsNumber({ maxDecimalPlaces: 4 }) @Min(0) @Type(() => Number)
  precioVenta: number;

  @IsEnum(IgvTipo) @IsOptional()
  igvTipo?: IgvTipo;

  @IsNumber({ maxDecimalPlaces: 4 }) @Min(0) @Type(() => Number) @IsOptional()
  stockMinimo?: number;

  @IsString() @IsOptional()
  imagenUrl?: string;

  @IsBoolean() @IsOptional()
  isActive?: boolean;
}
