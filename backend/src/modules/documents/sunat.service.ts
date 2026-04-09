import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import axios from 'axios';

const NUBEFACT_BASE = 'https://api.nubefact.com/api/v1';

// Tipo de IGV: 1 = Gravado, 2 = Exonerado, 3 = Inafecto
const IGV_TIPO_MAP: Record<string, number> = {
  gravado:    1,
  exonerado:  2,
  inafecto:   3,
};

@Injectable()
export class SunatService {
  private readonly logger = new Logger(SunatService.name);

  constructor(private prisma: PrismaService) {}

  /** Obtiene la configuración OSE del negocio */
  private async getBusinessConfig(businessId: string) {
    const biz = await this.prisma.business.findUnique({
      where: { id: businessId },
      select: {
        ruc: true,
        razonSocial: true,
        nombreComercial: true,
        direccion: true,
        nubefactToken: true,
        sunatMode: true,
      },
    });

    if (!biz) throw new BadRequestException('Negocio no encontrado');
    if (!biz.nubefactToken) {
      throw new BadRequestException(
        'No hay token de Nubefact configurado. Configúralo en Configuración → SUNAT / OSE',
      );
    }
    return biz;
  }

  /** Construye el payload para Nubefact según el tipo de comprobante */
  private buildPayload(doc: any, sale: any, biz: any): Record<string, any> {
    const customer = doc.customer ?? {};
    const isFactura = doc.tipo === 'factura';

    // Mapear tipo de documento del cliente
    const clienteTipoDoc = customer.tipoDocumento === 'ruc' ? '6' : '1';

    // Total base imponible (sin IGV) y total exonerado
    const totalGravada = sale.items
      .filter((i: any) => (i.product?.igvTipo ?? 'gravado') === 'gravado')
      .reduce((acc: number, i: any) => acc + Number(i.subtotal), 0);

    const totalExonerada = sale.items
      .filter((i: any) => i.product?.igvTipo === 'exonerado')
      .reduce((acc: number, i: any) => acc + Number(i.subtotal), 0);

    const totalInafecta = sale.items
      .filter((i: any) => i.product?.igvTipo === 'inafecto')
      .reduce((acc: number, i: any) => acc + Number(i.subtotal), 0);

    const items = sale.items.map((item: any) => {
      const igvTipo = IGV_TIPO_MAP[item.product?.igvTipo ?? 'gravado'] ?? 1;
      const cantidad = Number(item.cantidad);
      const valorUnitario = Number(item.precioUnitario) / 1.18;      // precio sin IGV
      const precioUnitario = Number(item.precioUnitario);
      const subtotal = valorUnitario * cantidad;
      const igvItem = igvTipo === 1 ? subtotal * 0.18 : 0;
      const total = precioUnitario * cantidad;

      return {
        unidad_de_medida: 'NIU',
        codigo: item.product?.codigoInterno ?? 'P001',
        descripcion: item.product?.nombre ?? 'Producto',
        cantidad,
        valor_unitario: parseFloat(valorUnitario.toFixed(6)),
        precio_unitario: parseFloat(precioUnitario.toFixed(2)),
        descuento: '',
        subtotal: parseFloat(subtotal.toFixed(2)),
        tipo_de_igv: igvTipo,
        igv: parseFloat(igvItem.toFixed(2)),
        total: parseFloat(total.toFixed(2)),
        anticipo_regularizacion: false,
        anticipo_documento_serie: '',
        anticipo_documento_numero: '',
      };
    });

    // Método de pago principal
    const metodoPago = sale.payments?.[0]?.paymentMethod?.nombre ?? 'Efectivo';

    const payload: Record<string, any> = {
      operacion: 'generar_comprobante',
      tipo_de_comprobante: isFactura ? 1 : 2,
      serie: doc.serie,
      numero: doc.correlativo,
      sunat_transaction: 1,
      cliente_tipo_de_documento: clienteTipoDoc,
      cliente_numero_de_documento: customer.numeroDocumento ?? '00000000',
      cliente_denominacion: customer.nombreCompleto ?? 'Clientes Varios',
      cliente_direccion: customer.direccion ?? '',
      cliente_email: customer.email ?? '',
      fecha_de_emision: new Date(doc.fechaEmision).toISOString().split('T')[0],
      fecha_de_vencimiento: '',
      moneda: 1,
      tipo_de_cambio: '',
      porcentaje_de_igv: 18.0,
      descuento_global: 0,
      total_descuento: Number(sale.descuentoGlobal ?? 0),
      total_anticipo: 0,
      total_gravada: parseFloat(totalGravada.toFixed(2)),
      total_inafecta: parseFloat(totalInafecta.toFixed(2)),
      total_exonerada: parseFloat(totalExonerada.toFixed(2)),
      total_igv: parseFloat(Number(doc.igv).toFixed(2)),
      total_gratuita: 0,
      total_otros_cargos: 0,
      total: parseFloat(Number(doc.total).toFixed(2)),
      percepcion_tipo: '',
      percepcion_base_imponible: 0,
      total_percepcion: 0,
      total_incluido_percepcion: 0,
      detraccion: false,
      observaciones: sale.observaciones ?? '',
      documento_que_se_modifica_tipo: '',
      documento_que_se_modifica_serie: '',
      documento_que_se_modifica_numero: '',
      tipo_de_nota_de_credito: '',
      tipo_de_nota_de_debito: '',
      enviar_automaticamente_a_la_sunat: true,
      enviar_automaticamente_al_cliente: false,
      codigo_unico: doc.id,
      condiciones_de_pago: sale.tipoVenta === 'credito' ? 'Crédito' : 'Contado',
      medio_de_pago: metodoPago,
      placa_vehiculo: '',
      orden_compra_servicio: '',
      tabla_personalizada_codigo: '',
      formato_de_pdf: '',
      items,
    };

    // Factura requiere datos adicionales del emisor
    if (isFactura) {
      payload.serie_documento_relacionado = '';
      payload.numero_documento_relacionado = '';
    }

    return payload;
  }

