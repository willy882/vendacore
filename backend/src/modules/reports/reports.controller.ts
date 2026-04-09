import { Controller, Get, Query, Res } from '@nestjs/common';
import type { Response } from 'express';
import { ReportsService } from './reports.service';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

function parseDateRange(from?: string, to?: string): { from: Date; to: Date } {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  return {
    from: from ? new Date(from) : startOfMonth,
    to:   to   ? new Date(to + 'T23:59:59') : now,
  };
}

@Controller('reports')
@Roles('administrador', 'supervisor', 'contabilidad', 'auditor')
export class ReportsController {
  constructor(private service: ReportsService) {}

  // ── Excel ────────────────────────────────────────────────────────────────

  @Get('excel/ventas')
  exportSalesExcel(
    @CurrentUser() user: any,
    @Res() res: Response,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    const range = parseDateRange(from, to);
    return this.service.exportSalesExcel(user.businessId, range.from, range.to, res);
  }

  @Get('excel/inventario')
  exportInventoryExcel(@CurrentUser() user: any, @Res() res: Response) {
    return this.service.exportInventoryExcel(user.businessId, res);
  }

  @Get('excel/compras')
  exportPurchasesExcel(
    @CurrentUser() user: any,
    @Res() res: Response,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    const range = parseDateRange(from, to);
    return this.service.exportPurchasesExcel(user.businessId, range.from, range.to, res);
  }

  @Get('excel/gastos')
  exportExpensesExcel(
    @CurrentUser() user: any,
    @Res() res: Response,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    const range = parseDateRange(from, to);
    return this.service.exportExpensesExcel(user.businessId, range.from, range.to, res);
  }

  // ── PDF ──────────────────────────────────────────────────────────────────

  @Get('pdf/ventas')
  exportSalesPdf(
    @CurrentUser() user: any,
    @Res() res: Response,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    const range = parseDateRange(from, to);
    return this.service.exportSalesPdf(user.businessId, range.from, range.to, res);
  }

  @Get('pdf/inventario')
  exportInventoryPdf(@CurrentUser() user: any, @Res() res: Response) {
    return this.service.exportInventoryPdf(user.businessId, res);
  }

  @Get('pdf/gastos')
  exportExpensesPdf(
    @CurrentUser() user: any,
    @Res() res: Response,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    const range = parseDateRange(from, to);
    return this.service.exportExpensesPdf(user.businessId, range.from, range.to, res);
  }

  @Get('pdf/comprobantes')
  exportDocumentsPdf(
    @CurrentUser() user: any,
    @Res() res: Response,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    const range = parseDateRange(from, to);
    return this.service.exportDocumentsPdf(user.businessId, range.from, range.to, res);
  }

  @Get('excel/cobranzas')
  exportCobranzasExcel(
    @CurrentUser() user: any,
    @Res() res: Response,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    const range = parseDateRange(from, to);
    return this.service.exportCobranzasExcel(user.businessId, range.from, range.to, res);
  }

  @Get('pdf/cobranzas')
  exportCobranzasPdf(
    @CurrentUser() user: any,
    @Res() res: Response,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    const range = parseDateRange(from, to);
    return this.service.exportCobranzasPdf(user.businessId, range.from, range.to, res);
  }
}
