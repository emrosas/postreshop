import { db, eq, DisabledDateTimes } from "astro:db";
import type { OrderProduct } from "db/config";

export function checkSaltilloTime(date: string, sucursalId: string): boolean {
  const blockedSucursales = [{ id: "109" }, { id: "520" }, { id: "50" }, { id: "99" }];

  const isBlockedSucursal = blockedSucursales.some(
    (sucursal) => sucursal.id === sucursalId,
  );

  if (isBlockedSucursal) {
    // Parse date parts directly to avoid timezone conversion issues
    const dateParts = date.split("-");
    if (dateParts.length !== 3) {
      throw new Error("Invalid date format");
    }

    const year = parseInt(dateParts[0]);
    const month = parseInt(dateParts[1]) - 1; // Month is 0-indexed in JS Date
    const day = parseInt(dateParts[2]);

    // Create date object with local date parts (no timezone confusion)
    const localDate = new Date(year, month, day);
    const dayOfWeek = localDate.getDay();

    // getDay() returns 0 for Sunday, 1 for Monday, etc.
    if (dayOfWeek === 0) {
      return false;
    }

    return true;
  }

  return true;
}

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
