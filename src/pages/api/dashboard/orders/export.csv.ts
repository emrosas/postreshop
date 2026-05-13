import { db, Orders, like } from "astro:db";
import type { Order } from "db/config";

export const prerender = false;

function formatCSVDate(dateString: string): string {
  if (!dateString) return "";
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return dateString;
  return date.toLocaleString("es-MX", {
    timeZone: "America/Monterrey",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

function escapeCSV(value: string | number | null | undefined): string {
  if (value == null) return "";
  const str = String(value);
  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export async function GET() {
  const orders = await db
    .select()
    .from(Orders)
    .where(like(Orders.fecha, "2026-05-10%"))
    .orderBy();

  const headers = [
    "ID",
    "Nombre",
    "Teléfono",
    "Email",
    "Estado",
    "Sucursal",
    "Fecha entrega",
    "Pedido creado",
  ];

  const rows = orders.map((order: Order) => [
    escapeCSV(order.id),
    escapeCSV(order.nombre),
    escapeCSV(order.tel),
    escapeCSV(order.email),
    escapeCSV(order.estado),
    escapeCSV(order.sucursal),
    escapeCSV(formatCSVDate(order.fecha)),
    escapeCSV(formatCSVDate(order.creado)),
  ]);

  const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");

  return new Response("﻿" + csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": "attachment; filename=pedidos-10-mayo.csv",
    },
  });
}
