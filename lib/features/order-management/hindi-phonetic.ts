/** English spelling → Devanagari letters (phonetic), not dictionary translation. */

const CONS: Array<[string, string]> = [
  ["ksh", "क्ष"],
  ["chh", "छ"],
  ["kh", "ख"],
  ["gh", "घ"],
  ["ch", "च"],
  ["jh", "झ"],
  ["th", "थ"],
  ["dh", "ध"],
  ["ph", "फ"],
  ["bh", "भ"],
  ["sh", "श"],
  ["ng", "ग"],
  ["ck", "क"],
  ["qu", "क्व"],
  ["wh", "व"],
  ["kn", "न"],
  ["wr", "र"],
  ["k", "क"],
  ["g", "ग"],
  ["q", "क"],
  ["j", "ज"],
  ["z", "ज़"],
  ["t", "ट"],
  ["d", "ड"],
  ["n", "न"],
  ["p", "प"],
  ["b", "ब"],
  ["m", "म"],
  ["y", "य"],
  ["r", "र"],
  ["l", "ल"],
  ["v", "व"],
  ["w", "व"],
  ["s", "स"],
  ["h", "ह"],
  ["f", "फ"],
  ["x", "क्स"],
]

function matchCons(s: string, i: number): [string, string] | null {
  if (s[i] === "c") {
    const n = s[i + 1]
    if (n === "h") return ["ch", "च"]
    if (n === "k") return ["ck", "क"]
    if (n === "e" || n === "i" || n === "y") return ["c", "स"]
    return ["c", "क"]
  }
  for (const [key, glyph] of CONS) {
    if (s.startsWith(key, i)) return [key, glyph]
  }
  return null
}

function matchVowelKey(s: string, i: number): string | null {
  for (const key of ["aa", "ee", "ii", "oo", "uu", "ai", "au", "oi", "oy", "ay", "ey", "a", "i", "u", "e", "o"]) {
    if (s.startsWith(key, i)) return key
  }
  return null
}

function independentVowel(key: string, wordStart: boolean, nextCons: string | null): string {
  if (key === "oi" || key === "oy") return "ऑय"
  if (key === "ay" || key === "ey") return "ए"
  if (key === "a" && wordStart && nextCons && ["प", "ट", "क", "स", "क्स"].includes(nextCons)) return "ए"
  const map: Record<string, string> = {
    a: "अ",
    aa: "आ",
    i: "इ",
    ee: "ई",
    ii: "ई",
    u: "उ",
    oo: "ऊ",
    uu: "ऊ",
    e: "ए",
    ai: "ऐ",
    o: "ओ",
    au: "औ",
  }
  return map[key] ?? key
}

function matraFor(key: string, firstSyllable: boolean, wordFinal: boolean): string {
  if (key === "oi" || key === "oy") return "ॉय"
  if (key === "ay" || key === "ey") return "े"
  if (key === "a") {
    if (firstSyllable && !wordFinal) return ""
    return "ा"
  }
  if ((key === "i" || key === "ee" || key === "ii") && wordFinal) return "ी"
  const map: Record<string, string> = {
    aa: "ा",
    i: "ि",
    ee: "ी",
    ii: "ी",
    u: "ु",
    oo: "ू",
    uu: "ू",
    e: "े",
    ai: "ै",
    o: "ो",
    au: "ौ",
  }
  return map[key] ?? ""
}

function transliterateWord(raw: string): string {
  if (!raw) return raw
  if (/[\u0900-\u097F]/.test(raw) && !/[a-zA-Z]/.test(raw)) return raw

  const s = raw.toLowerCase()
  let i = 0
  let out = ""
  let syllables = 0
  let lastWasCons = false

  while (i < s.length) {
    if (!/[a-z]/.test(s[i])) {
      out += raw[i]
      lastWasCons = false
      i++
      continue
    }

    const vLead = matchVowelKey(s, i)
    if (vLead && !lastWasCons) {
      const after = matchCons(s, i + vLead.length)
      out += independentVowel(vLead, i === 0, after?.[1] ?? null)
      lastWasCons = false
      syllables++
      i += vLead.length
      continue
    }

    const c0 = matchCons(s, i)
    if (!c0) {
      out += s[i]
      lastWasCons = false
      i++
      continue
    }

    i += c0[0].length
    const ng = c0[0] === "ng"
    const c1 = matchCons(s, i)
    const geminate = Boolean(c1 && c1[1] === c0[1] && !ng)
    if (geminate && c1) i += c1[0].length

    if (s.startsWith("ia", i) && i + 2 === s.length) {
      const glyph = geminate ? `${c0[1]}्${c0[1]}` : c0[1]
      out += `${glyph}िया`
      break
    }

    const rest = s.slice(i)
    const silentE = rest === "e" && s.length > 2 && c0[1] !== "र"
    const v1 = silentE ? null : matchVowelKey(s, i)
    let glyph = geminate ? `${c0[1]}्${c0[1]}` : c0[1]
    if (ng) glyph = out.length ? "ंग" : "ग"

    if (silentE) {
      out += glyph
      i += 1
      lastWasCons = true
      continue
    }

    if (v1) {
      const wordFinal = i + v1.length === s.length
      if (ng && syllables === 1) {
        out += "ै"
      }
      out += glyph + matraFor(ng && syllables === 1 && v1 === "a" ? "ai" : v1, syllables === 0, wordFinal)
      syllables++
      lastWasCons = false
      i += v1.length
      continue
    }

    const another = matchCons(s, i)
    if (another && !geminate && !ng) {
      out += `${glyph}्`
      lastWasCons = true
      continue
    }

    out += glyph
    lastWasCons = true
  }

  return out
}

export function toHindiPhonetic(text: string): string {
  return text
    .split(/(\s+)/)
    .map((part) => (/^\s+$/.test(part) ? part : transliterateWord(part)))
    .join("")
}

export function formatPcsHindi(qty: number): string {
  const n = Math.max(0, Math.floor(Number(qty) || 0))
  return n === 1 ? "1 पीस" : `${n} पीस`
}
