import { IsOptional, IsDateString, IsEnum, IsNumber, Min } from 'class-validator';
import { Type } from 'class-transformer';

export enum MovementType {
  entrada_compra = 'entrada_compra',
  salida_venta   = 'salida_venta',
  ajuste_entrada = 'ajuste_entrada',
  ajuste_salida  = 'ajuste_salida',
  devolucion     = 'devolucion',
}

export class QueryKardexDto {
  @IsDateString() @IsOptional()
  from?: string;

  @IsDateString() @IsOptional()
  to?: string;

  @IsEnum(MovementType) @IsOptional()
  tipo?: MovementType;

  @IsNumber() @Min(1) @Type(() => Number) @IsOptional()
  page?: number = 1;

  @IsNumber() @Min(1) @Type(() => Number) @IsOptional()
  limit?: number = 50;
}
