import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import { calcLancValor, saldoCliente, fmtDate, MESES } from './precos'

function formatMoney(value) {
    return new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL',
    }).format(value || 0)
}

function formatDataExtensa(data) {
    if (!data) return ''

    const [y, m, d] = data.split('-')
    return `${d}/${m}/${y}`
}

function getSemanas(y, m) {
    const semanas = []
    const ultimoDia = new Date(y, m + 1, 0).getDate()

    let dia = 1

    while (dia <= ultimoDia) {
        const inicio = `${y}-${String(m + 1).padStart(2, '0')}-${String(dia).padStart(2, '0')}`
        const fimDia = Math.min(dia + 6, ultimoDia)
        const fim = `${y}-${String(m + 1).padStart(2, '0')}-${String(fimDia).padStart(2, '0')}`

        semanas.push({
            s: inicio,
            e: fim,
        })

        dia += 7
    }

    return semanas
}

function agruparPorDia(lancamentos, pagamentos) {
    const dias = {}

    lancamentos.forEach((l) => {
        if (!dias[l.data]) {
            dias[l.data] = {
                lancamentos: [],
                pagamentos: [],
            }
        }

        dias[l.data].lancamentos.push(l)
    })

    pagamentos.forEach((p) => {
        if (!dias[p.data]) {
            dias[p.data] = {
                lancamentos: [],
                pagamentos: [],
            }
        }

        dias[p.data].pagamentos.push(p)
    })

    return Object.entries(dias)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([data, registros]) => ({
            data,
            ...registros,
        }))
}

function descricaoLancamentos(lancamentos) {
    const itens = []

    lancamentos.forEach((l) => {
        if (l.itens?.length) {
            l.itens.forEach((it) => {
                itens.push(`${it.qtd} ${it.tipoNome}`)
            })
        } else if (l.qtd) {
            itens.push(`${l.qtd} peças`)
        }
    })

    return itens.join(' | ')
}

function totalLancamentos(lancamentos) {
    return lancamentos.reduce(
        (total, l) => total + calcLancValor(l),
        0
    )
}

function totalPagamentos(pagamentos) {
    return pagamentos.reduce(
        (total, p) => total + (p.valor || 0),
        0
    )
}

function desenharCabecalho(doc, paginaWidth, cliente, mes, ano, inicio, fim) {
    doc.setFillColor(27, 72, 98)
    doc.roundedRect(15, 15, paginaWidth - 30, 38, 5, 5, 'F')

    doc.setTextColor(248, 247, 244)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(20)
    doc.text('LAVANDERIA 9 PÉROLAS', 23, 29)

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9)
    doc.text('RELATÓRIO MENSAL', 23, 39)

    doc.setFontSize(12)
    doc.text(
        `${MESES[mes]} ${ano}`,
        paginaWidth - 23,
        29,
        { align: 'right' }
    )

    doc.setFontSize(8)
    doc.text(
        `Gerado em ${formatDataExtensa(new Date().toISOString().slice(0, 10))}`,
        paginaWidth - 23,
        39,
        { align: 'right' }
    )

    doc.setTextColor(45, 45, 45)

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(9)
    doc.text('CLIENTE', 15, 67)

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(14)
    doc.text(cliente || 'Todos os clientes', 15, 75)

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(8)
    doc.setTextColor(120, 120, 120)
    doc.text('PERÍODO', paginaWidth - 15, 67, {
        align: 'right',
    })

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(10)
    doc.setTextColor(45, 45, 45)
    doc.text(
        `${formatDataExtensa(inicio)} até ${formatDataExtensa(fim)}`,
        paginaWidth - 15,
        75,
        { align: 'right' }
    )
}

