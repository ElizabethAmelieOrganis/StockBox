const ENGINE_VERSION = '0.2.0'
import { ValueAgent, TrendAgent, NoiseAgent, RiskAgent, Consortium } from './agents'
import {
  independentEmotionUpdate,
  BehavioralEmotionUpdate,
  clampEmotion,
  consensusEmotionUpdate,
} from './utils/emotion.js'

//订单簿引擎
export class OrderBookEngine {
  constructor() {
    this.agents = []
    this.price = 30
    this.priceHistory = []
    this.day = 0
    this.behavioralList = []
    //自动初始化智能体和财团
    ;async () => {
      await this.initAgents()
      await this.initConsortium('ValueAboveAll', 9, 4, 4, 1)
      await this.initConsortium('RiskAboveAll', 4, 4, 9, 1)
    }
  }
  //初始化智能体
  initAgents() {
    //精确控制不同智能体数量
    //初始化价值智能体
    for (let i = 0; i < 9; i++) {
      this.agents.push(new ValueAgent(`ValueAgent${i}`, 'value'))
    }
    //初始化趋势智能体
    for (let i = 0; i < 9; i++) {
      this.agents.push(new TrendAgent(`TrendAgent${i}`, 'trend'))
    }
    //初始化噪声智能体
    for (let i = 0; i < 9; i++) {
      this.agents.push(new NoiseAgent(`NoiseAgent${i}`, 'noise'))
    }
    //初始化风险智能体
    for (let i = 0; i < 4; i++) {
      this.agents.push(new RiskAgent(`RiskAgent${i}`, 'risk'))
    }
    console.log('Agents Initialized: ')
  }
  //初始化财团
  initConsortium(name, vCount, tCount, rCount, nCount = 0) {
    const consortium = new Consortium(name, 'consortium', 300000)
    //精确控制财团成员
    for (let k = 0; k < vCount; k++) consortium.addMember(new ValueAgent(`ValueAgent${k}`, 'value'))
    for (let k = 0; k < tCount; k++) consortium.addMember(new TrendAgent(`TrendAgent${k}`, 'trend'))
    for (let k = 0; k < rCount; k++) consortium.addMember(new RiskAgent(`RiskAgent${k}`, 'risk'))
    for (let k = 0; k < nCount; k++) consortium.addMember(new NoiseAgent(`NoiseAgent${k}`, 'noise'))
    console.log(
      `Consortium ${name} Initialized: ${vCount} Value Agents, ${tCount} Trend Agents, ${rCount} Risk Agents, ${nCount} Noise Agents`,
    )
  }
}

function FloatingBid(agent, qty, price, history) {
  //side:买入或卖出,absQty:绝对数量
  const side = qty > 0 ? 'buy' : qty < 0 ? 'sell' : 'none'
  const absQty = Math.abs(qty)
  if (side === 'none' || absQty === 0) return { side, price, qty: 0 }
  //1.基本浮动,不同类型智能体的基本浮动指数
  const base =
    {
      value: 0.015,
      trend: 0.01,
      risk: 0.006,
      consortium: 0.008,
    }[agent.type] || 0.002
}
