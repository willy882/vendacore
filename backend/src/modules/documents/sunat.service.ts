import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import axios from 'axios';

const APIS_PERU_URL     = 'https://facturacion.apisperu.com/api/v1/invoice/send';
const APIS_PERU_PDF_URL = 'https://facturacion.apisperu.com/api/v1/invoice/pdf';
const APIS_PERU_NC_URL  = 'https://facturacion.apisperu.com/api/v1/creditnote/send';

// tipAfeIgv: 10=gravado, 20=exonerado, 30=inafecto
const IGV_TIP_MAP: Record<string, number> = {
  gravado:   10,
  exonerado: 20,
  inafecto:  30,
};

// tipoDoc cliente según catálogo SUNAT
const CLIENT_DOC_MAP: Record<string, string> = {
  ruc:       '6',
  dni:       '1',
  ce:        '4',
  pasaporte: '7',
};

@Injectable()
export class SunatService {
  private readonly logger = new Logger(SunatService.name);

  constructor(private prisma: PrismaService) {}

  private async getBusinessConfig(businessId: string) {
    const biz = await this.prisma.business.findUnique({
      where: { id: businessId },
      select: {
        ruc:           true,
        razonSocial:   true,
        nombreComercial: true,
        direccion:     true,
        nubefactToken: true,   // reutilizamos este campo para el token de APIs Peru
        sunatMode:     true,
      },
    });

    if (!biz) throw new BadRequestException('Negocio no encontrado');
    if (!biz.nubefactToken) {
      throw new BadRequestException(
        'No hay token de APIs Peru configurado. Ve a Configuración → SUNAT / OSE',
      );
    }
    return biz;
  }

  // ---------------------------------------------------------------------------
  // Convertir número a palabras en español (para la leyenda del comprobante)
  // ---------------------------------------------------------------------------

  private intToWords(n: number): string {
    if (n === 0) return 'CERO';

    const units = [
      '', 'UNO', 'DOS', 'TRES', 'CUATRO', 'CINCO', 'SEIS', 'SIETE', 'OCHO', 'NUEVE',
      'DIEZ', 'ONCE', 'DOCE', 'TRECE', 'CATORCE', 'QUINCE', 'DIECISEIS', 'DIECISIETE',
      'DIECIOCHO', 'DIECINUEVE', 'VEINTE', 'VEINTIUN', 'VEINTIDOS', 'VEINTITRES',
      'VEINTICUATRO', 'VEINTICINCO', 'VEINTISEIS', 'VEINTISIETE', 'VEINTIOCHO', 'VEINTINUEVE',
    ];
    const tens     = ['', '', 'VEINTE', 'TREINTA', 'CUARENTA', 'CINCUENTA', 'SESENTA', 'SETENTA', 'OCHENTA', 'NOVENTA'];
    const hundreds = ['', 'CIENTO', 'DOSCIENTOS', 'TRESCIENTOS', 'CUATROCIENTOS', 'QUINIENTOS',
                      'SEISCIENTOS', 'SETECIENTOS', 'OCHOCIENTOS', 'NOVECIENTOS'];

    if (n < 30) return units[n];

    if (n < 100) {
      const u = n % 10;
      return u === 0 ? tens[Math.floor(n / 10)] : `${tens[Math.floor(n / 10)]} Y ${units[u]}`;
    }

    if (n === 100) return 'CIEN';

    if (n < 1_000) {
      const rest = n % 100;
      return rest === 0
        ? hundreds[Math.floor(n / 100)]
        : `${hundreds[Math.floor(n / 100)]} ${this.intToWords(rest)}`;
    }

    if (n < 2_000) {
      const rest = n % 1_000;
      return rest === 0 ? 'MIL' : `MIL ${this.intToWords(rest)}`;
    }

    if (n < 1_000_000) {
      const th   = Math.floor(n / 1_000);
      const rest = n % 1_000;
      const thStr = `${this.intToWords(th)} MIL`;
      return rest === 0 ? thStr : `${thStr} ${this.intToWords(rest)}`;
    }

    if (n < 2_000_000) {
      const rest = n % 1_000_000;
      return rest === 0 ? 'UN MILLON' : `UN MILLON ${this.intToWords(rest)}`;
    }

    const m    = Math.floor(n / 1_000_000);
    const rest = n % 1_000_000;
    const mStr = `${this.intToWords(m)} MILLONES`;
    return rest === 0 ? mStr : `${mStr} ${this.intToWords(rest)}`;
  }

  private numberToWords(amount: number): string {
    const intPart = Math.floor(amount);
    const cents   = Math.round((amount - intPart) * 100);
    return `SON ${this.intToWords(intPart)} CON ${String(cents).padStart(2, '0')}/100 SOLES`;
  }

  // ---------------------------------------------------------------------------
  // Construir payload para APIs Peru
  // ---------------------------------------------------------------------------

