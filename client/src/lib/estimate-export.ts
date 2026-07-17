import {
  calculateDelivery,
  getTypeText,
  groupEstimateItems,
  type EstimateResult,
} from "@/lib/estimate-model";

function escapeHtml(value: unknown) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function safeFilePart(value: string) {
  return value.replace(/[\\/:*?"<>|]+/g, "_").replace(/\s+/g, "_").slice(0, 80) || "estimate";
}

export function exportEstimateToExcel(
  estimate: EstimateResult,
  delivery?: ReturnType<typeof calculateDelivery>,
) {
  const rows = groupEstimateItems(estimate.items).map((group) => `
    <tr style="background:#e8eef8;font-weight:bold">
      <td colspan="10">${escapeHtml(group.title)}</td>
      <td>${group.total}</td>
    </tr>
    ${group.items.map((item, index) => `
    <tr>
      <td>${index + 1}</td>
      <td>${escapeHtml(getTypeText(item.type))}</td>
      <td>${escapeHtml(item.name)}</td>
      <td>${escapeHtml(item.model)}</td>
      <td>${item.quantity}</td>
      <td>${item.availableQty}</td>
      <td>${item.unitPrice}</td>
      <td>${item.baseTotal ?? Math.round(item.quantity * item.unitPrice * 100) / 100}</td>
      <td>${item.shiftFactor ?? 1}</td>
      <td>${item.total}</td>
      <td>${escapeHtml(item.reason)}</td>
    </tr>
    `).join("")}
  `).join("");
  const missingRows = estimate.missing.map((item, index) => `
    <tr>
      <td>${index + 1}</td>
      <td>${escapeHtml(item.type || "")}</td>
      <td>${escapeHtml(item.name)}</td>
      <td>${item.quantity}</td>
      <td>${escapeHtml(item.reason)}</td>
    </tr>
  `).join("");
  const html = `
    <!doctype html>
    <html>
      <head><meta charset="utf-8" /></head>
      <body>
        <h2>${escapeHtml(estimate.title)}</h2>
        <p>Дата: ${new Date().toLocaleString("ru-RU")}</p>
        <p>Итого: ${estimate.totals.subtotal}</p>
        ${delivery && delivery.total > 0 ? `
          <p>Доставка: ${delivery.vehicles} авто, ${delivery.distanceKm} км, ${delivery.hours} ч, ${delivery.total}</p>
          <p>Итого с доставкой: ${Math.round((estimate.totals.subtotal + delivery.total) * 100) / 100}</p>
        ` : ""}
        ${estimate.shiftCalculation ? `
          <p>Смены: ${estimate.shiftCalculation.chargeableShifts}; коэффициент: ${estimate.shiftCalculation.chargeFactor}; часы: ${estimate.shiftCalculation.actualHours}</p>
          <table border="1" cellspacing="0" cellpadding="6">
            <thead><tr><th>Сегмент</th><th>Часы</th><th>Смены</th><th>Коэфф.</th><th>Начисление</th></tr></thead>
            <tbody>
              ${estimate.shiftCalculation.segments.map((segment) => `
                <tr>
                  <td>${escapeHtml(segment.label)}</td>
                  <td>${segment.hours}</td>
                  <td>${segment.shifts}</td>
                  <td>${segment.coefficient}</td>
                  <td>${segment.amountFactor}</td>
                </tr>
              `).join("")}
            </tbody>
          </table>
        ` : ""}
        <table border="1" cellspacing="0" cellpadding="6">
          <thead>
            <tr>
              <th>#</th><th>Позиция</th><th>Категория</th><th>Модель</th><th>Кол-во</th><th>Доступно</th><th>Цена</th><th>База</th><th>Коэфф.</th><th>Сумма</th><th>Причина</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
        ${estimate.missing.length ? `
          <h3>Не найдено на складе</h3>
          <table border="1" cellspacing="0" cellpadding="6">
            <thead><tr><th>#</th><th>Имя</th><th>Категория</th><th>Кол-во</th><th>Комментарий</th></tr></thead>
            <tbody>${missingRows}</tbody>
          </table>
        ` : ""}
      </body>
    </html>
  `;
  const blob = new Blob(["\ufeff", html], { type: "application/vnd.ms-excel;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `${safeFilePart(estimate.title)}_${new Date().toISOString().slice(0, 10)}.xls`;
  anchor.click();
  URL.revokeObjectURL(url);
}