function desenharSemana(doc, semana, numero, lancamentos, pagamentos, y) {
    const pageWidth = doc.internal.pageSize.getWidth()

    const totalLanc = totalLancamentos(lancamentos)
    const totalPag = totalPagamentos(pagamentos)

    doc.setFillColor(239, 238, 234)
    doc.roundedRect(
        15,
        y,
        pageWidth - 30,
        14,
        3,
        3,
        'F'
    )

    doc.setTextColor(35, 35, 35)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(10)

    doc.text(
        `SEMANA ${numero}`,
        21,
        y + 9
    )

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    doc.setTextColor(110, 110, 110)

    doc.text(
        `${formatDataExtensa(semana.s)} – ${formatDataExtensa(semana.e)}`,
        pageWidth - 21,
        y + 9,
        { align: 'right' }
    )

    y += 18

    const dias = agruparPorDia(lancamentos, pagamentos)

    const rows = dias.map((dia) => {
        const descricao = descricaoLancamentos(dia.lancamentos)

        const lancado = totalLancamentos(dia.lancamentos)
        const recebido = totalPagamentos(dia.pagamentos)

        let texto = descricao || ''

        if (dia.pagamentos.length) {
            const pagamentosTexto = dia.pagamentos
                .map((p) => {
                    const obs = p.obs ? ` — ${p.obs}` : ''
                    return `Recebido ${formatMoney(p.valor)}${obs}`
                })
                .join('\n')

            texto += texto ? `\n${pagamentosTexto}` : pagamentosTexto
        }

        return [
            formatDataExtensa(dia.data),
            texto || '—',
            lancado > 0 ? formatMoney(lancado) : '—',
            recebido > 0 ? formatMoney(recebido) : '—',
        ]
    })

    if (!rows.length) {
        rows.push([
            `${formatDataExtensa(semana.s)} – ${formatDataExtensa(semana.e)}`,
            'Nenhum lançamento ou recebimento nesta semana.',
            '—',
            '—',
        ])
    }

    autoTable(doc, {
        startY: y,
        margin: {
            left: 15,
            right: 15,
        },
        head: [
            [
                'DATA',
                'MOVIMENTAÇÕES',
                'LANÇADO',
                'RECEBIDO',
            ],
        ],
        body: rows,
        theme: 'plain',
        styles: {
            font: 'helvetica',
            fontSize: 8.5,
            textColor: [55, 55, 55],
            cellPadding: 4,
            valign: 'middle',
            lineColor: [225, 225, 225],
            lineWidth: 0.2,
        },
        headStyles: {
            font: 'helvetica',
            fontStyle: 'bold',
            fontSize: 7.5,
            textColor: [115, 115, 115],
            fillColor: [248, 247, 244],
        },
        columnStyles: {
            0: {
                cellWidth: 27,
            },
            1: {
                cellWidth: 'auto',
            },
            2: {
                cellWidth: 31,
                halign: 'right',
            },
            3: {
                cellWidth: 31,
                halign: 'right',
            },
        },
        didParseCell(data) {
            if (data.section === 'body') {
                if (data.column.index === 2 && data.cell.raw !== '—') {
                    data.cell.styles.textColor = [180, 90, 70]
                }

                if (data.column.index === 3 && data.cell.raw !== '—') {
                    data.cell.styles.textColor = [76, 125, 92]
                }
            }
        },
    })

    y = doc.lastAutoTable.finalY + 7

    doc.setFontSize(8)
    doc.setFont('helvetica', 'normal')

    doc.setTextColor(180, 90, 70)
    doc.text(
        `Lançado: ${formatMoney(totalLanc)}`,
        15,
        y
    )

    doc.setTextColor(76, 125, 92)
    doc.text(
        `Recebido: ${formatMoney(totalPag)}`,
        75,
        y
    )

    return y + 13
}

