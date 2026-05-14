'use client'

import jsPDF from 'jspdf'
import { db } from '@/lib/db-client'
import { formatCurrency, MONTHS_ES } from '@/lib/finance-utils'

// ─── Load font as base64 ──────────────────────────────────────────

async function loadFontBase64(): Promise<string> {
  const response = await fetch('/fonts/SarasaMonoSC-Regular.ttf')
  const blob = await response.blob()
  const arrayBuffer = await blob.arrayBuffer()
  return arrayBufferToBase64(arrayBuffer)
}

async function loadFontBoldBase64(): Promise<string> {
  const response = await fetch('/fonts/SarasaMonoSC-Bold.ttf')
  const blob = await response.blob()
  const arrayBuffer = await blob.arrayBuffer()
  return arrayBufferToBase64(arrayBuffer)
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  let binary = ''
  const bytes = new Uint8Array(buffer)
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i])
  }
  return btoa(binary)
}

// ─── Neon Colors ──────────────────────────────────────────────────

const COLORS = {
  cyan: [5, 217, 232] as [number, number, number],
  green: [1, 255, 137] as [number, number, number],
  pink: [255, 42, 109] as [number, number, number],
  orange: [255, 140, 0] as [number, number, number],
  purple: [211, 0, 197] as [number, number, number],
  yellow: [249, 240, 2] as [number, number, number],
  bg: [10, 10, 26] as [number, number, number],
  cardBg: [20, 20, 45] as [number, number, number],
  text: [224, 230, 240] as [number, number, number],
  muted: [124, 139, 161] as [number, number, number],
  border: [30, 30, 60] as [number, number, number],
}

// ─── Generate Monthly Summary PDF ─────────────────────────────────

