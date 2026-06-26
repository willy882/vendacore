import { IsUUID, IsOptional, IsString, IsInt, Min, IsNumber } from 'class-validator';
import { Type } from 'class-transformer';

export class ActivateBusinessDto {
  @IsUUID()
  @IsOptional()
  planId?: string;

  @IsInt()
  @Min(1)
  @Type(() => Number)
  @IsOptional()
  duracionDias?: number = 30;

  @IsNumber()
  @Min(0)
  @Type(() => Number)
  @IsOptional()
  montoPagado?: number = 0;

  @IsString()
  @IsOptional()
  metodoPago?: string;

  @IsString()
  @IsOptional()
  referenciaPago?: string;

  @IsString()
  @IsOptional()
  notas?: string;
}
