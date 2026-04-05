import { IsString, MinLength } from 'class-validator';

export class CancelSaleDto {
  @IsString()
  @MinLength(10, { message: 'El motivo de anulación debe tener al menos 10 caracteres' })
  motivo: string;
}
