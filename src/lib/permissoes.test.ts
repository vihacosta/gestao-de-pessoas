import { describe, expect, it } from 'vitest'
import { ehEmailInterno, emailInterno, moduloDaRota, modulosDaRota, nivelDe, normalizarUsuario, podeEditar, podeGravar, podeVer, usuarioValido } from './permissoes'

describe('permissões', () => {
  it('administrador pode tudo', () => {
    expect(nivelDe({}, true, 'valores')).toBe('editar')
    expect(podeGravar({}, true, 'funcionarios', undefined, 'remover')).toBe(true)
  })

  it('sem escolha não tem acesso', () => {
    expect(podeVer({}, false, 'ferias')).toBe(false)
    expect(podeVer(null, false, 'ferias')).toBe(false)
  })

  it('ver não permite editar', () => {
    const p = { ferias: 'ver' as const }
    expect(podeVer(p, false, 'ferias')).toBe(true)
    expect(podeEditar(p, false, 'ferias')).toBe(false)
    expect(podeGravar(p, false, 'ferias')).toBe(false)
  })

  it('documento segue o módulo do tipo', () => {
    const p = { ponto: 'editar' as const }
    expect(podeGravar(p, false, 'documentos', { categoria: 'justificativas' })).toBe(true)
    expect(podeGravar(p, false, 'documentos', { categoria: 'ponto_assinado' })).toBe(true)
    expect(podeGravar(p, false, 'documentos', { categoria: 'holerite' })).toBe(false)
  })

  it('só o administrador apaga funcionário', () => {
    expect(podeGravar({ funcionarios: 'editar' }, false, 'funcionarios')).toBe(true)
    expect(podeGravar({ funcionarios: 'editar' }, false, 'funcionarios', undefined, 'remover')).toBe(false)
  })

  it('rotas', () => {
    expect(moduloDaRota('/funcionarios/abc/editar')).toBe('funcionarios')
    expect(moduloDaRota('/ponto/ocorrencias')).toBe('ponto')
    expect(moduloDaRota('/')).toBeNull()
    expect(moduloDaRota('/usuarios')).toBeNull()
  })

  it('a página de ocorrências e bônus abre com qualquer um dos dois módulos', () => {
    expect(modulosDaRota('/ausencias')).toEqual(['ponto', 'ausencias'])
    expect(modulosDaRota('/ponto/ocorrencias')).toEqual(['ponto', 'ausencias'])
    expect(modulosDaRota('/ponto')).toEqual(['ponto'])
    expect(modulosDaRota('/')).toEqual([])
  })

  it('nome de usuário', () => {
    expect(normalizarUsuario('  Maria da Conceição ')).toBe('maria.da.conceicao')
    expect(usuarioValido('maria.silva')).toBe(true)
    expect(usuarioValido('ab')).toBe(false)
    expect(usuarioValido('com espaco')).toBe(false)
    expect(ehEmailInterno(emailInterno('maria'))).toBe(true)
    expect(ehEmailInterno('maria@exemplo.com')).toBe(false)
  })
})
