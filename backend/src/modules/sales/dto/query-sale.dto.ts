import { IsOptional, IsString, IsDateString, IsUUID, IsNumber, Min, IsEnum } from 'class-validator';
import { Type } from 'class-transformer';

export enum SaleStatus {
  activa         = 'activa',
  anulada        = 'anulada',
  pendiente_pago = 'pendiente_pago',
}

export class QuerySaleDto {
  @IsDateString() @IsOptional()
  from?: string;

  @IsDateString() @IsOptional()
  to?: string;

  @IsUUID() @IsOptional()
  customerId?: string;

  @IsUUID() @IsOptional()
  userId?: string;

  @IsEnum(SaleStatus) @IsOptional()
  estado?: SaleStatus;

  @IsString() @IsOptional()
  search?: string; // número de venta o nombre de cliente

  @IsNumber() @Min(1) @Type(() => Number) @IsOptional()
  page?: number = 1;

  @IsNumber() @Min(1) @Type(() => Number) @IsOptional()
  limit?: number = 50;
}
