import {
  IsString, IsNumber, IsOptional, IsBoolean,
  IsEnum, IsDateString, IsUUID, Min, MaxLength,
} from 'class-validator';
import { Type } from 'class-transformer';

export enum ExpenseFrequency {
  diario  = 'diario',
  semanal = 'semanal',
  mensual = 'mensual',
  anual   = 'anual',
}

export class CreateExpenseDto {
  @IsString() @MaxLength(200)
  descripcion: string;

  @IsNumber({ maxDecimalPlaces: 2 }) @Min(0.01) @Type(() => Number)
  monto: number;

  @IsDateString()
  fecha: string;

  @IsUUID() @IsOptional()
  categoryId?: string;

  @IsString() @IsOptional()
  adjuntoUrl?: string;

  @IsBoolean() @IsOptional()
  esRecurrente?: boolean;

  @IsEnum(ExpenseFrequency) @IsOptional()
  frecuencia?: ExpenseFrequency;

  @IsString() @IsOptional()
  observaciones?: string;
}
