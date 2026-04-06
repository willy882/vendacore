import {
  Controller, Get, Post, Put, Patch, Delete,
  Param, Body, Query, UseGuards, ParseUUIDPipe,
} from '@nestjs/common';
import { ProductsService } from './products.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { CreateCategoryDto } from './dto/create-category.dto';
import { QueryProductDto } from './dto/query-product.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('products')
export class ProductsController {
  constructor(private service: ProductsService) {}

  // ── CATEGORÍAS ────────────────────────────────────────────────────────

  /** GET /api/v1/products/categories */
  @Get('categories')
  findCategories(@CurrentUser() user: any) {
    return this.service.findAllCategories(user.businessId);
  }

  /** POST /api/v1/products/categories */
  @Roles('administrador', 'supervisor', 'almacenero')
  @Post('categories')
  createCategory(@Body() dto: CreateCategoryDto, @CurrentUser() user: any) {
    return this.service.createCategory(dto, user.businessId);
  }

  /** PUT /api/v1/products/categories/:id */
  @Roles('administrador', 'supervisor')
  @Put('categories/:id')
  updateCategory(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateCategoryDto,
    @CurrentUser() user: any,
  ) {
    return this.service.updateCategory(id, dto, user.businessId);
  }

  /** DELETE /api/v1/products/categories/:id */
  @Roles('administrador')
  @Delete('categories/:id')
  deleteCategory(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: any) {
    return this.service.deleteCategory(id, user.businessId);
  }

  // ── ALERTAS ───────────────────────────────────────────────────────────

  /** GET /api/v1/products/alerts/low-stock */
  @Get('alerts/low-stock')
  getLowStock(@CurrentUser() user: any) {
    return this.service.getLowStockAlerts(user.businessId);
  }

  // ── PRODUCTOS ─────────────────────────────────────────────────────────

  /** GET /api/v1/products */
  @Get()
  findAll(@Query() query: QueryProductDto, @CurrentUser() user: any) {
    return this.service.findAll(query, user.businessId);
  }

  /** GET /api/v1/products/:id */
  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: any) {
    return this.service.findOne(id, user.businessId);
  }

  /** POST /api/v1/products */
  @Roles('administrador', 'supervisor', 'almacenero')
  @Post()
  create(@Body() dto: CreateProductDto, @CurrentUser() user: any) {
    return this.service.create(dto, user.businessId, user.id);
  }

  /** PUT /api/v1/products/:id */
  @Roles('administrador', 'supervisor', 'almacenero')
  @Put(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateProductDto,
    @CurrentUser() user: any,
  ) {
    return this.service.update(id, dto, user.businessId);
  }

  /** PATCH /api/v1/products/:id/deactivate */
  @Roles('administrador')
  @Patch(':id/deactivate')
  deactivate(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: any) {
    return this.service.deactivate(id, user.businessId);
  }
}
