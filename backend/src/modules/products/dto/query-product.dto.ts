import { IsOptional, IsString, IsBoolean, IsUUID, IsNumber, Min } from 'class-validator';
import { Type, Transform } from 'class-transformer';

export class QueryProductDto {
  @IsString() @IsOptional()
  search?: string;

  @IsUUID() @IsOptional()
  categoryId?: string;

  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean() @IsOptional()
  lowStock?: boolean;

  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean() @IsOptional()
  isActive?: boolean;

  @IsNumber() @Min(1) @Type(() => Number) @IsOptional()
  page?: number = 1;

  @IsNumber() @Min(1) @Type(() => Number) @IsOptional()
  limit?: number = 50;
}
