import { IsString, IsOptional, MaxLength } from 'class-validator';

export class CreateExpenseCategoryDto {
  @IsString() @MaxLength(100)
  nombre: string;

  @IsString() @IsOptional()
  descripcion?: string;
}
