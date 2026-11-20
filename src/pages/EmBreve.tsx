import { useParams } from 'react-router-dom'
import { Cabecalho, Cartao } from '../components/ui'

const textos: Record<string, [string, string]> = {
  documentos: ['Documentos', 'Modelos da empresa (Word) preenchidos automaticamente com os dados do funcionário na admissão e na demissão, e arquivo dos documentos assinados.'],
  arquivo: ['Holerites e ponto', 'Fotos ou PDFs dos holerites e das folhas de ponto assinados, organizados por funcionário e por mês.'],
  justificativas: ['Justificativas', 'A folha coletiva em que os funcionários assinam o motivo de atrasos e faltas, guardada por data.'],
  ausencias: ['Licenças, atestados e faltas', 'Registro de ausências por tipo da CLT, com o atestado anexado e impacto automático em férias e bonificação.'],
  fechamento: ['Fechamento mensal', 'Pacote com os documentos do mês (holerites, pontos, atestados, justificativas) pronto para enviar à contabilidade.'],
}

export default function EmBreve() {
  const { area = '' } = useParams()
  const [titulo, texto] = textos[area] ?? ['Em breve', '']
  return (
    <>
      <Cabecalho titulo={titulo} />
      <Cartao className="p-6">
        <p className="text-gray-700">{texto}</p>
        <p className="mt-3 text-sm text-gray-500">Esta área está nas próximas etapas.</p>
      </Cartao>
    </>
  )
}
