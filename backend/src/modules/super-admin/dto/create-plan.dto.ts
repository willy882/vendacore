import { IsString, IsOptional, IsNumber, IsInt, Min, MaxLength } from 'class-validator';
import { Type } from 'class-transformer';

export class CreatePlanDto {
  @IsString()
  @MaxLength(100)
  nombre: string;

  @IsString()
  @IsOptional()
  descripcion?: string;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Type(() => Number)
  precio: number;

  @IsInt()
  @Min(1)
  @Type(() => Number)
  @IsOptional()
  duracionDias?: number;

  @IsInt()
  @Min(1)
  @Type(() => Number)
  @IsOptional()
  maxUsuarios?: number | null;

  @IsInt()
  @Min(1)
  @Type(() => Number)
  @IsOptional()
  maxProductos?: number | null;

  @IsInt()
  @Min(1)
  @Type(() => Number)
  @IsOptional()
  maxVentasMes?: number | null;

  @IsInt()
  @Min(1)
  @Type(() => Number)
  @IsOptional()
  maxDocumentosMes?: number | null;
}