  private buildPayload(doc: any, sale: any, biz: any): Record<string, any> {
    const customer   = doc.customer ?? {};
    const isFactura  = doc.tipo === 'factura';

    let mtoOperGravadas   = 0;
    let mtoOperExoneradas = 0;
    let mtoOperInafectas  = 0;
    let mtoIGV            = 0;

    const details = sale.items.map((item: any) => {
      const igvTipo   = item.product?.igvTipo ?? 'gravado';
      const tipAfeIgv = IGV_TIP_MAP[igvTipo] ?? 10;
      const cantidad  = Number(item.cantidad);

      // precioUnitario en BD es el precio de venta al público (incluye IGV si el producto es gravado)
      const precioConIgv     = Number(item.precioUnitario);
      const mtoValorUnitario = tipAfeIgv === 10 ? precioConIgv / 1.18 : precioConIgv;
      const mtoValorVenta    = parseFloat((mtoValorUnitario * cantidad).toFixed(2));
      const igv              = tipAfeIgv === 10 ? parseFloat((mtoValorVenta * 0.18).toFixed(2)) : 0;
      const porcentajeIgv    = tipAfeIgv === 10 ? 18 : 0;

      if      (tipAfeIgv === 10) { mtoOperGravadas   += mtoValorVenta; mtoIGV += igv; }
      else if (tipAfeIgv === 20)   mtoOperExoneradas += mtoValorVenta;
      else if (tipAfeIgv === 30)   mtoOperInafectas  += mtoValorVenta;

      return {
        codProducto:       item.product?.codigoInterno ?? 'P001',
        unidad:            'NIU',
        descripcion:       item.product?.nombre ?? 'Producto',
        cantidad:          parseFloat(cantidad.toFixed(2)),
        mtoValorUnitario:  parseFloat(mtoValorUnitario.toFixed(6)),
        mtoValorVenta,
        mtoBaseIgv:        mtoValorVenta,
        porcentajeIgv,
        igv,
        tipAfeIgv,
        totalImpuestos:    igv,
        mtoPrecioUnitario: parseFloat(precioConIgv.toFixed(2)),
      };
    });

    mtoOperGravadas   = parseFloat(mtoOperGravadas.toFixed(2));
    mtoOperExoneradas = parseFloat(mtoOperExoneradas.toFixed(2));
    mtoOperInafectas  = parseFloat(mtoOperInafectas.toFixed(2));
    mtoIGV            = parseFloat(mtoIGV.toFixed(2));

    const valorVenta  = parseFloat((mtoOperGravadas + mtoOperExoneradas + mtoOperInafectas).toFixed(2));
    const mtoImpVenta = parseFloat(Number(doc.total).toFixed(2));

    // Fecha en formato ISO con offset de Lima (-05:00)
    const dateStr    = new Date(doc.fechaEmision).toISOString().split('T')[0];
    const fechaEmision = `${dateStr}T00:00:00-05:00`;

    // tipoDoc del cliente
    const tipoDocCliente = CLIENT_DOC_MAP[customer.tipoDocumento] ?? '1';
    const numDocCliente  = customer.numeroDocumento ?? '00000000';

    const payload: Record<string, any> = {
      ublVersion:    '2.1',
      tipoOperacion: '0101',
      tipoDoc:       isFactura ? '01' : '03',
      serie:         doc.serie,
      correlativo:   String(doc.correlativo),
      fechaEmision,
      formaPago: {
        moneda: 'PEN',
        tipo:   sale.tipoVenta === 'credito' ? 'Credito' : 'Contado',
      },
      tipoMoneda: 'PEN',
      client: {
        tipoDoc:   tipoDocCliente,
        numDoc:    /^\d+$/.test(numDocCliente) ? Number(numDocCliente) : numDocCliente,
        rznSocial: customer.nombreCompleto ?? 'CLIENTES VARIOS',
        ...(customer.direccion ? { address: { direccion: customer.direccion } } : {}),
      },
      company: {
        ruc:            biz.ruc,
        razonSocial:    biz.razonSocial,
        nombreComercial: biz.nombreComercial ?? biz.razonSocial,
        address: {
          direccion:    biz.direccion ?? '',
          provincia:    '',
          departamento: '',
          distrito:     '',
          ubigueo:      '',
        },
      },
      mtoOperGravadas,
      mtoIGV,
      totalImpuestos: mtoIGV,
      valorVenta,
      subTotal:    parseFloat((valorVenta + mtoIGV).toFixed(2)),
      mtoImpVenta,
      details,
      legends: [{ code: '1000', value: this.numberToWords(mtoImpVenta) }],
    };

    if (mtoOperExoneradas > 0) payload.mtoOperExoneradas = mtoOperExoneradas;
    if (mtoOperInafectas  > 0) payload.mtoOperInafectas  = mtoOperInafectas;

    return payload;
  }

  // ---------------------------------------------------------------------------
  // Enviar comprobante a APIs Peru
  // ---------------------------------------------------------------------------