  /** Envía el comprobante a Nubefact */
  async sendDocument(documentId: string, businessId: string) {
    // Cargar doc con todos los datos necesarios
    const doc = await this.prisma.electronicDocument.findFirst({
      where: { id: documentId, businessId },
      include: {
        customer: true,
        sale: {
          include: {
            items: { include: { product: { select: { nombre: true, codigoInterno: true, igvTipo: true } } } },
            payments: { include: { paymentMethod: { select: { nombre: true } } } },
          },
        },
      },
    });

    if (!doc) throw new BadRequestException('Comprobante no encontrado');

    if (doc.estado === 'aceptado') {
      throw new BadRequestException('El comprobante ya fue aceptado por SUNAT');
    }

    const biz = await this.getBusinessConfig(businessId);
    const payload = this.buildPayload(doc, doc.sale, biz);

    this.logger.log(`Enviando ${doc.numeroCompleto} a Nubefact [${biz.sunatMode}]`);

    // Incrementar intentos de envío
    await this.prisma.electronicDocument.update({
      where: { id: documentId },
      data: { estado: 'enviado', fechaEnvio: new Date(), intentosEnvio: { increment: 1 } },
    });

    const url = `${NUBEFACT_BASE}/${biz.ruc}/${doc.tipo === 'factura' ? 'facturas' : 'boletas'}`;

    try {
      const resp = await axios.post(url, payload, {
        headers: {
          Authorization: `Token ${biz.nubefactToken}`,
          'Content-Type': 'application/json',
        },
        timeout: 30000,
      });

      const data = resp.data;
      this.logger.log(`Respuesta Nubefact: ${JSON.stringify(data)}`);

      // Interpretar respuesta
      const aceptado = data.aceptada_por_sunat === true || data.codigo === '0';
      const nuevoEstado = aceptado ? 'aceptado' : data.codigo === '2' ? 'observado' : 'rechazado';

      const updated = await this.prisma.electronicDocument.update({
        where: { id: documentId },
        data: {
          estado:          nuevoEstado as any,
          hashCpe:         data.hash_cpe ?? null,
          xmlUrl:          data.enlace_del_xml ?? null,
          cdrUrl:          data.enlace_del_cdr ?? null,
          pdfUrl:          data.enlace_del_pdf ?? null,
          respuestaSunat:  data.sunat_description ?? data.mensaje ?? null,
          errorDescripcion: !aceptado ? (data.sunat_description ?? data.descripcion ?? null) : null,
          fechaRespuesta:  new Date(),
        },
      });

      return {
        estado:          updated.estado,
        aceptado,
        sunatDescription: data.sunat_description ?? null,
        hashCpe:          data.hash_cpe ?? null,
        enlacePdf:        data.enlace_del_pdf ?? null,
        enlaceXml:        data.enlace_del_xml ?? null,
        enlaceCdr:        data.enlace_del_cdr ?? null,
        numero:           data.numero ?? doc.numeroCompleto,
      };
    } catch (error: any) {
      // Guardar error
      const errMsg = error?.response?.data?.errors?.[0]?.description
        ?? error?.response?.data?.message
        ?? error?.message
        ?? 'Error al comunicarse con Nubefact';

      await this.prisma.electronicDocument.update({
        where: { id: documentId },
        data: {
          estado: 'rechazado',
          errorDescripcion: errMsg,
          fechaRespuesta: new Date(),
        },
      });

      this.logger.error(`Error Nubefact: ${errMsg}`);
      throw new BadRequestException(`Error OSE: ${errMsg}`);
    }
  }
}