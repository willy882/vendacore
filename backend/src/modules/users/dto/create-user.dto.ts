import {
  IsEmail,
  IsString,
  MinLength,
  MaxLength,
  IsBoolean,
  IsOptional,
  IsUUID,
} from 'class-validator';

export class CreateUserDto {
  @IsEmail({}, { message: 'Email inválido' })
  email: string;

  @IsString()
  @MinLength(8, { message: 'La contraseña debe tener al menos 8 caracteres' })
  @MaxLength(100)
  password: string;

  @IsString()
  @MaxLength(100)
  nombre: string;

  @IsString()
  @MaxLength(100)
  apellido: string;

  @IsUUID()
  roleId: string;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
