import {
  IsArray, IsEnum, IsNotEmpty, IsNumber, IsOptional,
  IsString, IsUUID, Min, ValidateNested, ArrayMinSize,
  IsBoolean,
} from 'class-validator';
import { Type } from 'class-transformer';

export enum TipoVenta {
  contado = 'contado',
  credito = 'credito',
}

export class SaleItemDto {
  @IsUUID()
  productId: string;

  @IsNumber({ maxDecimalPlaces: 4 }) @Min(0.0001) @Type(() => Number)
  cantidad: number;

  @IsNumber({ maxDecimalPlaces: 4 }) @Min(0) @Type(() => Number)
  precioUnitario: number;

  @IsNumber({ maxDecimalPlaces: 4 }) @Min(0) @Type(() => Number) @IsOptional()
  descuento?: number = 0;
}

export class SalePaymentDto {
  @IsString() @IsNotEmpty()
  paymentMethodId: string;

  @IsNumber({ maxDecimalPlaces: 2 }) @Min(0.01) @Type(() => Number)
  monto: number;

  @IsString() @IsOptional()
  referencia?: string;
}

export class CreateSaleDto {
  @IsArray() @ArrayMinSize(1) @ValidateNested({ each: true }) @Type(() => SaleItemDto)
  items: SaleItemDto[];

  @IsArray() @ValidateNested({ each: true }) @Type(() => SalePaymentDto)
  payments: SalePaymentDto[];

  @IsEnum(TipoVenta) @IsOptional()
  tipoVenta?: TipoVenta = TipoVenta.contado;

  @IsUUID() @IsOptional()
  customerId?: string;

  @IsUUID() @IsOptional()
  cashSessionId?: string;

  @IsString() @IsOptional()
  observaciones?: string;

  /** Si true, emite comprobante electrónico automáticamente */
  @IsBoolean() @IsOptional()
  emitirComprobante?: boolean = false;

  /** 'boleta' | 'factura' — requerido si emitirComprobante=true */
  @IsString() @IsOptional()
  tipoComprobante?: 'boleta' | 'factura';
}
