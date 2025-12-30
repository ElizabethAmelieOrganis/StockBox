import { Agent } from './agent.base.js'
import { emotionToProbability } from '../utils/emotion.js'

export class Consortium extends Agent {
  constructor(id, type = 'consortium', initialCash = 200000) {
    super(id, type, initialCash)
    this.members = []
  }
  addMember(agent) {
    this.members.push(agent)
  }
  decide(price, priceHistory) {
    if (!this.members.length) return 0
    const counts = {}
    for (const m of this.members) counts[m.type] = (counts[m.type] || 0) + 1
    const types = Object.keys(counts)
    const total = types.reduce((s, t) => s + counts[t], 0)
    let r = Math.random() * total
    let chosenType = types[0]
    for (const t of types) {
      if (r < counts[t]) {
        chosenType = t
        break
      }
      r -= counts[t]
    }
    const candidates = this.members.filter((m) => m.type === chosenType)
    const strategist = candidates[Math.floor(Math.random() * candidates.length)]
    const baseVol = strategist.decide(price, priceHistory) || 0
    const myValue = this.cash + this.stock * price
    const theirValue = strategist.cash + strategist.stock * price
    const scale = Math.max(0.5, Math.min(2, myValue / Math.max(1, theirValue)))
    let delta = Math.trunc(baseVol * scale)
    const p = emotionToProbability(this.emotion)
    delta = Math.trunc(delta * p)
    const noiseScale = 0.8 + 0.4 * this.noiseOffset
    delta = Math.trunc(delta * noiseScale)
    if (delta > 0) {
      const affordable = Math.floor(this.cash / price)
      delta = Math.min(delta, affordable)
    } else if (delta < 0) {
      delta = -Math.min(-delta, this.stock)
    }
    return delta
  }
}
