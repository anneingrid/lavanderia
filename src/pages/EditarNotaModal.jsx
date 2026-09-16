
import { useState, useEffect } from 'react'
import { useData } from '../context/DataContext'
import { useToast } from '../context/ToastContext'
import { Button } from '../components/ui/Button'
import { FormField } from '../components/ui/FormField'
import { precoTipoParaCliente, fmt, fmtDate } from '../lib/precos'
import { FileDown, UserRound, LoaderCircle, X, Save } from 'lucide-react'
import { corCliente } from '../lib/precos'

function EditarItemRow({ item, tiposPeca, onChange, onRemove }) {
  return (
    <div className="nota-item-row">
      <select
        value={item.tipoId}
        onChange={(e) => onChange(item._rid, 'tipo', e.target.value)}
      >
        {tiposPeca.map((t) => (
          <option key={t.id} value={t.id}>
            {t.nome}
          </option>
        ))}
      </select>

      <input
        type="number"
        min="1"
        value={item.qtd}
        style={{ textAlign: 'center' }}
        onChange={(e) => onChange(item._rid, 'qtd', e.target.value)}
      />

      <div className="nota-item-subtotal">
        {item.subtotal > 0 ? fmt(item.subtotal) : '—'}
      </div>

      <button
        className="del-btn"
        onClick={() => onRemove(item._rid)}
      >
        ✕
      </button>
    </div>
  )
}

