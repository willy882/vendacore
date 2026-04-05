import {
  Controller, Get, Post, Put, Patch,
  Param, Body, Query, UseGuards, ParseUUIDPipe,
} from '@nestjs/common';
import { CustomersService } from './customers.service';
import { CreateCustomerDto } from './dto/create-customer.dto';
import { UpdateCustomerDto } from './dto/update-customer.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@UseGuards(JwtAuthGuard)
@Controller('customers')
export class CustomersController {
  constructor(private service: CustomersService) {}

  @Get('ranking')
  getRanking(@CurrentUser() user: any) {
    return this.service.getRanking(user.businessId);
  }

  @Get('deudores')
  getDeudores(@CurrentUser() user: any) {
    return this.service.getDeudores(user.businessId);
  }

  @Get()
  findAll(@CurrentUser() user: any, @Query('search') search?: string) {
    return this.service.findAll(user.businessId, search);
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: any) {
    return this.service.findOne(id, user.businessId);
  }

  @Post()
  create(@Body() dto: CreateCustomerDto, @CurrentUser() user: any) {
    return this.service.create(dto, user.businessId);
  }

  @Put(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateCustomerDto,
    @CurrentUser() user: any,
  ) {
    return this.service.update(id, dto, user.businessId);
  }

  @Patch(':id/deactivate')
  deactivate(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: any) {
    return this.service.deactivate(id, user.businessId);
  }
}
