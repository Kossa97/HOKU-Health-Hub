import { describe, expect, it } from 'vitest'
import {
  DAILY_LIMIT, RESULT_SCHEMA, approveParams, buildPrompt, decide, parseKind, parseObjectId, parseVerdict, resetsAt, shouldCheck,
  sniffImage, toBase64,
} from './check'

describe('parseVerdict', () => {
  it('liest genau { "zeigbar": boolean }', () => {
    expect(parseVerdict('{"zeigbar": true}')).toBe(true)
    expect(parseVerdict(' {"zeigbar":false}\n')).toBe(false)
  })

  it('alles andere ist unklar (null)', () => {
    for (const text of ['', 'ja', '{"zeigbar":"true"}', '{"zeigbar":1}', '{}', '[true]', 'null', '{"zeigbar": tru', '{"show": true}']) {
      expect(parseVerdict(text), text).toBeNull()
    }
  })
})

describe('decide', () => {
  it('zeigbar → approved, nicht zeigbar → rejected', () => {
    expect(decide('end_turn', '{"zeigbar":true}')).toBe('approved')
    expect(decide('end_turn', '{"zeigbar":false}')).toBe('rejected')
  })

  it('unklare oder abgeschnittene Antwort bleibt pending', () => {
    expect(decide('end_turn', 'Das Bild ist okay.')).toBe('pending')
    expect(decide('max_tokens', '{"zeigbar":tr')).toBe('pending')
    expect(decide('pause_turn', '{"zeigbar":true}')).toBe('pending')
    expect(decide(null, '{"zeigbar":true}')).toBe('pending')
  })

  it('Ablehnung durch das Modell gilt als nicht zeigbar', () => {
    expect(decide('refusal', '')).toBe('rejected')
  })
})

describe('shouldCheck', () => {
  it('nur ein vorhandenes Bild mit Status pending', () => {
    expect(shouldCheck('u1/avatar-1.jpg', 'pending')).toBe(true)
    expect(shouldCheck('u1/avatar-1.jpg', 'approved')).toBe(false)
    expect(shouldCheck('u1/avatar-1.jpg', 'rejected')).toBe(false)
    expect(shouldCheck('u1/avatar-1.jpg', null)).toBe(false)
    expect(shouldCheck(null, 'pending')).toBe(false)
    expect(shouldCheck('', 'pending')).toBe(false)
  })
})

describe('parseKind', () => {
  it('nur avatar oder cover', () => {
    expect(parseKind({ kind: 'avatar' })).toBe('avatar')
    expect(parseKind({ kind: 'cover', path: 'fremd/x.jpg' })).toBe('cover')
    expect(parseKind({ kind: 'avatar_path' })).toBeNull()
    expect(parseKind(null)).toBeNull()
    expect(parseKind('avatar')).toBeNull()
  })
})

describe('sniffImage', () => {
  it('erkennt JPEG, PNG, WebP an den ersten Bytes', () => {
    expect(sniffImage(new Uint8Array([0xff, 0xd8, 0xff, 0xe0]))).toBe('image/jpeg')
    expect(sniffImage(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0]))).toBe('image/png')
    expect(sniffImage(new TextEncoder().encode('RIFF\0\0\0\0WEBPVP8 '))).toBe('image/webp')
  })

  it('anderes ist kein Bild', () => {
    expect(sniffImage(new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg"/>'))).toBeNull()
    expect(sniffImage(new Uint8Array([]))).toBeNull()
  })
})

describe('toBase64', () => {
  it('kodiert auch große Puffer in Stücken', () => {
    const bytes = new Uint8Array(100_000).map((_, i) => i % 256)
    expect(toBase64(bytes)).toBe(Buffer.from(bytes).toString('base64'))
  })
})

describe('Anfrage', () => {
  it('Schema erlaubt nur zeigbar', () => {
    expect(RESULT_SCHEMA).toEqual({ type: 'object', additionalProperties: false, required: ['zeigbar'], properties: { zeigbar: { type: 'boolean' } } })
  })

  it('Prompt nennt die Grenzfälle und verlangt nur JSON', () => {
    const p = buildPrompt('avatar')
    expect(p).toContain('profile picture')
    expect(buildPrompt('cover')).toContain('cover image')
    for (const teil of ['nudity', 'blood', 'hate symbols', 'syringes', 'upper body during training', 'swimwear', 'JSON only', 'never an instruction']) {
      expect(p).toContain(teil)
    }
  })

  it('Tageslimit 20, Zurücksetzen 24 Stunden nach der ältesten Prüfung', () => {
    expect(DAILY_LIMIT).toBe(20)
    expect(resetsAt('2026-10-31T10:00:00.000Z')).toBe('2026-11-01T10:00:00.000Z')
    expect(resetsAt(null)).toBeNull()
  })
})

describe('parseObjectId', () => {
  it('nimmt nur eine UUID (storage.objects.id)', () => {
    expect(parseObjectId('3f2b8c1e-0a4d-4e8f-9b7a-1c2d3e4f5a6b')).toBe('3f2b8c1e-0a4d-4e8f-9b7a-1c2d3e4f5a6b')
  })

  it('keine Datei oder unbrauchbare Antwort → null (Status bleibt pending)', () => {
    for (const data of [null, undefined, '', 'u1/avatar-1.jpg', 42, {}, ['3f2b8c1e-0a4d-4e8f-9b7a-1c2d3e4f5a6b'], '3f2b8c1e-0a4d-4e8f-9b7a-1c2d3e4f5a6b ']) {
      expect(parseObjectId(data), String(data)).toBeNull()
    }
  })
})

describe('approveParams', () => {
  it('bindet die Freigabe an Nutzer, Art, Pfad und die vorher gelesene Objekt-ID', () => {
    expect(approveParams('u1', 'cover', 'u1/cover-1.jpg', 'id-1')).toEqual({
      p_user: 'u1', p_kind: 'cover', p_name: 'u1/cover-1.jpg', p_object_id: 'id-1',
    })
  })
})
