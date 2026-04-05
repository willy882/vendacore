import { IsNumber, Min, IsOptional, IsString } from 'class-validator';
import { Type } from 'class-transformer';

export class CloseCashDto {
  @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) @Type(() => Number)
  montoCierreReal: number;

  @IsString() @IsOptional()
  observaciones?: string;
}