function desenharResumoFinal(doc, totalLancado, totalRecebido, saldo) {
    const pageWidth = doc.internal.pageSize.getWidth()
    const pageHeight = doc.internal.pageSize.getHeight()

    let y = doc.lastAutoTable?.finalY
        ? doc.lastAutoTable.finalY + 18
        : 80

    if (y > pageHeight - 80) {
        doc.addPage()

        doc.setFillColor(248, 247, 244)
        doc.rect(0, 0, pageWidth, pageHeight, 'F')

        y = 25
    }

    doc.setDrawColor(220, 220, 220)
    doc.line(15, y, pageWidth - 15, y)

    y += 14

    doc.setTextColor(45, 45, 45)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(11)
    doc.text('RESUMO DO PERÍODO', 15, y)

    y += 12

    const boxWidth = (pageWidth - 45) / 3
    const boxHeight = 29

    const boxes = [
        {
            x: 15,
            label: 'TOTAL LANÇADO',
            value: totalLancado,
            color: [180, 90, 70],
            background: [250, 239, 235],
        },
        {
            x: 15 + boxWidth + 7.5,
            label: 'TOTAL RECEBIDO',
            value: totalRecebido,
            color: [76, 125, 92],
            background: [237, 246, 239],
        },
        {
            x: 15 + (boxWidth + 7.5) * 2,
            label: 'SALDO DEVEDOR',
            value: saldo,
            color: saldo > 0.01
                ? [180, 90, 70]
                : [76, 125, 92],
            background: saldo > 0.01
                ? [250, 239, 235]
                : [237, 246, 239],
        },
    ]

    boxes.forEach((box) => {
        doc.setFillColor(
            box.background[0],
            box.background[1],
            box.background[2]
        )

        doc.roundedRect(
            box.x,
            y,
            boxWidth,
            boxHeight,
            4,
            4,
            'F'
        )

        doc.setTextColor(110, 110, 110)
        doc.setFont('helvetica', 'bold')
        doc.setFontSize(7)

        doc.text(
            box.label,
            box.x + 6,
            y + 9
        )

        doc.setTextColor(
            box.color[0],
            box.color[1],
            box.color[2]
        )

        doc.setFontSize(13)

        doc.text(
            formatMoney(box.value),
            box.x + 6,
            y + 21
        )
    })

    y += boxHeight + 14

    doc.setTextColor(130, 130, 130)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7.5)

    doc.text(
        'Relatório gerado pela Lavanderia 9 Pérolas.',
        15,
        pageHeight - 15
    )

    doc.text(
        'Valores calculados a partir dos lançamentos e recebimentos registrados.',
        pageWidth - 15,
        pageHeight - 15,
        {
            align: 'right',
        }
    )
}

export async function gerarRelatorioMensalPDF({
    lancamentos,
    pagamentos,
    lancamentosTodos,
    pagamentosTodos,
    cliente = '',
    ano,
    mes,
    dataFim,
}) {
    const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
    })

    const pageWidth = doc.internal.pageSize.getWidth()
    const pageHeight = doc.internal.pageSize.getHeight()

    const inicio = `${ano}-${String(mes + 1).padStart(2, '0')}-01`

    const ultimoDiaMes = new Date(
        ano,
        mes + 1,
        0
    ).getDate()

    const fim = dataFim || `${ano}-${String(mes + 1).padStart(2, '0')}-${String(ultimoDiaMes).padStart(2, '0')}`

    const semanas = getSemanas(ano, mes)

    const totalLancado = totalLancamentos(lancamentos)
    const totalRecebido = totalPagamentos(pagamentos)

    const saldo = cliente
        ? saldoCliente(
            lancamentosTodos,
            pagamentosTodos,
            cliente,
            fim
        )
        : totalLancado - totalRecebido

    desenharCabecalho(
        doc,
        pageWidth,
        cliente,
        mes,
        ano,
        inicio,
        fim
    )

    let y = 91

    semanas.forEach((semana, index) => {
        const ls = lancamentos.filter(
            (l) => l.data >= semana.s && l.data <= semana.e
        )

        const ps = pagamentos.filter(
            (p) => p.data >= semana.s && p.data <= semana.e
        )

        const estimativaAltura = 45 + (ls.length + ps.length) * 7

        if (y + estimativaAltura > pageHeight - 30) {
            doc.addPage()

            doc.setFillColor(248, 247, 244)
            doc.rect(0, 0, pageWidth, pageHeight, 'F')

            y = 22
        }

        y = desenharSemana(
            doc,
            semana,
            index + 1,
            ls,
            ps,
            y
        )
    })

    const ultimaTabelaY = doc.lastAutoTable?.finalY || y

    if (ultimaTabelaY + 70 > pageHeight - 15) {
        doc.addPage()

        doc.setFillColor(248, 247, 244)
        doc.rect(0, 0, pageWidth, pageHeight, 'F')
    }

    desenharResumoFinal(
        doc,
        totalLancado,
        totalRecebido,
        saldo
    )

    const nomeCliente = cliente
        ? cliente.replace(/\s+/g, '-').toLowerCase()
        : 'todos-clientes'

    const nomeMes = MESES[mes]
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')

    doc.save(
        `relatorio-${nomeCliente}-${nomeMes}-${ano}.pdf`
    )
}


