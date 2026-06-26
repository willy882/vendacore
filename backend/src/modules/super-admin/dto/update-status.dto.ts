import { IsEnum, IsOptional, IsString } from 'class-validator';

export enum BusinessStatusDto {
  pendiente = 'pendiente',
  activo    = 'activo',
  suspendido = 'suspendido',
  cancelado = 'cancelado',
}

export class UpdateBusinessStatusDto {
  @IsEnum(BusinessStatusDto)
  status: BusinessStatusDto;

  @IsString()
  @IsOptional()
  notas?: string;
}
