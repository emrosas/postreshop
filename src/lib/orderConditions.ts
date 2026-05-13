import { db, eq, DisabledDateTimes } from "astro:db";
import type { OrderProduct } from "db/config";

// Function to check if any products are blocked on the selected date
export async function checkBlockedProducts(
  productos: OrderProduct[],
  fecha: string,
): Promise<string[]> {
  const blockedProducts: string[] = [];

  // Get all disabled date entries for the selected date
  const disabledDateEntries = await db
    .select()
    .from(DisabledDateTimes)
    .where(eq(DisabledDateTimes.date, fecha));

  if (disabledDateEntries.length === 0) {
    return blockedProducts; // No restrictions for this date
  }

  // Check if the entire day is disabled
  const dayDisabledEntry = disabledDateEntries.find(
    (entry) => entry.dayDisabled,
  );
  if (dayDisabledEntry) {
    return productos.map((p) => p.stripePriceId);
  }

  // Check if specific products are blocked globally (without sucursal restriction)
  disabledDateEntries.forEach((entry) => {
    if (entry.productos && !entry.sucursales) {
      let blockedProductIds: string[] = [];

      if (Array.isArray(entry.productos)) {
        blockedProductIds = entry.productos as string[];
      } else if (typeof entry.productos === "string") {
        try {
          blockedProductIds = JSON.parse(entry.productos);
        } catch {
          blockedProductIds = [];
        }
      }

      productos.forEach((producto) => {
        if (
          blockedProductIds.includes(producto.stripePriceId) &&
          !blockedProducts.includes(producto.stripePriceId)
        ) {
          blockedProducts.push(producto.stripePriceId);
        }
      });
    }
  });

  return blockedProducts;
}

// Helper function to check if a single product is blocked for a specific sucursal on a specific date
export async function isProductBlockedForSucursal(
  productId: string,
  fecha: string,
  sucursalId: string,
): Promise<{ blocked: boolean; message?: string }> {
  // Get all disabled date entries for the selected date
  const disabledDateEntries = await db
    .select()
    .from(DisabledDateTimes)
    .where(eq(DisabledDateTimes.date, fecha));

  if (disabledDateEntries.length === 0) {
    return { blocked: false }; // No restrictions for this date
  }

  // Check if the entire day is disabled
  const dayDisabledEntry = disabledDateEntries.find(
    (entry) => entry.dayDisabled,
  );
  if (dayDisabledEntry) {
    return {
      blocked: true,
      message: "No hay entregas disponibles para esta fecha",
    };
  }

  // Check for specific blocking rules
  for (const entry of disabledDateEntries) {
    // Parse sucursales array
    let blockedSucursales: string[] = [];
    if (entry.sucursales) {
      if (Array.isArray(entry.sucursales)) {
        blockedSucursales = entry.sucursales as string[];
      } else if (typeof entry.sucursales === "string") {
        try {
          blockedSucursales = JSON.parse(entry.sucursales);
        } catch {
          blockedSucursales = [];
        }
      }
    }

    // Parse productos array
    let blockedProducts: string[] = [];
    if (entry.productos) {
      if (Array.isArray(entry.productos)) {
        blockedProducts = entry.productos as string[];
      } else if (typeof entry.productos === "string") {
        try {
          blockedProducts = JSON.parse(entry.productos);
        } catch {
          blockedProducts = [];
        }
      }
    }

    // Case 1: Both sucursales and productos specified - block only if BOTH match
    if (blockedSucursales.length > 0 && blockedProducts.length > 0) {
      if (
        blockedSucursales.includes(sucursalId) &&
        blockedProducts.includes(productId)
      ) {
        return {
          blocked: true,
          message:
            "Un producto no está disponible para la sucursal seleccionada en esta fecha",
        };
      }
    }
    // Case 2: Only sucursales specified - block entire sucursal
    else if (blockedSucursales.length > 0 && blockedProducts.length === 0) {
      if (blockedSucursales.includes(sucursalId)) {
        return {
          blocked: true,
          message:
            "Esta sucursal no está disponible para la fecha seleccionada",
        };
      }
    }
    // Case 3: Only productos specified - block products globally
    else if (blockedSucursales.length === 0 && blockedProducts.length > 0) {
      if (blockedProducts.includes(productId)) {
        return {
          blocked: true,
          message: "Un producto no está disponible en esta fecha",
        };
      }
    }
  }

  return { blocked: false };
}

// Function to get all blocking rules for a specific date
export async function getBlockingRulesForDate(fecha: string): Promise<{
  dayDisabled: boolean;
  entries: Array<{
    sucursales: string[];
    productos: string[];
    timeRestrictions?: string;
  }>;
} | null> {
  // Get all disabled date entries for the selected date
  const disabledDateEntries = await db
    .select()
    .from(DisabledDateTimes)
    .where(eq(DisabledDateTimes.date, fecha));

  if (disabledDateEntries.length === 0) {
    return null; // No restrictions for this date
  }

  const dayDisabled = disabledDateEntries.some((entry) => entry.dayDisabled);
  const entries: Array<{
    sucursales: string[];
    productos: string[];
    timeRestrictions?: string;
  }> = [];

  disabledDateEntries.forEach((entry) => {
    if (entry.dayDisabled) return; // Skip day disabled entries

    // Parse sucursales array
    let sucursales: string[] = [];
    if (entry.sucursales) {
      if (Array.isArray(entry.sucursales)) {
        sucursales = entry.sucursales as string[];
      } else if (typeof entry.sucursales === "string") {
        try {
          sucursales = JSON.parse(entry.sucursales);
        } catch {
          sucursales = [];
        }
      }
    }

    // Parse productos array
    let productos: string[] = [];
    if (entry.productos) {
      if (Array.isArray(entry.productos)) {
        productos = entry.productos as string[];
      } else if (typeof entry.productos === "string") {
        try {
          productos = JSON.parse(entry.productos);
        } catch {
          productos = [];
        }
      }
    }

    entries.push({
      sucursales,
      productos,
      timeRestrictions: entry.time || undefined,
    });
  });

  return {
    dayDisabled,
    entries,
  };
}