export function EditarNotaModal({ nota, onClose }) {
  const { tiposPeca, clientes, precos, atualizarNota } = useData()
  const { toast } = useToast()
  const [data, setData] = useState('')
  const [obs, setObs] = useState('')
  const [itens, setItens] = useState([])
  const [saving, setSaving] = useState(false)
  const [exporting, setExporting] = useState(false)


  useEffect(() => {
    if (!nota) return

    setData(nota.data || '')
    setObs(nota.obs || '')

    const itensIniciais = (nota.itens || []).map((it) => ({
      _rid: crypto.randomUUID(),
      tipoId: it.tipoId,
      qtd: it.qtd,
      vUnit: it.vUnit,
      subtotal: it.subtotal,
    }))

    setItens(recalc(itensIniciais, nota.data, nota.cliente))
  }, [nota])

  if (!nota) return null

  function recalc(lista, dataNota, nomeCliente) {
    return lista.map((it) => {
      const vUnit = precoTipoParaCliente(
        tiposPeca,
        clientes,
        precos,
        it.tipoId,
        nomeCliente,
        dataNota
      )

      return {
        ...it,
        vUnit,
        subtotal: it.qtd * vUnit,
      }
    })
  }

  function novaLinha() {
    return {
      _rid: crypto.randomUUID(),
      tipoId: tiposPeca[0]?.id || '',
      qtd: 1,
      vUnit: 0,
      subtotal: 0,
    }
  }

  function handleDataChange(v) {
    setData(v)
    setItens((prev) => recalc(prev, v, nota.cliente))
  }

  function handleItemChange(rid, campo, val) {
    setItens((prev) => {
      const next = prev.map((it) => {
        if (it._rid !== rid) return it

        if (campo === 'tipo') {
          return { ...it, tipoId: val }
        }

        if (campo === 'qtd') {
          return {
            ...it,
            qtd: Math.max(1, parseInt(val) || 1),
          }
        }

        return it
      })

      return recalc(next, data, nota.cliente)
    })
  }

  function addLinha() {
    setItens((prev) => recalc(
      [...prev, novaLinha()],
      data,
      nota.cliente
    ))
  }

  function removeLinha(rid) {
    setItens((prev) => prev.filter((it) => it._rid !== rid))
  }

  const total = itens.reduce(
    (s, it) => s + it.subtotal,
    0
  )

  async function handleSalvar() {
    if (!itens.length) {
      alert('Adicione ao menos um item!')
      return
    }

    const itensValidos = itens.filter(
      (it) => it.qtd > 0 && it.tipoId
    )

    if (!itensValidos.length) {
      alert('Preencha os itens!')
      return
    }

    setSaving(true)

    try {
      await atualizarNota(nota.id, {
        data,
        obs,
        itens: itensValidos.map((it) => {
          const t = tiposPeca.find((x) => x.id === it.tipoId)

          return {
            tipoId: it.tipoId,
            tipoNome: t?.nome || '?',
            qtd: it.qtd,
            vUnit: it.vUnit,
            subtotal: it.subtotal,
          }
        }),
        total,
      })

      toast('Nota atualizada! ✏️')
      onClose()
    } catch (e) {
      toast('❌ ' + e.message, true)
    } finally {
      setSaving(false)
    }
  }

  async function exportarPDF() {
    if (exporting) return

    setExporting(true)

    try {
      const { jsPDF } = await import('jspdf')
      const autoTable = (await import('jspdf-autotable')).default

      const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
      })

      const pageWidth = doc.internal.pageSize.getWidth()
      const pageHeight = doc.internal.pageSize.getHeight()

      const margem = 20

      doc.setFillColor(248, 247, 244)
      doc.rect(0, 0, pageWidth, pageHeight, 'F')

      doc.setFillColor(27, 72, 98)
      doc.roundedRect(
        margem,
        18,
        pageWidth - margem * 2,
        34,
        5,
        5,
        'F'
      )

      doc.setTextColor(255, 255, 255)
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(21)
      doc.text('Lavanderia 9 Pérolas', margem + 8, 32)

      doc.setFontSize(10)
      doc.setFont('helvetica', 'normal')
      doc.text(
        'COMPROVANTE DE SERVIÇO',
        margem + 8,
        41
      )

      doc.setTextColor(222, 222, 222)
      doc.setFontSize(9)

      doc.text(
        `Nº ${nota.id}`,
        pageWidth - margem - 8,
        32,
        { align: 'right' }
      )

      doc.text(
        fmtDate(data),
        pageWidth - margem - 8,
        41,
        { align: 'right' }
      )

      let y = 67

      doc.setTextColor(35, 35, 35)
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(9)
      doc.text('CLIENTE', margem, y)

      y += 7

      doc.setFont('helvetica', 'normal')
      doc.setFontSize(13)
      doc.text(nota.cliente || '—', margem, y)

      y += 15

      autoTable(doc, {
        startY: y,
        margin: {
          left: margem,
          right: margem,
        },
        head: [
          [
            'TIPO DE PEÇA',
            'QTD.',
            'VALOR UNIT.',
            'SUBTOTAL',
          ],
        ],
        body: itens.map((it) => {
          const tipo = tiposPeca.find(
            (t) => t.id === it.tipoId
          )

          return [
            tipo?.nome || '?',
            String(it.qtd),
            fmt(it.vUnit),
            fmt(it.subtotal),
          ]
        }),
        theme: 'plain',
        styles: {
          font: 'helvetica',
          fontSize: 9.5,
          textColor: [55, 55, 55],
          cellPadding: 4,
          lineColor: [225, 225, 225],
          lineWidth: 0.2,
        },
        headStyles: {
          font: 'helvetica',
          fontStyle: 'bold',
          fontSize: 8,
          textColor: [110, 110, 110],
          fillColor: [238, 237, 233],
        },
        columnStyles: {
          0: {
            cellWidth: 'auto',
          },
          1: {
            halign: 'center',
            cellWidth: 20,
          },
          2: {
            halign: 'right',
            cellWidth: 32,
          },
          3: {
            halign: 'right',
            cellWidth: 32,
          },
        },
      })

      y = doc.lastAutoTable.finalY + 12

      doc.setDrawColor(220, 220, 220)
      doc.line(margem, y, pageWidth - margem, y)

      y += 13

      doc.setFont('helvetica', 'normal')
      doc.setFontSize(11)
      doc.setTextColor(80, 80, 80)
      doc.text('TOTAL', pageWidth - margem - 55, y)

      doc.setFont('helvetica', 'bold')
      doc.setFontSize(18)
      doc.setTextColor(25, 25, 25)
      doc.text(
        fmt(total),
        pageWidth - margem,
        y,
        { align: 'right' }
      )

      if (obs) {
        y += 20

        doc.setFont('helvetica', 'bold')
        doc.setFontSize(9)
        doc.setTextColor(100, 100, 100)
        doc.text('OBSERVAÇÃO', margem, y)

        y += 7

        doc.setFont('helvetica', 'normal')
        doc.setFontSize(10)
        doc.setTextColor(60, 60, 60)

        const linhasObs = doc.splitTextToSize(
          obs,
          pageWidth - margem * 2
        )

        doc.text(linhasObs, margem, y)
      }

      doc.setFont('helvetica', 'normal')
      doc.setFontSize(8)
      doc.setTextColor(140, 140, 140)

      doc.text(
        'Documento gerado automaticamente. Não é um documento com valor fiscal.',
        margem,
        pageHeight - 15
      )

      doc.text(
        fmtDate(data),
        pageWidth - margem,
        pageHeight - 15,
        { align: 'right' }
      )

      doc.save(
        `nota-${nota.cliente?.replace(/\s+/g, '-').toLowerCase() || nota.id}.pdf`
      )

      toast('PDF salvo com sucesso! 📄')
    } catch (e) {
      console.error(e)
      toast('❌ Não foi possível gerar o PDF.', true)
    } finally {
      setExporting(false)
    }
  }
  const cor = corCliente(nota.cliente)
  return (
    <>
      <div className="modal-overlay" onClick={onClose} />

      <div className="modal-drawer">
        <div className="modal-handle" />

        <div className="modal-drawer-header">
          <span className="modal-drawer-title">
            Editar nota
          </span>
          <button
            className="modal-close-btn"
            onClick={exportarPDF}
            disabled={saving || exporting}
          >
            {exporting ? <LoaderCircle size={16} /> : <FileDown size={16} />}
          </button>
          <button
            className="modal-close-btn"
            onClick={onClose}
          >
            ✕
          </button>
        </div>

        <div
          className="editar-cliente-badge"
          style={{
            backgroundColor: cor.bg,
            color: cor.text,
          }}
        >
          <UserRound size={14} color={cor.text} />

          {nota.cliente}

          <span
            style={{
              marginLeft: 8,
              fontSize: '0.75rem',
              opacity: 0.6,
            }}
          >
            (Não pode ser alterado)
          </span>
        </div>

        <FormField
          label="Data"
          style={{ marginBottom: 12 }}
        >
          <input
            type="date"
            value={data}
            onChange={(e) =>
              handleDataChange(e.target.value)
            }
          />
        </FormField>

        <div className="nota-itens">
          <div className="nota-header-row">
            <span>Tipo de peça</span>
            <span style={{ textAlign: 'center' }}>
              Qtd
            </span>
            <span style={{ textAlign: 'right' }}>
              Subtotal
            </span>
            <span />
          </div>

          {itens.length === 0 && (
            <div
              style={{
                padding: '16px 14px',
                fontSize: '0.84rem',
                color: 'var(--ink-light)',
              }}
            >
              Nenhum item — clique em "+ Adicionar item"
            </div>
          )}

          {itens.map((it) => (
            <EditarItemRow
              key={it._rid}
              item={it}
              tiposPeca={tiposPeca}
              onChange={handleItemChange}
              onRemove={removeLinha}
            />
          ))}
        </div>

        <Button
          variant="ghost"
          size="sm"
          onClick={addLinha}
          style={{ marginBottom: 14 }}
        >
          + Adicionar item
        </Button>

        <div className="nota-total">
          <span>Total:</span>
          <strong>{fmt(total)}</strong>
        </div>

        <FormField
          label="Observação (opcional)"
          style={{ marginTop: 12 }}
        >
          <input
            type="text"
            placeholder="ex: reforço, manchado..."
            value={obs}
            onChange={(e) => setObs(e.target.value)}
          />
        </FormField>

        <div className="modal-drawer-actions">
          <Button
            variant="ghost"
            onClick={onClose}
            disabled={saving || exporting}
          >
            <X size={15} />
            Cancelar
          </Button>

          <Button
            variant="primary"
            onClick={handleSalvar}
            disabled={saving || exporting}
          >
            {saving ? (
              <>
                <LoaderCircle size={15} />
                Salvando...
              </>
            ) : (
              <>
                <Save size={15} />
                Salvar
              </>
            )}
          </Button>
        </div>
      </div>
    </>
  )
}

