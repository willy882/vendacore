import { IsString, IsOptional, IsUUID, MaxLength } from 'class-validator';

export class CreateCategoryDto {
  @IsString() @MaxLength(100)
  nombre: string;

  @IsString() @IsOptional()
  descripcion?: string;

  @IsUUID() @IsOptional()
  parentId?: string;
}
