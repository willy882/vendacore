import {
  Controller, Get, Post, Put, Delete,
  Param, Body, Query, UseGuards, ParseUUIDPipe,
} from '@nestjs/common';
import { ExpensesService } from './expenses.service';
import { CreateExpenseDto } from './dto/create-expense.dto';
import { CreateExpenseCategoryDto } from './dto/create-expense-category.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('expenses')
export class ExpensesController {
  constructor(private service: ExpensesService) {}

  @Get('categories')
  findCategories(@CurrentUser() user: any) {
    return this.service.findCategories(user.businessId);
  }

  @Post('categories')
  @Roles('administrador', 'supervisor', 'contabilidad')
  createCategory(@Body() dto: CreateExpenseCategoryDto, @CurrentUser() user: any) {
    return this.service.createCategory(dto, user.businessId);
  }

  @Get('summary')
  @Roles('administrador', 'supervisor', 'contabilidad')
  getSummary(
    @CurrentUser() user: any,
    @Query('from') from: string,
    @Query('to') to: string,
  ) {
    return this.service.getSummary(user.businessId, from, to);
  }

  @Get()
  findAll(
    @CurrentUser() user: any,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('categoryId') categoryId?: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.service.findAll(user.businessId, { from, to, categoryId, page, limit });
  }

  @Post()
  @Roles('administrador', 'supervisor', 'cajero', 'contabilidad')
  create(@Body() dto: CreateExpenseDto, @CurrentUser() user: any) {
    return this.service.create(dto, user.id, user.businessId);
  }

  @Put(':id')
  @Roles('administrador', 'supervisor', 'contabilidad')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: Partial<CreateExpenseDto>,
    @CurrentUser() user: any,
  ) {
    return this.service.update(id, dto, user.businessId);
  }

  @Delete(':id')
  @Roles('administrador')
  remove(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: any) {
    return this.service.remove(id, user.businessId);
  }
}
