import {
  IsArray, IsDateString, IsEnum, IsNotEmpty, IsNumber,
  IsOptional, IsString, IsUUID, Min, ValidateNested, ArrayMinSize, MaxLength,
} from 'class-validator';
import { Type } from 'class-transformer';

export class PurchaseItemDto {
  @IsUUID()
  productId: string;

  @IsNumber({ maxDecimalPlaces: 4 }) @Min(0.0001) @Type(() => Number)
  cantidad: number;

  @IsNumber({ maxDecimalPlaces: 4 }) @Min(0) @Type(() => Number)
  costoUnitario: number;
}

export enum PurchasePaymentStatus {
  pagado   = 'pagado',
  pendiente = 'pendiente',
  parcial  = 'parcial',
}

export class CreatePurchaseDto {
  @IsUUID()
  supplierId: string;

  @IsDateString()
  fecha: string;

  @IsArray() @ArrayMinSize(1) @ValidateNested({ each: true }) @Type(() => PurchaseItemDto)
  items: PurchaseItemDto[];

  @IsEnum(PurchasePaymentStatus) @IsOptional()
  estadoPago?: PurchasePaymentStatus = PurchasePaymentStatus.pendiente;

  @IsString() @MaxLength(20) @IsOptional()
  tipoDocumento?: string;

  @IsString() @MaxLength(50) @IsOptional()
  numeroDocumento?: string;

  @IsString() @IsOptional()
  observaciones?: string;
}
