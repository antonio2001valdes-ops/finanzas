'use client'

import jsPDF from 'jspdf'
import { db } from '@/lib/db-client'
import { formatCurrency, MONTHS_ES } from '@/lib/finance-utils'

// ─── Font loading ─────────────────────────────────────────────────

async function loadFont(url: string): Promise<string> {
  const res = await fetch(url)
  const buf = await res.arrayBuffer()
  let bin = ''
  const bytes = new Uint8Array(buf)
  for (let i = 0; i < bytes.byteLength; i++) bin += String.fromCharCode(bytes[i])
  return btoa(bin)
}

// ─── B&W palette ──────────────────────────────────────────────────

const BLK = 0
const DGRAY = 100
const LGRAY = 200
const WHITE = 255

// ─── Generate Monthly Summary PDF ─────────────────────────────────

export async function generateMonthlySummaryPDF(month: number, year: number): Promise<void> {
  const [fontRegular, fontBold] = await Promise.all([
    loadFont('/fonts/SarasaMonoSC-Regular.ttf'),
    loadFont('/fonts/SarasaMonoSC-Bold.ttf'),
  ])

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })

  doc.addFileToVFS('SM.ttf', fontRegular)
  doc.addFileToVFS('SM-Bold.ttf', fontBold)
  doc.addFont('SM.ttf', 'SM', 'normal')
  doc.addFont('SM-Bold.ttf', 'SM', 'bold')
  doc.setFont('SM')

  const W = doc.internal.pageSize.getWidth()
  const H = doc.internal.pageSize.getHeight()
  const M = 15 // margin
  const CW = W - M * 2
  let y = M

  // ── Fetch data ──
  const sDate = new Date(year, month - 1, 1).toISOString()
  const eDate = new Date(year, month, 0, 23, 59, 59, 999).toISOString()

  const allTx = await db.transactions.toArray()
  const mTx = allTx.filter(t => t.date >= sDate && t.date <= eDate)
  const incTx = mTx.filter(t => t.type === 'income')
  const expTx = mTx.filter(t => t.type === 'expense')

  const totInc = incTx.reduce((s, t) => s + t.amount, 0)
  const totExp = expTx.reduce((s, t) => s + t.amount, 0)
  const bal = totInc - totExp

  const accounts = await db.accounts.toArray()
  const budgets = await db.budgets.where({ month, year }).toArray()
  const savings = await db.savingsGoals.toArray()
  const debts = await db.debts.filter(d => d.status === 'active').toArray()
  const svcBills = (await db.serviceBills.toArray()).filter(b => b.dueDate >= sDate && b.dueDate <= eDate)
  const expCats = await db.expenseCategories.toArray()
  const incCats = await db.incomeCategories.toArray()

  // Aggregations
  const paidBills = svcBills.filter(b => b.paid)
  const unpaidBills = svcBills.filter(b => !b.paid)
  const svcPaid = paidBills.reduce((s, b) => s + b.amount, 0)
  const svcPend = unpaidBills.reduce((s, b) => s + b.amount, 0)
  const debtRem = debts.reduce((s, d) => s + d.remainingAmount, 0)
  const debtOrig = debts.reduce((s, d) => s + d.originalAmount, 0)
  const savTarget = savings.reduce((s, g) => s + g.targetAmount, 0)
  const savCurrent = savings.reduce((s, g) => s + g.currentAmount, 0)
  const savPct = savTarget > 0 ? (savCurrent / savTarget) * 100 : 0

  // Previous month
  const pm = month === 1 ? 12 : month - 1
  const py = month === 1 ? year - 1 : year
  const pS = new Date(py, pm - 1, 1).toISOString()
  const pE = new Date(py, pm, 0, 23, 59, 59, 999).toISOString()
  const pTx = allTx.filter(t => t.date >= pS && t.date <= pE)
  const pInc = pTx.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0)
  const pExp = pTx.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0)

  // Category maps
  const expByCat = new Map<string, number>()
  for (const t of expTx) if (t.categoryId) expByCat.set(t.categoryId, (expByCat.get(t.categoryId) ?? 0) + t.amount)
  const expCatsList = Array.from(expByCat.entries()).map(([id, amt]) => {
    const c = expCats.find(x => x.id === id)
    return { name: c?.name ?? 'Sin categoria', amount: amt }
  }).sort((a, b) => b.amount - a.amount)

  const incByCat = new Map<string, number>()
  for (const t of incTx) if (t.categoryId) incByCat.set(t.categoryId, (incByCat.get(t.categoryId) ?? 0) + t.amount)
  const incCatsList = Array.from(incByCat.entries()).map(([id, amt]) => {
    const c = incCats.find(x => x.id === id)
    return { name: c?.name ?? 'Sin categoria', amount: amt }
  }).sort((a, b) => b.amount - a.amount)

  // ── Helpers ──

  function txt(text: string, x: number, ty: number, gray: number, size: number, bold = false, align: 'left' | 'center' | 'right' = 'left') {
    doc.setFont('SM', bold ? 'bold' : 'normal')
    doc.setFontSize(size)
    doc.setTextColor(gray)
    doc.text(text, x, ty, { align })
  }

  function line(ly: number, gray = LGRAY) {
    doc.setDrawColor(gray)
    doc.setLineWidth(0.15)
    doc.line(M, ly, W - M, ly)
  }

  function need(mm: number) {
    if (y + mm > H - M - 5) {
      doc.addPage()
      y = M
    }
  }

  // ══════════════════════════════════════════════════════════════════
  //  PAGE CONTENT
  // ══════════════════════════════════════════════════════════════════

  // Header
  txt('KHORVEN Finanzas Personales', M, y, BLK, 14, true)
  y += 5
  txt(`Resumen Mensual - ${MONTHS_ES[month - 1]} ${year}`, M, y, DGRAY, 11)
  y += 4
  const now = new Date()
  txt(`Generado: ${now.getDate().toString().padStart(2, '0')}/${(now.getMonth() + 1).toString().padStart(2, '0')}/${now.getFullYear()}`, M, y, DGRAY, 7)
  y += 4
  line(y, BLK)
  y += 6

  // ── Resumen ──
  txt('RESUMEN', M, y, BLK, 10, true)
  y += 5

  const colW = CW / 3
  const rowH = 14

  // 3-column table: Ingresos | Gastos | Balance
  doc.setDrawColor(LGRAY)
  doc.setLineWidth(0.2)
  for (let i = 0; i < 3; i++) {
    doc.rect(M + colW * i, y, colW, rowH)
  }
  txt('Ingresos', M + colW * 0.5, y + 4, DGRAY, 7, false, 'center')
  txt(formatCurrency(totInc), M + colW * 0.5, y + 10, BLK, 9, true, 'center')
  txt('Gastos', M + colW * 1.5, y + 4, DGRAY, 7, false, 'center')
  txt(formatCurrency(totExp), M + colW * 1.5, y + 10, BLK, 9, true, 'center')
  txt('Balance', M + colW * 2.5, y + 4, DGRAY, 7, false, 'center')
  txt(formatCurrency(bal), M + colW * 2.5, y + 10, bal >= 0 ? BLK : BLK, 9, true, 'center')

  y += rowH + 3

  // vs mes anterior
  const pctInc = pInc > 0 ? ((totInc - pInc) / pInc * 100) : 0
  const pctExp = pExp > 0 ? ((totExp - pExp) / pExp * 100) : 0
  txt(`vs mes anterior:  Ingresos ${pctInc >= 0 ? '+' : ''}${pctInc.toFixed(1)}%   Gastos ${pctExp >= 0 ? '+' : ''}${pctExp.toFixed(1)}%`, M, y, DGRAY, 7)
  y += 6

  // ── Servicios / Deudas / Ahorros ──
  line(y)
  y += 5
  txt('SERVICIOS', M, y, BLK, 9, true)
  y += 4
  txt(`Pagado: ${formatCurrency(svcPaid)} (${paidBills.length})   Pendiente: ${formatCurrency(svcPend)} (${unpaidBills.length})`, M, y, DGRAY, 7)
  y += 5

  txt('DEUDAS', M, y, BLK, 9, true)
  y += 4
  txt(`Total: ${formatCurrency(debtOrig)}   Restante: ${formatCurrency(debtRem)}   Pagado: ${formatCurrency(debtOrig - debtRem)}   Activas: ${debts.length}`, M, y, DGRAY, 7)
  y += 5

  txt('AHORROS', M, y, BLK, 9, true)
  y += 4
  txt(`Actual: ${formatCurrency(savCurrent)}   Meta: ${formatCurrency(savTarget)}   Progreso: ${savPct.toFixed(1)}%`, M, y, DGRAY, 7)
  y += 6

  // ── Gastos por Categoria ──
  need(30)
  line(y)
  y += 5
  txt('GASTOS POR CATEGORIA', M, y, BLK, 9, true)
  y += 5

  if (expCatsList.length > 0) {
    const maxAmt = Math.max(...expCatsList.map(c => c.amount), 1)
    for (const c of expCatsList.slice(0, 10)) {
      need(5)
      // Simple bar using grayscale fill
      const barW = (c.amount / maxAmt) * 60
      doc.setFillColor(LGRAY)
      doc.rect(M, y - 2.5, barW, 2.5, 'F')
      txt(c.name, M + 2, y, BLK, 7)
      txt(formatCurrency(c.amount), W - M, y, BLK, 7, true, 'right')
      y += 4.5
    }
  } else {
    txt('Sin gastos este mes', M, y, DGRAY, 7)
    y += 5
  }
  y += 3

  // ── Ingresos por Categoria ──
  need(30)
  line(y)
  y += 5
  txt('INGRESOS POR CATEGORIA', M, y, BLK, 9, true)
  y += 5

  if (incCatsList.length > 0) {
    const maxAmt = Math.max(...incCatsList.map(c => c.amount), 1)
    for (const c of incCatsList.slice(0, 10)) {
      need(5)
      const barW = (c.amount / maxAmt) * 60
      doc.setFillColor(LGRAY)
      doc.rect(M, y - 2.5, barW, 2.5, 'F')
      txt(c.name, M + 2, y, BLK, 7)
      txt(formatCurrency(c.amount), W - M, y, BLK, 7, true, 'right')
      y += 4.5
    }
  } else {
    txt('Sin ingresos este mes', M, y, DGRAY, 7)
    y += 5
  }
  y += 3

  // ── Cuentas ──
  need(25)
  line(y)
  y += 5
  txt('CUENTAS BANCARIAS', M, y, BLK, 9, true)
  y += 5

  const typeLabels: Record<string, string> = {
    savings: 'Ahorro', checking: 'Corriente', cash: 'Efectivo', credit: 'Credito',
  }

  if (accounts.length > 0) {
    for (const a of accounts) {
      need(5)
      txt(`${a.name} (${typeLabels[a.type] ?? a.type})`, M, y, BLK, 7)
      txt(formatCurrency(a.balance), W - M, y, BLK, 7, true, 'right')
      y += 4.5
    }
  } else {
    txt('Sin cuentas', M, y, DGRAY, 7)
    y += 5
  }
  y += 3

  // ── Presupuestos ──
  need(25)
  line(y)
  y += 5
  txt('PRESUPUESTOS', M, y, BLK, 9, true)
  y += 5

  if (budgets.length > 0) {
    for (const b of budgets) {
      need(6)
      const cat = expCats.find(c => c.id === b.categoryId)
      const spent = expTx.filter(t => t.categoryId === b.categoryId).reduce((s, t) => s + t.amount, 0)
      const pct = b.amount > 0 ? (spent / b.amount) * 100 : 0
      const catName = cat?.name ?? 'Sin categoria'

      txt(catName, M, y, BLK, 7)
      txt(`${formatCurrency(spent)} / ${formatCurrency(b.amount)}`, M + 55, y, DGRAY, 7)
      txt(`${pct.toFixed(0)}%`, W - M, y, BLK, 7, true, 'right')

      // Simple progress bar
      const barMax = CW - 10
      const barFill = Math.min(pct, 100) / 100 * barMax
      doc.setFillColor(LGRAY)
      doc.rect(M, y + 1.5, barMax, 1, 'F')
      doc.setFillColor(pct > 100 ? DGRAY : BLK)
      doc.rect(M, y + 1.5, barFill, 1, 'F')

      y += 5
    }
  } else {
    txt('Sin presupuestos', M, y, DGRAY, 7)
    y += 5
  }
  y += 3

  // ── Transacciones ──
  need(25)
  line(y)
  y += 5
  txt('TRANSACCIONES DEL MES', M, y, BLK, 9, true)
  y += 5

  if (mTx.length > 0) {
    // Table header
    doc.setFillColor(LGRAY)
    doc.rect(M, y - 3, CW, 4, 'F')
    txt('Fecha', M + 1, y, BLK, 6, true)
    txt('Descripcion', M + 22, y, BLK, 6, true)
    txt('Tipo', M + 110, y, BLK, 6, true)
    txt('Monto', W - M, y, BLK, 6, true, 'right')
    y += 3

    const recent = [...mTx].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 30)
    for (const tx of recent) {
      need(5)
      const d = new Date(tx.date)
      txt(`${d.getDate().toString().padStart(2, '0')}/${(d.getMonth() + 1).toString().padStart(2, '0')}`, M + 1, y, DGRAY, 6)
      const desc = tx.description.length > 28 ? tx.description.substring(0, 28) + '...' : tx.description
      txt(desc, M + 22, y, BLK, 6)
      txt(tx.type === 'income' ? 'Ingreso' : tx.type === 'expense' ? 'Gasto' : 'Transf.', M + 110, y, DGRAY, 6)
      const sign = tx.type === 'income' ? '+' : tx.type === 'expense' ? '-' : ''
      txt(`${sign}${formatCurrency(tx.amount)}`, W - M, y, BLK, 6, true, 'right')
      y += 4
    }

    y += 2
    txt(`Total: ${mTx.length} transacciones`, M, y, DGRAY, 7)
  } else {
    txt('Sin transacciones este mes', M, y, DGRAY, 7)
  }

  // ── Footer ──
  const pages = doc.getNumberOfPages()
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i)
    doc.setFont('SM', 'normal')
    doc.setFontSize(6)
    doc.setTextColor(DGRAY)
    doc.text('KHORVEN Finanzas Personales v3.2.0', M, H - 8)
    doc.text(`${MONTHS_ES[month - 1]} ${year}  -  Pagina ${i}/${pages}`, W - M, H - 8, { align: 'right' })
    doc.setDrawColor(LGRAY)
    doc.setLineWidth(0.15)
    doc.line(M, H - 12, W - M, H - 12)
  }

  doc.save(`khorven-resumen-${MONTHS_ES[month - 1].toLowerCase()}-${year}.pdf`)
}
