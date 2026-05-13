import { db, Orders, count, like, asc, desc } from "astro:db";
import type { Params } from "astro";
import type { Order } from "db/config";

export const prerender = false;

export type OrderAPIResponse = {
  orders: Order[];
  totalPages: number;
  currentPage: number;
};

export async function GET({ params, request }: { params: Params; request: Request }) {
  const page = params.page ? parseInt(params.page) : 1;
  const limit = 15;
  const offset = (page - 1) * limit;

  const url = new URL(request.url);
  const fecha = url.searchParams.get("fecha");
  const sort = url.searchParams.get("sort") === "asc" ? "asc" : "desc";

  const orderBy = sort === "asc" ? asc(Orders.fecha) : desc(Orders.fecha);

  const orders = fecha
    ? await db
        .select()
        .from(Orders)
        .where(like(Orders.fecha, `${fecha}%`))
        .orderBy(orderBy)
        .limit(limit)
        .offset(offset)
    : await db
        .select()
        .from(Orders)
        .orderBy(orderBy)
        .limit(limit)
        .offset(offset);

  const totalNumbers = fecha
    ? await db
        .select({ value: count(Orders.id) })
        .from(Orders)
        .where(like(Orders.fecha, `${fecha}%`))
    : await db.select({ value: count(Orders.id) }).from(Orders);

  const response: OrderAPIResponse = {
    orders,
    totalPages: Math.ceil(totalNumbers[0].value / limit),
    currentPage: page,
  };

  return new Response(JSON.stringify(response), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}
