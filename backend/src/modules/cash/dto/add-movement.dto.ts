import { IsEnum, IsNumber, IsOptional, IsString, IsUUID, Min, MaxLength } from 'class-validator';
import { Type } from 'class-transformer';

export enum MovementTipo {
  ingreso = 'ingreso',
  egreso  = 'egreso',
}

export class AddMovementDto {
  @IsEnum(MovementTipo)
  tipo: MovementTipo;

  @IsString() @MaxLength(200)
  concepto: string;

  @IsNumber({ maxDecimalPlaces: 2 }) @Min(0.01) @Type(() => Number)
  monto: number;

  @IsUUID() @IsOptional()
  paymentMethodId?: string;

  @IsString() @IsOptional()
  observaciones?: string;
}
