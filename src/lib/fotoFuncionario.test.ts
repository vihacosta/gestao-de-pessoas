import { describe, expect, it } from 'vitest'
import { recorteCentral } from './fotoFuncionario'

describe('foto do funcionário', () => {
  it('recorta o maior quadrado no centro', () => {
    expect(recorteCentral(1280, 720)).toEqual({ x: 280, y: 0, lado: 720 })
    expect(recorteCentral(720, 1280)).toEqual({ x: 0, y: 280, lado: 720 })
    expect(recorteCentral(500, 500)).toEqual({ x: 0, y: 0, lado: 500 })
  })
})