export async function generateMonthlySummaryPDF(month: number, year: number): Promise<void> {
  // Load fonts
  const [fontBase64, fontBoldBase64] = await Promise.all([loadFontBase64(), loadFontBoldBase64()])

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })

  // Register fonts
  doc.addFileToVFS('SarasaMono.ttf', fontBase64)
  doc.addFileToVFS('SarasaMono-Bold.ttf', fontBoldBase64)
  doc.addFont('SarasaMono.ttf', 'SarasaMono', 'normal')
  doc.addFont('SarasaMono-Bold.ttf', 'SarasaMono', 'bold')

  doc.setFont('SarasaMono')

  const pageW = doc.internal.pageSize.getWidth()
  const pageH = doc.internal.pageSize.getHeight()
  const margin = 15
  const contentW = pageW - margin * 2
  let y = 0

  // ── Fetch data ──
  const startDate = new Date(year, month - 1, 1).toISOString()
  const endDate = new Date(year, month, 0, 23, 59, 59, 999).toISOString()

  const allTransactions = await db.transactions.toArray()
  const monthTx = allTransactions.filter(t => t.date >= startDate && t.date <= endDate)
  const incomeTx = monthTx.filter(t => t.type === 'income')
  const expenseTx = monthTx.filter(t => t.type === 'expense')

  const totalIncome = incomeTx.reduce((s, t) => s + t.amount, 0)
  const totalExpenses = expenseTx.reduce((s, t) => s + t.amount, 0)
  const balance = totalIncome - totalExpenses

  const accounts = await db.accounts.toArray()
  const budgets = await db.budgets.where({ month, year }).toArray()
  const savingsGoals = await db.savingsGoals.toArray()
  const debts = await db.debts.filter(d => d.status === 'active').toArray()
  const serviceAccounts = await db.serviceAccounts.toArray()
  const serviceBills = await db.serviceBills.toArray()
  const monthBills = serviceBills.filter(b => b.dueDate >= startDate && b.dueDate <= endDate)
  const recurringPayments = await db.recurringPayments.filter(r => r.isActive).toArray()

  // Categories
  const expCats = await db.expenseCategories.toArray()
  const incCats = await db.incomeCategories.toArray()

  // Expense by category
  const expByCat = new Map<string, number>()
  for (const t of expenseTx) {
    if (t.categoryId) expByCat.set(t.categoryId, (expByCat.get(t.categoryId) ?? 0) + t.amount)
  }
  const expenseByCategory = Array.from(expByCat.entries()).map(([catId, amount]) => {
    const cat = expCats.find(c => c.id === catId)
    return { name: cat?.name ?? 'Sin categoria', icon: cat?.icon ?? '?', amount }
  }).sort((a, b) => b.amount - a.amount)

  // Income by category
  const incByCat = new Map<string, number>()
  for (const t of incomeTx) {
    if (t.categoryId) incByCat.set(t.categoryId, (incByCat.get(t.categoryId) ?? 0) + t.amount)
  }
  const incomeByCategory = Array.from(incByCat.entries()).map(([catId, amount]) => {
    const cat = incCats.find(c => c.id === catId)
    return { name: cat?.name ?? 'Sin categoria', icon: cat?.icon ?? '?', amount }
  }).sort((a, b) => b.amount - a.amount)

  // Previous month
  const prevMonth = month === 1 ? 12 : month - 1
  const prevYear = month === 1 ? year - 1 : year
  const prevStart = new Date(prevYear, prevMonth - 1, 1).toISOString()
  const prevEnd = new Date(prevYear, prevMonth, 0, 23, 59, 59, 999).toISOString()
  const prevTx = allTransactions.filter(t => t.date >= prevStart && t.date <= prevEnd)
  const prevIncome = prevTx.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0)
  const prevExpenses = prevTx.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0)

  // ── Helpers ──
  function setBg() {
    doc.setFillColor(...COLORS.bg)
    doc.rect(0, 0, pageW, pageH, 'F')
  }

  function drawCard(x: number, cardY: number, w: number, h: number, borderColor: [number, number, number]) {
    // Card background
    doc.setFillColor(...COLORS.cardBg)
    doc.setDrawColor(...borderColor)
    doc.setLineWidth(0.3)
    doc.roundedRect(x, cardY, w, h, 2, 2, 'FD')
    // Glow border
    doc.setDrawColor(borderColor[0], borderColor[1], borderColor[2])
    doc.setLineWidth(0.5)
    doc.roundedRect(x, cardY, w, h, 2, 2, 'S')
  }

  function drawText(text: string, x: number, textY: number, color: [number, number, number], size: number, style: 'normal' | 'bold' = 'normal') {
    doc.setFont('SarasaMono', style)
    doc.setFontSize(size)
    doc.setTextColor(...color)
    doc.text(text, x, textY)
  }

  function drawLine(lineY: number, color: [number, number, number] = COLORS.border) {
    doc.setDrawColor(...color)
    doc.setLineWidth(0.2)
    doc.line(margin, lineY, pageW - margin, lineY)
  }

  function checkPageBreak(needed: number): boolean {
    if (y + needed > pageH - margin) {
      doc.addPage()
      setBg()
      y = margin
      return true
    }
    return false
  }

  function pctChange(current: number, previous: number): string {
    if (previous === 0) return current >= 0 ? '+0.0%' : '-0.0%'
    const change = ((current - previous) / Math.abs(previous)) * 100
    return `${change >= 0 ? '+' : ''}${change.toFixed(1)}%`
  }

  // ══════════════════════════════════════════════════════════════════
  // PAGE 1 - COVER + SUMMARY
  // ══════════════════════════════════════════════════════════════════

  setBg()

  // Header decoration - top line
  doc.setFillColor(...COLORS.cyan)
  doc.rect(0, 0, pageW, 1.5, 'F')

  // Logo / Title area
  y = 30
  drawText('KHORVEN', pageW / 2, y, COLORS.cyan, 28, 'bold')
  doc.setFont('SarasaMono', 'normal')
  doc.setFontSize(8)
  doc.setTextColor(...COLORS.muted)
  doc.text('FINANZAS PERSONALES v3.2', pageW / 2, y + 5, { align: 'center' })

  // Decorative line
  y += 12
  doc.setFillColor(...COLORS.cyan)
  doc.rect(margin + 30, y, pageW - margin * 2 - 60, 0.5, 'F')

  // Month / Year title
  y += 10
  drawText(`Resumen Mensual`, pageW / 2, y, COLORS.text, 18, 'bold')
  y += 7
  drawText(`${MONTHS_ES[month - 1]} ${year}`, pageW / 2, y, COLORS.cyan, 14, 'bold')

  // Generation date
  y += 10
  const genDate = new Date()
  drawText(`Generado: ${genDate.getDate().toString().padStart(2, '0')}/${(genDate.getMonth() + 1).toString().padStart(2, '0')}/${genDate.getFullYear()} ${genDate.getHours().toString().padStart(2, '0')}:${genDate.getMinutes().toString().padStart(2, '0')}`, pageW / 2, y, COLORS.muted, 8, 'normal')

  // ── Summary Cards ──
  y += 16
  const cardW = (contentW - 8) / 3
  const cardH = 28

  // Income card
  drawCard(margin, y, cardW, cardH, COLORS.green)
  drawText('INGRESOS', margin + cardW / 2, y + 7, COLORS.muted, 7, 'normal')
  drawText(formatCurrency(totalIncome), margin + cardW / 2, y + 15, COLORS.green, 11, 'bold')
  drawText(pctChange(totalIncome, prevIncome), margin + cardW / 2, y + 21, prevIncome > 0 && totalIncome >= prevIncome ? COLORS.green : COLORS.pink, 7, 'normal')

  // Expenses card
  const card2X = margin + cardW + 4
  drawCard(card2X, y, cardW, cardH, COLORS.pink)
  drawText('GASTOS', card2X + cardW / 2, y + 7, COLORS.muted, 7, 'normal')
  drawText(formatCurrency(totalExpenses), card2X + cardW / 2, y + 15, COLORS.pink, 11, 'bold')
  drawText(pctChange(totalExpenses, prevExpenses), card2X + cardW / 2, y + 21, totalExpenses <= prevExpenses ? COLORS.green : COLORS.pink, 7, 'normal')

  // Balance card
  const card3X = margin + (cardW + 4) * 2
  drawCard(card3X, y, cardW, cardH, COLORS.cyan)
  drawText('BALANCE', card3X + cardW / 2, y + 7, COLORS.muted, 7, 'normal')
  drawText(formatCurrency(balance), card3X + cardW / 2, y + 15, balance >= 0 ? COLORS.cyan : COLORS.pink, 11, 'bold')
  drawText(balance >= 0 ? 'Positivo' : 'Negativo', card3X + cardW / 2, y + 21, balance >= 0 ? COLORS.green : COLORS.pink, 7, 'normal')

  y += cardH + 10

  // ── Services & Debts Summary ──
  const halfW = (contentW - 6) / 2
  const paidBills = monthBills.filter(b => b.paid)
  const unpaidBills = monthBills.filter(b => !b.paid)
  const servicePaid = paidBills.reduce((s, b) => s + b.amount, 0)
  const servicePending = unpaidBills.reduce((s, b) => s + b.amount, 0)
  const totalDebtRemaining = debts.reduce((s, d) => s + d.remainingAmount, 0)
  const totalDebtOriginal = debts.reduce((s, d) => s + d.originalAmount, 0)

  // Services Card
  const svcCardH = 38
  drawCard(margin, y, halfW, svcCardH, COLORS.orange)
  drawText('SERVICIOS', margin + 5, y + 7, COLORS.orange, 9, 'bold')
  drawText(`Total: ${formatCurrency(servicePaid + servicePending)}`, margin + 5, y + 14, COLORS.text, 8, 'normal')
  drawText(`Pagado: ${formatCurrency(servicePaid)}`, margin + 5, y + 20, COLORS.green, 7, 'normal')
  drawText(`Pendiente: ${formatCurrency(servicePending)}`, margin + 5, y + 26, COLORS.pink, 7, 'normal')
  drawText(`${paidBills.length} pagadas / ${unpaidBills.length} pendientes`, margin + 5, y + 32, COLORS.muted, 6, 'normal')

  // Debts Card
  drawCard(margin + halfW + 6, y, halfW, svcCardH, COLORS.pink)
  drawText('DEUDAS', margin + halfW + 11, y + 7, COLORS.pink, 9, 'bold')
  drawText(`Total: ${formatCurrency(totalDebtOriginal)}`, margin + halfW + 11, y + 14, COLORS.text, 8, 'normal')
  drawText(`Restante: ${formatCurrency(totalDebtRemaining)}`, margin + halfW + 11, y + 20, COLORS.orange, 7, 'normal')
  drawText(`Pagado: ${formatCurrency(totalDebtOriginal - totalDebtRemaining)}`, margin + halfW + 11, y + 26, COLORS.green, 7, 'normal')
  drawText(`${debts.length} deuda${debts.length !== 1 ? 's' : ''} activa${debts.length !== 1 ? 's' : ''}`, margin + halfW + 11, y + 32, COLORS.muted, 6, 'normal')

  y += svcCardH + 8

  // ── Savings Summary ──
  const totalSavingsTarget = savingsGoals.reduce((s, g) => s + g.targetAmount, 0)
  const totalSavingsCurrent = savingsGoals.reduce((s, g) => s + g.currentAmount, 0)
  const savingsRate = totalSavingsTarget > 0 ? (totalSavingsCurrent / totalSavingsTarget) * 100 : 0

  drawCard(margin, y, contentW, 20, COLORS.purple)
  drawText('AHORROS', margin + 5, y + 7, COLORS.purple, 9, 'bold')
  drawText(`Actual: ${formatCurrency(totalSavingsCurrent)}`, margin + 5, y + 14, COLORS.text, 8, 'normal')
  drawText(`Meta: ${formatCurrency(totalSavingsTarget)}`, margin + 55, y + 14, COLORS.muted, 8, 'normal')
  drawText(`Progreso: ${savingsRate.toFixed(1)}%`, margin + 110, y + 14, savingsRate >= 50 ? COLORS.green : COLORS.orange, 8, 'normal')
  // Savings bar
  const barX = margin + 5
  const barY2 = y + 17
  const barW2 = contentW - 10
  doc.setFillColor(40, 40, 70)
  doc.roundedRect(barX, barY2, barW2, 1.5, 0.5, 0.5, 'F')
  const fillW = Math.min(savingsRate, 100) / 100 * barW2
  doc.setFillColor(...COLORS.purple)
  doc.roundedRect(barX, barY2, fillW, 1.5, 0.5, 0.5, 'F')

  y += 26

  // ══════════════════════════════════════════════════════════════════
  // PAGE 2 - EXPENSES BY CATEGORY + ACCOUNTS
  // ══════════════════════════════════════════════════════════════════

  // ── Expense by Category ──
  checkPageBreak(60)
  drawLine(y, COLORS.cyan)
  y += 4
  drawText('GASTOS POR CATEGORIA', margin, y, COLORS.pink, 10, 'bold')
  y += 6

  if (expenseByCategory.length > 0) {
    // Table header
    drawText('Categoria', margin, y, COLORS.muted, 7, 'normal')
    drawText('Monto', pageW - margin, y, COLORS.muted, 7, 'normal')
    y += 1
    drawLine(y, COLORS.border)
    y += 4

    const maxExpCat = Math.max(...expenseByCategory.map(c => c.amount), 1)
    for (const cat of expenseByCategory.slice(0, 12)) {
      checkPageBreak(10)
      // Bar
      const barWidth = (cat.amount / maxExpCat) * (contentW * 0.5)
      doc.setFillColor(...COLORS.pink)
      doc.roundedRect(margin, y - 2.5, barWidth, 3, 0.5, 0.5, 'F')

      drawText(`${cat.icon} ${cat.name}`, margin + 2, y, COLORS.text, 7, 'normal')
      drawText(formatCurrency(cat.amount), pageW - margin, y, COLORS.pink, 7, 'bold')
      y += 5
    }
  } else {
    drawText('Sin gastos este mes', margin, y, COLORS.muted, 8, 'normal')
    y += 6
  }

  y += 4

  // ── Income by Category ──
  checkPageBreak(60)
  drawLine(y, COLORS.green)
  y += 4
  drawText('INGRESOS POR CATEGORIA', margin, y, COLORS.green, 10, 'bold')
  y += 6

  if (incomeByCategory.length > 0) {
    drawText('Categoria', margin, y, COLORS.muted, 7, 'normal')
    drawText('Monto', pageW - margin, y, COLORS.muted, 7, 'normal')
    y += 1
    drawLine(y, COLORS.border)
    y += 4

    const maxIncCat = Math.max(...incomeByCategory.map(c => c.amount), 1)
    for (const cat of incomeByCategory.slice(0, 12)) {
      checkPageBreak(10)
      const barWidth = (cat.amount / maxIncCat) * (contentW * 0.5)
      doc.setFillColor(...COLORS.green)
      doc.roundedRect(margin, y - 2.5, barWidth, 3, 0.5, 0.5, 'F')

      drawText(`${cat.icon} ${cat.name}`, margin + 2, y, COLORS.text, 7, 'normal')
      drawText(formatCurrency(cat.amount), pageW - margin, y, COLORS.green, 7, 'bold')
      y += 5
    }
  } else {
    drawText('Sin ingresos este mes', margin, y, COLORS.muted, 8, 'normal')
    y += 6
  }

  y += 6

  // ── Accounts Summary ──
  checkPageBreak(50)
  drawLine(y, COLORS.cyan)
  y += 4
  drawText('CUENTAS BANCARIAS', margin, y, COLORS.cyan, 10, 'bold')
  y += 6

  const typeMap: Record<string, { icon: string; label: string }> = {
    savings: { icon: '🏦', label: 'Ahorro' },
    checking: { icon: '💳', label: 'Corriente' },
    cash: { icon: '💵', label: 'Efectivo' },
    credit: { icon: '💰', label: 'Credito' },
  }

  if (accounts.length > 0) {
    drawText('Cuenta', margin, y, COLORS.muted, 7, 'normal')
    drawText('Tipo', margin + 60, y, COLORS.muted, 7, 'normal')
    drawText('Balance', pageW - margin, y, COLORS.muted, 7, 'normal')
    y += 1
    drawLine(y, COLORS.border)
    y += 4

    for (const acct of accounts) {
      checkPageBreak(8)
      const info = typeMap[acct.type] ?? { icon: '💰', label: acct.type }
      drawText(`${info.icon} ${acct.name}`, margin, y, COLORS.text, 7, 'normal')
      drawText(info.label, margin + 60, y, COLORS.muted, 7, 'normal')
      const balColor = acct.balance >= 0 ? COLORS.green : COLORS.pink
      drawText(formatCurrency(acct.balance), pageW - margin, y, balColor, 7, 'bold')
      y += 5
    }
  } else {
    drawText('Sin cuentas registradas', margin, y, COLORS.muted, 8, 'normal')
    y += 6
  }

  y += 6

  // ── Budget Summary ──
  checkPageBreak(50)
  drawLine(y, COLORS.yellow)
  y += 4
  drawText('PRESUPUESTOS', margin, y, COLORS.yellow, 10, 'bold')
  y += 6

  if (budgets.length > 0) {
    drawText('Categoria', margin, y, COLORS.muted, 7, 'normal')
    drawText('Gastado', margin + 65, y, COLORS.muted, 7, 'normal')
    drawText('Presupuesto', margin + 100, y, COLORS.muted, 7, 'normal')
    drawText('%', pageW - margin, y, COLORS.muted, 7, 'normal')
    y += 1
    drawLine(y, COLORS.border)
    y += 4

    for (const budget of budgets) {
      checkPageBreak(10)
      const cat = expCats.find(c => c.id === budget.categoryId)
      const catName = cat?.name ?? 'Sin categoria'
      const spent = expenseTx
        .filter(t => t.categoryId === budget.categoryId)
        .reduce((s, t) => s + t.amount, 0)
      const pct = budget.amount > 0 ? (spent / budget.amount) * 100 : 0

      drawText(catName, margin, y, COLORS.text, 7, 'normal')
      drawText(formatCurrency(spent), margin + 65, y, pct > 100 ? COLORS.pink : COLORS.text, 7, 'normal')
      drawText(formatCurrency(budget.amount), margin + 100, y, COLORS.muted, 7, 'normal')

      // Percentage badge
      const pctColor = pct > 100 ? COLORS.pink : pct >= 75 ? COLORS.orange : COLORS.green
      drawText(`${pct.toFixed(0)}%`, pageW - margin, y, pctColor, 7, 'bold')

      // Progress bar
      const barMaxW = contentW - 10
      const barFill = Math.min(pct, 100) / 100 * barMaxW
      doc.setFillColor(40, 40, 70)
      doc.roundedRect(margin, y + 1.5, barMaxW, 1.5, 0.5, 0.5, 'F')
      doc.setFillColor(pctColor[0], pctColor[1], pctColor[2])
      doc.roundedRect(margin, y + 1.5, barFill, 1.5, 0.5, 0.5, 'F')

      y += 6
    }
  } else {
    drawText('Sin presupuestos este mes', margin, y, COLORS.muted, 8, 'normal')
    y += 6
  }

  y += 6

  // ══════════════════════════════════════════════════════════════════
  // PAGE 3 - RECENT TRANSACTIONS
  // ══════════════════════════════════════════════════════════════════

  checkPageBreak(50)
  drawLine(y, COLORS.cyan)
  y += 4
  drawText('TRANSACCIONES RECIENTES', margin, y, COLORS.cyan, 10, 'bold')
  y += 6

  if (monthTx.length > 0) {
    // Table header
    drawText('Fecha', margin, y, COLORS.muted, 6, 'normal')
    drawText('Descripcion', margin + 25, y, COLORS.muted, 6, 'normal')
    drawText('Tipo', margin + 110, y, COLORS.muted, 6, 'normal')
    drawText('Monto', pageW - margin, y, COLORS.muted, 6, 'normal')
    y += 1
    drawLine(y, COLORS.border)
    y += 4

    const recent = [...monthTx].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 25)
    for (const tx of recent) {
      checkPageBreak(8)

      // Date
      const txDate = new Date(tx.date)
      const dateStr = `${txDate.getDate().toString().padStart(2, '0')}/${(txDate.getMonth() + 1).toString().padStart(2, '0')}`
      drawText(dateStr, margin, y, COLORS.muted, 6, 'normal')

      // Description (truncated)
      const desc = tx.description.length > 30 ? tx.description.substring(0, 30) + '...' : tx.description
      drawText(desc, margin + 25, y, COLORS.text, 6, 'normal')

      // Type
      const typeLabel = tx.type === 'income' ? 'Ing' : tx.type === 'expense' ? 'Gas' : 'Tra'
      const typeColor = tx.type === 'income' ? COLORS.green : tx.type === 'expense' ? COLORS.pink : COLORS.cyan
      drawText(typeLabel, margin + 110, y, typeColor, 6, 'bold')

      // Amount
      const amtColor = tx.type === 'income' ? COLORS.green : tx.type === 'expense' ? COLORS.pink : COLORS.text
      const amtSign = tx.type === 'income' ? '+' : tx.type === 'expense' ? '-' : ''
      drawText(`${amtSign}${formatCurrency(tx.amount)}`, pageW - margin, y, amtColor, 6, 'bold')

      y += 4.5
    }

    drawLine(y, COLORS.border)
    y += 4
    drawText(`Total: ${monthTx.length} transacciones`, margin, y, COLORS.muted, 7, 'normal')
  } else {
    drawText('Sin transacciones este mes', margin, y, COLORS.muted, 8, 'normal')
  }

  // ── Footer on each page ──
  const totalPages = doc.getNumberOfPages()
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i)
    // Bottom line
    doc.setFillColor(...COLORS.cyan)
    doc.rect(0, pageH - 1.5, pageW, 1.5, 'F')
    // Footer text
    doc.setFont('SarasaMono', 'normal')
    doc.setFontSize(6)
    doc.setTextColor(...COLORS.muted)
    doc.text('KHORVEN Finanzas Personales v3.2.0', margin, pageH - 5)
    doc.text(`Pagina ${i} de ${totalPages}`, pageW - margin, pageH - 5, { align: 'right' })
  }

  // Save
  const fileName = `khorven-resumen-${MONTHS_ES[month - 1].toLowerCase()}-${year}.pdf`
  doc.save(fileName)
}
