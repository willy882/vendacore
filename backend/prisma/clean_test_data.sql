-- Limpieza de datos de prueba — VendaCore
-- Orden respeta foreign keys

-- 1. Comprobantes electrónicos
DELETE FROM electronic_documents;

-- 2. Pagos de ventas
DELETE FROM sale_payments;

-- 3. Items de ventas
DELETE FROM sale_items;

-- 4. Movimientos de caja ligados a ventas (y otros movimientos de prueba)
DELETE FROM cash_movements;

-- 5. Sesiones de caja de prueba
DELETE FROM cash_sessions;

-- 6. Ventas
DELETE FROM sales;

-- 7. Movimientos de inventario
DELETE FROM inventory_movements;

-- 8. Items de proformas
DELETE FROM proforma_items;

-- 9. Proformas
DELETE FROM proformas;

-- 10. Items de compras
DELETE FROM purchase_items;

-- 11. Compras
DELETE FROM purchases;

-- 12. Productos
DELETE FROM products;

-- 13. Categorías de productos
DELETE FROM product_categories;
