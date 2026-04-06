import { IsUUID, IsNumber, IsEnum, IsOptional, IsString, Min } from 'class-validator';
import { Type } from 'class-transformer';

export enum AdjustmentType {
  ajuste_entrada = 'ajuste_entrada',
  ajuste_salida  = 'ajuste_salida',
}

export class AdjustStockDto {
  @IsUUID()
  productId: string;

  @IsEnum(AdjustmentType, { message: 'Tipo debe ser ajuste_entrada o ajuste_salida' })
  tipo: AdjustmentType;

  @IsNumber({ maxDecimalPlaces: 4 }) @Min(0.0001) @Type(() => Number)
  cantidad: number;

  @IsNumber({ maxDecimalPlaces: 4 }) @Min(0) @Type(() => Number) @IsOptional()
  costoUnitario?: number;

  @IsString() @IsOptional()
  observaciones?: string;
}