  async sendDocument(documentId: string, businessId: string) {
    const doc = await this.prisma.electronicDocument.findFirst({
      where: { id: documentId, businessId },
      include: {
        customer: true,
        sale: {
          include: {
            items: {
              include: {
                product: { select: { nombre: true, codigoInterno: true, igvTipo: true } },
              },
            },
            payments: { include: { paymentMethod: { select: { nombre: true } } } },
          },
        },
      },
    });

    if (!doc) throw new BadRequestException('Comprobante no encontrado');
    if (doc.estado === 'aceptado') throw new BadRequestException('El comprobante ya fue aceptado por SUNAT');

    const biz = await this.getBusinessConfig(businessId);
    let payload = this.buildPayload(doc, doc.sale, biz);
    let url     = APIS_PERU_URL;

    // Nota de crédito: payload y URL específicos
    if (doc.tipo === 'nota_credito') {
      url = APIS_PERU_NC_URL;
      // Recuperar metadatos almacenados al crear la NC
      const meta          = doc.respuestaSunat ?? '';
      const originalNumero = meta.match(/original:([^|]+)/)?.[1]?.trim() ?? '';
      const tipNota        = meta.match(/tipNota:([^|]+)/)?.[1]?.trim() ?? '01';
      payload.tipoDoc  = '07';
      payload.tipNota  = tipNota;
      payload.numNota  = originalNumero;
      delete payload.tipoOperacion;
    }

    this.logger.log(`Enviando ${doc.numeroCompleto} a APIs Peru [${biz.sunatMode}]`);
    this.logger.debug(`Payload: ${JSON.stringify(payload)}`);

    await this.prisma.electronicDocument.update({
      where: { id: documentId },
      data: { estado: 'enviado', fechaEnvio: new Date(), intentosEnvio: { increment: 1 } },
    });

    try {
      const resp = await axios.post(url, payload, {
        headers: {
          Authorization:  `Bearer ${biz.nubefactToken}`,
          'Content-Type': 'application/json',
        },
        timeout: 30_000,
      });

      // DocumentResponse: { xml, hash, sunatResponse: { success, cdrResponse: { accepted, code, description, notes } } }
      const data        = resp.data;
      const cdrResponse = data?.sunatResponse?.cdrResponse;
      const description = cdrResponse?.description
        ?? data?.sunatResponse?.error?.message
        ?? null;
      const aceptado =
        cdrResponse?.accepted === true ||
        data?.sunatResponse?.success === true ||
        (typeof description === 'string' && description.toLowerCase().includes('aceptad'));
      const nuevoEstado = aceptado ? 'aceptado' : 'rechazado';

      this.logger.log(`APIs Peru → ${nuevoEstado}: ${description}`);

      const updated = await this.prisma.electronicDocument.update({
        where: { id: documentId },
        data: {
          estado:          nuevoEstado as any,
          hashCpe:         data.hash ?? null,
          respuestaSunat:  description,
          errorDescripcion: aceptado ? null : description,
          fechaRespuesta:  new Date(),
        },
      });

      return {
        estado:           updated.estado,
        aceptado,
        sunatDescription: description,
        hashCpe:          data.hash ?? null,
        numero:           doc.numeroCompleto,
      };
    } catch (error: any) {
      const errData = error?.response?.data;
      const errMsg  =
        errData?.message
        ?? errData?.sunatResponse?.error?.message
        ?? error?.message
        ?? 'Error al comunicarse con APIs Peru';

      await this.prisma.electronicDocument.update({
        where: { id: documentId },
        data: {
          estado:          'rechazado',
          errorDescripcion: errMsg,
          fechaRespuesta:  new Date(),
        },
      });

      this.logger.error(`Error APIs Peru [${error?.response?.status}]: ${errMsg}`);
      this.logger.error(`Respuesta completa: ${JSON.stringify(error?.response?.data)}`);
      this.logger.error(`URL llamada: ${url}`);
      throw new BadRequestException(`Error OSE: ${errMsg}`);
    }
  }

  // ---------------------------------------------------------------------------
  // Generar PDF del comprobante vía APIs Peru
  // ---------------------------------------------------------------------------

  /** Versión pública (sin autenticación): obtiene el businessId del propio documento */
  async generatePdfPublic(documentId: string): Promise<Buffer> {
    const doc = await this.prisma.electronicDocument.findUnique({
      where: { id: documentId },
      select: { businessId: true },
    });
    if (!doc) throw new BadRequestException('Comprobante no encontrado');
    return this.generatePdf(documentId, doc.businessId);
  }

  async generatePdf(documentId: string, businessId: string): Promise<Buffer> {
    const doc = await this.prisma.electronicDocument.findFirst({
      where: { id: documentId, businessId },
      include: {
        customer: true,
        sale: {
          include: {
            items: {
              include: {
                product: { select: { nombre: true, codigoInterno: true, igvTipo: true } },
              },
            },
            payments: { include: { paymentMethod: { select: { nombre: true } } } },
          },
        },
      },
    });

    if (!doc) throw new BadRequestException('Comprobante no encontrado');

    const biz     = await this.getBusinessConfig(businessId);
    const payload = this.buildPayload(doc, doc.sale, biz);

    const resp = await axios.post(APIS_PERU_PDF_URL, payload, {
      headers: {
        Authorization:  `Bearer ${biz.nubefactToken}`,
        'Content-Type': 'application/json',
      },
      responseType: 'arraybuffer',
      timeout: 30_000,
    });

    return Buffer.from(resp.data);
  }
}
