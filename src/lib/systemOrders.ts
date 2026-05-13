import type {
  SpecialOrderDate,
  SystemOrder,
  SystemOrderProduct,
  OrderProduct,
} from "db/config";
import { db, eq, Orders } from "astro:db";
import {
  checkBrand,
  getSentProducts,
  getSpecialIdProducts,
} from "@/pages/api/webhook";
import { actions } from "astro:actions";
import type { APIContext } from "astro";
import { emails } from "@/actions/emails";

export function handleProcessError(message: string, code: number) {
  console.error(`Error: ${message}`);
  return new Response(`Card brand not found in payment method`, {
    status: code,
  });
}

/**
 * Get the type of the special date to check for special IDs
 * @param dateTime - The date and time to check.
 * @returns The type of special order date if found, otherwise null.
 */
export async function checkSpecialDate(
  dateTime: string,): Promise<SpecialOrderDate["type"] | null> {
  const date = dateTime.split("T")[0];
  const specialDates: SpecialOrderDate[] = [
    { id: "1", date: "2025-12-30", type: "1" },
    { id: "2", date: "2025-12-31", type: "2" },
    { id: "3", date: "2026-05-09", type: "1" },
    { id: "4", date: "2026-05-10", type: "2" },
  ];

  const specialDate = specialDates.find((d) => d.date === date);

  if (!specialDate) {
    return null;
  }

  return specialDate.type;
}

export type CardBrandType = "visa" | "mastercard" | "amex";

/**
 * Get the card code based on the card brand.
 * @param cardBrand - The brand of the card used for payment.
 * @returns The card code corresponding to the card brand.
 */
export function getCardCode(cardBrand: CardBrandType) {
  switch (cardBrand) {
    case "visa":
      return "0";
    case "mastercard":
      return "1";
    case "amex":
      return "2";
    default:
      return "0";
  }
}

/**
 * Update an order's status to "Pagado" and assign the corresponding card code.
 * @param orderId - The ID of the order to update.
 * @param cardBrand - The brand of the card used for payment.
 * @returns An object containing the updated order data, any error that occurred, and the email associated with the order.
 */
export const updateOrder = async (
  orderId: number,
  cardBrand: CardBrandType,
): Promise<{
  data: SystemOrder | null;
  error: Error | null;
  email: string | null;
}> => {
  const order = await db
    .update(Orders)
    .set({
      estado: "Pagado",
    })
    .where(eq(Orders.id, orderId))
    .returning();

  if (order.length <= 0) {
    return { data: null, error: Error("Order not found"), email: null };
  }

  // Check the card brand and assign the corresponding code
  const cardCode = getCardCode(cardBrand);

  const productos = JSON.parse(order[0].productos as string) as OrderProduct[];
  const systemProducts = getSentProducts(order[0].sucursal, productos);

  const specialDate = await checkSpecialDate(order[0].fecha);

  let sentProducts: SystemOrderProduct[];

  if (specialDate === "1" || specialDate === "2") {
    const brand = checkBrand(order[0].sucursal);
    sentProducts = await getSpecialIdProducts(
      systemProducts,
      productos,
      brand,
      specialDate,
    );
  } else {
    sentProducts = systemProducts;
  }

  const systemOrder: SystemOrder = {
    productos: sentProducts,
    telefono: order[0].tel,
    nombre: order[0].nombre,
    sucursalId: order[0].sucursal,
    fechaPedido: order[0].fecha,
    direccion: "",
    calle: "",
    numeroExterior: "",
    numeroInterior: "",
    colonia: "",
    municipio: "",
    referencia: "",
    forma_pago_id: cardCode,
  };

  return { data: systemOrder, error: null, email: order[0].email };
};

/**
 * Send an order to the POS system
 * @param order - A formatted SystemOrder object
 * @param orderId - The order ID to send
 * @returns A Promise that has data or error
 */
export const uploadOrderToSystem = async (
  order: SystemOrder,
  orderId: number,
): Promise<{ data: string | null; error: Error | null }> => {
  try {
    const response = await fetch("https://app.rmstech.mx/api/guardar_pedido", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(order),
    });
    // Check if the response is OK
    if (!response.ok) {
      await db
        .update(Orders)
        .set({
          estado: "Error de sistema",
        })
        .where(eq(Orders.id, orderId))
        .returning();
      throw new Error(`HTTP error! Status: ${response.status}`);
    }
    return { data: "No HTTP error", error: null };
  } catch (error) {
    return { data: null, error: error as Error };
  }
};

/**
 * Send an email receipt to the customer after uploading the order to the POS system
 * @param id - The order to send
 * @param email - The address to send the receipt
 */
export async function sendEmailReceipt(
  id: number,
  email: string,
  action: APIContext["callAction"],
) {
  console.log("Sending email receipt to", email);

  const { data, error } = await action(emails.send, {
    id: id,
    email,
  });

  if (error) {
    console.error(error.message);
    return { data: null, error };
  } else if (data) {
    console.log("Email sent to: " + email + " with Order ID: " + id);
    return { data: data.id, error: null };
  }
}
