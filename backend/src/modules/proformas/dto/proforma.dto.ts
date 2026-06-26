import { IsString, IsOptional, IsNumber, IsArray, ValidateNested, Min, IsDateString } from 'class-validator';
import { Type } from 'class-transformer';

export class ProformaItemDto {
  @IsOptional() @IsString()  productId?: string;
  @IsOptional() @IsString()  descripcion?: string;
  @IsNumber()   @Min(0.0001) cantidad: number;
  @IsNumber()   @Min(0)      precioUnitario: number;
  @IsNumber()   @Min(0)      igvMonto: number;
}

export class CreateProformaDto {
  @IsOptional() @IsString()       customerId?: string;
  @IsOptional() @IsDateString()   fecha?: string;
  @IsOptional() @IsString()       observaciones?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ProformaItemDto)
  items: ProformaItemDto[];
}

export class UpdateProformaDto {
  @IsOptional() @IsString()       customerId?: string;
  @IsOptional() @IsDateString()   fecha?: string;
  @IsOptional() @IsString()       observaciones?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ProformaItemDto)
  items?: ProformaItemDto[];
}

export class QueryProformaDto {
  @IsOptional() @IsDateString() from?: string;
  @IsOptional() @IsDateString() to?: string;
}
