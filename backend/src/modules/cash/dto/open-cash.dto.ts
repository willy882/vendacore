import { IsNumber, Min, IsOptional, IsString } from 'class-validator';
import { Type } from 'class-transformer';

export class OpenCashDto {
  @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) @Type(() => Number)
  montoApertura: number;

  @IsString() @IsOptional()
  observaciones?: string;
}
