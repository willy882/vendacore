import { PartialType } from '@nestjs/mapped-types';
import { IsString, MinLength, MaxLength, IsOptional } from 'class-validator';
import { CreateUserDto } from './create-user.dto';

export class UpdateUserDto extends PartialType(CreateUserDto) {
  @IsString()
  @MinLength(8)
  @MaxLength(100)
  @IsOptional()
  newPassword?: string;
}