// Function to check if any products are blocked for a specific sucursal on the selected date
export async function checkBlockedProductsForSucursal(
  productos: OrderProduct[],
  fecha: string,
  sucursalId: string,
): Promise<{ blockedProducts: string[]; messages: string[] }> {
  const blockedProducts: string[] = [];
  const messages: string[] = [];

  // Get all disabled date entries for the selected date
  const disabledDateEntries = await db
    .select()
    .from(DisabledDateTimes)
    .where(eq(DisabledDateTimes.date, fecha));

  if (disabledDateEntries.length === 0) {
    return { blockedProducts, messages }; // No restrictions for this date
  }

  // Check if the entire day is disabled
  const dayDisabledEntry = disabledDateEntries.find(
    (entry) => entry.dayDisabled,
  );
  if (dayDisabledEntry) {
    return {
      blockedProducts: productos.map((p) => p.stripePriceId),
      messages: ["No hay entregas disponibles para esta fecha"],
    };
  }

  // Check each product against blocking rules
  productos.forEach((producto) => {
    for (const entry of disabledDateEntries) {
      // Parse sucursales array
      let blockedSucursales: string[] = [];
      if (entry.sucursales) {
        if (Array.isArray(entry.sucursales)) {
          blockedSucursales = entry.sucursales as string[];
        } else if (typeof entry.sucursales === "string") {
          try {
            blockedSucursales = JSON.parse(entry.sucursales);
          } catch {
            blockedSucursales = [];
          }
        }
      }

      // Parse productos array
      let blockedProductsInEntry: string[] = [];
      if (entry.productos) {
        if (Array.isArray(entry.productos)) {
          blockedProductsInEntry = entry.productos as string[];
        } else if (typeof entry.productos === "string") {
          try {
            blockedProductsInEntry = JSON.parse(entry.productos);
          } catch {
            blockedProductsInEntry = [];
          }
        }
      }

      // Case 1: Both sucursales and productos specified - block only if BOTH match
      if (blockedSucursales.length > 0 && blockedProductsInEntry.length > 0) {
        if (
          blockedSucursales.includes(sucursalId) &&
          blockedProductsInEntry.includes(producto.stripePriceId)
        ) {
          if (!blockedProducts.includes(producto.stripePriceId)) {
            blockedProducts.push(producto.stripePriceId);
            messages.push(
              "Algunos productos no están disponibles para la sucursal seleccionada en esta fecha",
            );
          }
          break;
        }
      }
      // Case 2: Only sucursales specified - block entire sucursal
      else if (
        blockedSucursales.length > 0 &&
        blockedProductsInEntry.length === 0
      ) {
        if (blockedSucursales.includes(sucursalId)) {
          if (!blockedProducts.includes(producto.stripePriceId)) {
            blockedProducts.push(producto.stripePriceId);
            messages.push(
              "Esta sucursal no está disponible para la fecha seleccionada",
            );
          }
          break;
        }
      }
      // Case 3: Only productos specified - block products globally
      else if (
        blockedSucursales.length === 0 &&
        blockedProductsInEntry.length > 0
      ) {
        if (blockedProductsInEntry.includes(producto.stripePriceId)) {
          if (!blockedProducts.includes(producto.stripePriceId)) {
            blockedProducts.push(producto.stripePriceId);
            messages.push(
              "Algunos productos no están disponibles en esta fecha",
            );
          }
          break;
        }
      }
    }
  });

  return { blockedProducts, messages: [...new Set(messages)] }; // Remove duplicate messages
}
/**
 * Check to see if the order contains a Gift Cake and is on a Pasteleria Sucursal.
 *
 * @param products - Array of products in the order
 * @param sucursalId - ID of the sucursal (branch) where the order is being placed
 */
export const checkGiftOnPasteleria = async (
  products: OrderProduct[],
  sucursalId: string,
): Promise<boolean> => {
  const sucursalesPasteleria = ["520", "536"];
  const giftProducts = products.filter((p) => p.presentacion === "gift");
  if (giftProducts.length === 0) {
    return true;
  }

  if (!sucursalesPasteleria.includes(sucursalId) && giftProducts.length > 0) {
    return false;
  }

  return true;
};

/**
 * This function checks if an order is being placed on a Saturday to be picked up on the day after (Sunday) at a Saltillo Sucursal.
 * @param date
 * @param sucursalId
 */
export function checkSaltilloOnSaturday(
  fecha: string,
  sucursal: string,
): boolean {
  const isSaltillo = SUCURSALES_SALTILLO.includes(sucursal);

  if (!isSaltillo) return true;

  const today = new Date();
  const isSaturday = today.getDay() === 6;

  if (!isSaturday) return true;

  const dateStringToDate = new Date(fecha);

  const isOrderForSunday = dateStringToDate.getDay() === 0;

  if (isOrderForSunday) return false;

  return true;
}

export const SUCURSALES_SALTILLO = ["50", "109", "520", "536"];
export const SUCURSALES_CIERRE9 = ["50", "109", "520", "536"];
