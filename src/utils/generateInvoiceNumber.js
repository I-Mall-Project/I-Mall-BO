// utils/generateInvoiceNumber.js

export const generateInvoiceNumber = async (prisma, brandID, productCode) => {
  const count = await prisma.order.count();
  const padded = String(count + 1).padStart(5, "0");
  return `${brandID}-${productCode}-${padded}`;
};