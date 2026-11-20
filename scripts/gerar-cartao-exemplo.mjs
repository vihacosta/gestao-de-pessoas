// Gera um "Cartão Ponto" fictício (mesmo layout do Ponto AtecSoft) para testes e demonstração.
// Uso: node scripts/gerar-cartao-exemplo.mjs
import { PDFDocument, StandardFonts } from 'pdf-lib'
import fs from 'node:fs'

const ANO = 2026, MES = 10
const ultimo = new Date(ANO, MES, 0).getDate()
const sem = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sab']
const feriados = [12] // 12/10
const p2 = (n) => String(n).padStart(2, '0')
const hm = (m) => `${p2(Math.floor(Math.abs(m) / 60))}:${p2(Math.abs(m) % 60)}`
const saldoTxt = (m) => `${m < 0 ? '-' : '+'}${String(Math.floor(Math.abs(m) / 60)).padStart(3, '0')}:${p2(Math.abs(m) % 60)}`

// eventos por funcionário: dia -> { faltas, extras, rotulo }
const pessoas = [
  { nome: 'BEATRIZ ROCHA', cpf: '00000000005', adm: '19/03/2026', anterior: 60, eventos: Object.fromEntries([5, 6, 7, 8, 9, 13, 14, 15, 16].map((d) => [d, { rotulo: 'Férias' }])) },
  { nome: 'CARLA MENDES', cpf: '00000000003', adm: '19/06/2026', anterior: 0, eventos: { 20: { rotulo: 'Atesta' } } },
  { nome: 'FERNANDA ALVES', cpf: '00000000006', adm: '19/09/2024', anterior: 120, eventos: { 1: { extras: 60 }, 2: { extras: 60 }, 5: { extras: 120 }, 15: { faltas: 240 } } },
  { nome: 'JULIANA PEREIRA', cpf: '00000000002', adm: '19/09/2025', anterior: 30, eventos: { 9: { faltas: 240 }, 20: { extras: 60 } } },
  { nome: 'MARIANA SOUZA', cpf: '00000000001', adm: '19/01/2025', anterior: 45, eventos: { 6: { faltas: 20 }, 13: { faltas: 15 }, 22: { extras: 30 } } },
  { nome: 'PATRÍCIA LIMA', cpf: '00000000004', adm: '19/05/2024', anterior: 0, eventos: { 2: { faltas: 120 }, 14: { faltas: 90 }, 27: { faltas: 60 } } },
]

const doc = await PDFDocument.create()
const fonte = await doc.embedFont(StandardFonts.Helvetica)
const t = (pg, x, y, s, size = 7) => pg.drawText(s, { x, y, size, font: fonte })

for (const [n, p] of pessoas.entries()) {
  const pg = doc.addPage([595, 842])
  t(pg, 417, 825, 'Ponto AtecSoft - Emissão:'); t(pg, 503, 825, `05/${p2(MES + 1)}/${ANO} 09:54:00`)
  t(pg, 526, 817, 'Página'); t(pg, 559, 817, String(n + 1))
  t(pg, 113, 802, 'Cartão Ponto', 10)
  t(pg, 113, 790, `Período: 01/${p2(MES)}/${ANO} até ${ultimo}/${p2(MES)}/${ANO}`)
  t(pg, 29, 755, 'Empresa:'); t(pg, 89, 755, 'EMPRESA EXEMPLO LTDA')
  t(pg, 29, 743, 'CNPJ:'); t(pg, 89, 743, '00.000.000/0001-00')
  t(pg, 29, 719, 'Funcionário:'); t(pg, 89, 719, p.nome)
  t(pg, 29, 707, 'Identificador:'); t(pg, 89, 707, String(n + 1)); t(pg, 287, 707, 'PIS:'); t(pg, 329, 707, '00000000000'); t(pg, 404, 707, `CPF: ${p.cpf}`)
  t(pg, 29, 695, 'Matrícula:'); t(pg, 89, 695, String(n + 1)); t(pg, 287, 695, `Admissão: ${p.adm}`)
  t(pg, 29, 683, 'Departamento:'); t(pg, 287, 683, 'CTPS:')
  t(pg, 29, 671, 'Função:'); t(pg, 287, 671, 'Grupo:')
  const cab = [[29, 'Dia'], [92, 'Ent.1'], [119, 'Sai.1'], [145, 'Ent.2'], [172, 'Sai.2'], [199, 'Ent.3'], [226, 'Sai.3'], [252, 'CH P'], [279, 'Norm'], [305, 'Faltas'], [332, 'ExUt'], [362, 'ExSab ExDom ExFer'], [448, 'AdNot']]
  for (const [x, s] of cab) t(pg, x, 655, s)
  let y = 628, totFaltas = 0, totExtras = 0
  for (let dia = 1; dia <= ultimo; dia++) {
    const dt = new Date(ANO, MES - 1, dia)
    const fds = dt.getDay() === 0 || dt.getDay() === 6
    const fer = feriados.includes(dia)
    t(pg, 29, y, `${p2(dia)}/${p2(MES)}/${ANO} ${fer ? 'FER' : sem[dt.getDay()]}`)
    if (!fds && !fer) {
      const ch = dt.getDay() === 5 ? 480 : 540
      const ev = p.eventos[dia] ?? {}
      if (ev.rotulo) {
        for (const x of [92, 119, 145, 172]) t(pg, x, y, ev.rotulo)
        t(pg, 252, y, hm(ch)); t(pg, 279, y, hm(ch))
      } else {
        const faltas = ev.faltas ?? 0, extras = ev.extras ?? 0
        const ent = 8 * 60 + Math.min(faltas, 240), sai = 18 * 60 - (dt.getDay() === 5 ? 60 : 0) + extras
        const bat = [ent, 12 * 60, 13 * 60, sai]
        bat.forEach((b, i) => t(pg, [92, 119, 145, 172][i], y, hm(b)))
        t(pg, 252, y, hm(ch)); t(pg, 279, y, hm(ch - faltas))
        if (faltas) t(pg, 305, y, hm(faltas))
        if (extras) t(pg, 332, y, hm(extras))
        totFaltas += faltas; totExtras += extras
      }
    }
    y -= 11.3
  }
  t(pg, 29, 640, 'Totais >>>'); if (totExtras) t(pg, 332, 640, hm(totExtras))
  t(pg, 29, y - 4, 'Informações Banco de Horas:')
  t(pg, 34, y - 18, saldoTxt(p.anterior + totExtras - totFaltas)); t(pg, 68, y - 18, `Saldo total (até ${ultimo}/${p2(MES)}/${ANO})`)
  t(pg, 34, y - 30, saldoTxt(p.anterior)); t(pg, 68, y - 30, `Saldo anterior (até 30/${p2(MES - 1)}/${ANO})`)
  t(pg, 403, y - 60, p.nome)
  t(pg, 32, y - 70, 'Reconheço a exatidão das horas constantes neste Cartão Ponto (EXEMPLO FICTÍCIO)')
}
fs.mkdirSync('docs/exemplos', { recursive: true })
fs.writeFileSync('docs/exemplos/EXEMPLO - cartão ponto outubro 2026.pdf', await doc.save())
console.log('ok')
