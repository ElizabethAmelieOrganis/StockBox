const ENGINE_VERSION = '0.1.0'
import { ValueAgent, TrendAgent, NoiseAgent, RiskAgent, Consortium } from './agents'

import {
  independentEmotionUpdate,
  BehavioralEmotionUpdate,
  clampEmotion,
  collectiveEmotionalOrganization,
} from './utils/emotion.js'

// 限价适配器：将原策略输出的数量转换为“带限价”的订单
// 目的是在不重写各策略逻辑的前提下，引入报价差异，使成交更合理
function computeQuote(agent, qty, price, history) {
  // side：买入或卖出；absQty：绝对数量
  const side = qty > 0 ? 'buy' : qty < 0 ? 'sell' : 'none'
  const absQty = Math.abs(qty)
  if (side === 'none' || absQty === 0) return { side, price, qty: 0 }
  // 基础价差：不同类型有不同默认价差区间
  let base =
    agent.type === 'value'
      ? 0.015
      : agent.type === 'trend'
        ? 0.01
        : agent.type === 'risk'
          ? 0.006
          : agent.type === 'consortium'
            ? 0.008
            : 0.02
  // 简单信号：动量与均值偏离
  const prev = history.length >= 2 ? history[history.length - 2] : price
  const momentum = prev > 0 ? (price - prev) / prev : 0
  const ma5 = history.length >= 5 ? history.slice(-5).reduce((a, b) => a + b, 0) / 5 : price
  const dev = ma5 > 0 ? (price - ma5) / ma5 : 0
  // 情感映射到(0,1)区间；越高越积极
  const a = 1 / (1 + Math.exp(-(agent.emotion || 0)))
  // 随机扰动：根据个体噪声偏移生成轻度抖动
  const jitter = (agent.noiseOffset - 0.5) * 0.2
  // 估计波动率（RiskAgent），波动越大，价差越宽
  const sigma = agent.ewmaVar ? Math.sqrt(agent.ewmaVar) : 0
  // 合成价差 s：基础价差 × 信号调节 × 情感收敛 × 噪声
  let s = base
  if (agent.type === 'value') {
    // 价值：偏离均值越多，越愿意靠近市价成交
    s *= side === 'buy' ? 1 - 0.7 * Math.max(0, -dev) : 1 - 0.7 * Math.max(0, dev)
  } else if (agent.type === 'trend') {
    // 趋势：上涨时买入更积极，下跌时卖出更积极
    s *= side === 'buy' ? 1 - 0.7 * Math.max(0, momentum) : 1 - 0.7 * Math.max(0, -momentum)
  } else if (agent.type === 'risk') {
    // 风险平价/风控：波动越大，扩大价差以降低成交概率
    s *= 1 + 2.0 * sigma
  }
  // 情感收敛：情感越高，价差越收窄（更靠近市价）
  s *= 1 - 0.4 * a
  // 噪声扰动
  s *= 1 + jitter
  // 防止负价差
  s = Math.max(0.0005, s)
  // 生成限价：为保证可即时成交的可能性
  // - 买单：使用高于市价的限价（愿意支付更高价格），满足限价>=市价即可成交
  // - 卖单：使用低于市价的限价（愿意以更低价格出售），满足限价<=市价即可成交
  const limitPrice = side === 'buy' ? price * (1 + s) : price * (1 - s)
  // 简化处理：取整到整数价格
  const limit = Math.max(1, Math.floor(limitPrice))
  return { side, price: limit, qty: absQty * (side === 'buy' ? 1 : -1) }
}

//配置基本市场交易引擎
export class StockMarketEngine {
  constructor() {
    //初始化引擎
    this.agents = [] //所有智能体
    this.price = 30 //初始股票价格
    this.priceHistory = [] //股票价格历史记录
    this.day = 0 //当前交易日
    this.behavioralList = [] //记录所有智能体的行为
  }
  //初始化智能体
  initAgents(agentCount) {
    //按数量初始化智能体
    for (let i = 0; i < agentCount; i++) {
      //传入id与类型,将智能体添加到交易市场中
      this.agents.push(new ValueAgent(`ValueAgent${i}`, 'value'))
      this.agents.push(new TrendAgent(`TrendAgent${i}`, 'trend'))
      this.agents.push(new NoiseAgent(`NoiseAgent${i}`, 'noise'))
      this.agents.push(new RiskAgent(`RiskAgent${i}`, 'risk'))
    }
  }
  initConsortiums(count) {
    for (let i = 0; i < count; i++) {
      const c = new Consortium(`Consortium${i}`, 'consortium', 300000)
      const rand = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min
      const vCount = rand(5, 8)
      const tCount = rand(1, 4)
      const rCount = rand(3, 6)
      const nCount = rand(1, 2)
      for (let k = 0; k < vCount; k++) c.addMember(new ValueAgent(`C${i}-V${k}`, 'value'))
      for (let k = 0; k < tCount; k++) c.addMember(new TrendAgent(`C${i}-T${k}`, 'trend'))
      for (let k = 0; k < rCount; k++) c.addMember(new RiskAgent(`C${i}-R${k}`, 'risk'))
      for (let k = 0; k < nCount; k++) c.addMember(new NoiseAgent(`C${i}-N${i}`, 'noise'))
      this.agents.push(c)
    }
  }
  //推进市场
  step() {
    this.day++ //推进交易日程
    //初始化需求与供给
    let totalDemand = 0
    let totalSupply = 0
    this.behavioralList = []

    //预交易,收集来自智能体的订单
    this.agents.forEach((agent) => {
      agent.prevValue = agent.cash + agent.stock * this.price
      //调用智能体decide方法,计算交易量(根据智能体所需参数传参)
      const tradeVolume = agent.decide(this.price, this.priceHistory)
      if (tradeVolume > 0) {
        totalDemand += tradeVolume //计算总的需求
      }
      if (tradeVolume < 0) {
        totalSupply += -tradeVolume //计算总的供给(因为智能体卖出股票时是以负值体现的,此处添加负号使其变为正值)
      }
    })
    //计算价格变化(价格变化由供需失衡决定)
    const imbalance = (totalDemand - totalSupply) / 100 //计算供需失衡比例(这里简单取100作为除数,可以根据需求调整)
    //根据供需失衡比例,计算价格变化
    //计算方法为:新价格=旧价格*(1+失衡比例*0.1)(向下取整)
    //这里简单取0.1作为调整系数,防止价格过于动荡(可以根据需求调整)
    const prevPrice = this.price
    let newPrice = prevPrice * (1 + imbalance * 0.1)
    const maxDrop = prevPrice * 0.5
    if (newPrice < maxDrop) newPrice = maxDrop
    this.price = Math.floor(Math.max(1, Math.min(3000, newPrice)))
    //this.price = Math.floor(Math.max(1, newPrice))
    //将新价格添加到价格历史记录中
    this.priceHistory.push(this.price)

    let newValue = 0

    //执行交易
    const marketPrice = this.price //当前市价
    const severeDrop =
      this.priceHistory.length >= 2
        ? (this.priceHistory[this.priceHistory.length - 2] -
            this.priceHistory[this.priceHistory.length - 1]) /
            this.priceHistory[this.priceHistory.length - 2] >
          0.5
        : false
    const severeRise =
      this.priceHistory.length >= 2
        ? (this.priceHistory[this.priceHistory.length - 1] -
            this.priceHistory[this.priceHistory.length - 2]) /
            this.priceHistory[this.priceHistory.length - 2] >
          0.5
        : false
    //遍历所有智能体
    this.agents.forEach((agent) => {
      newValue = agent.cash + agent.stock * marketPrice
      agent.emotion = independentEmotionUpdate(agent.prevValue ?? newValue, newValue, agent.emotion)
      agent.emotion = clampEmotion(agent.emotion)
      const tradeVolume = agent.decide(marketPrice, this.priceHistory) //重新计算交易量(根据当前价格与历史记录)
      // 生成限价订单（第一阶段：限价过滤，不做完整订单簿）
      const quote = computeQuote(agent, tradeVolume, marketPrice, this.priceHistory)
      if (quote.qty > 0 && agent.cash >= marketPrice * quote.qty) {
        // 买入限价过滤：只有当限价>=市价时执行（愿意以当前市价成交）
        const canBuyAtMarket = quote.price >= marketPrice
        const blockedByRise = severeRise && Math.random() >= 0.5
        if (canBuyAtMarket && !blockedByRise) {
          const newQty = agent.stock + quote.qty //新持仓数量=旧数量+买入数量
          const numerator = agent.averageCost * agent.stock + marketPrice * quote.qty //加权成本=旧成本*旧数量+买入价*买入数量
          agent.averageCost = newQty > 0 ? numerator / newQty : 0 //新的持仓平均成本=加权成本/新持仓数量
          agent.cash -= marketPrice * quote.qty
          agent.stock += quote.qty
          this.behavioralList.push('buy') //记录购买行为
        }
      }
      if (quote.qty < 0 && agent.stock >= -quote.qty) {
        // 卖出限价过滤：只有当限价<=市价时执行（愿意以当前市价成交）
        const canSellAtMarket = quote.price <= marketPrice
        const blockedByDrop = severeDrop && Math.random() >= 0.5
        if (canSellAtMarket && !blockedByDrop) {
          agent.cash += marketPrice * -quote.qty
          agent.stock += quote.qty
          if (agent.stock <= 0) agent.averageCost = 0 //清仓后平均成本归零；部分卖出不改变平均成本
          this.behavioralList.push('sell') //记录卖出行为
        }
      }
      agent.emotion = BehavioralEmotionUpdate(this.behavioralList, agent.emotion) //行为情感更新
      agent.emotion = clampEmotion(agent.emotion)
    })
    //群体情感行为(一维粒子群)
    const groupUpdated = collectiveEmotionalOrganization(this.agents.map((a) => a.emotion))
    for (let i = 0; i < this.agents.length; i++) {
      this.agents[i].emotion = clampEmotion(groupUpdated[i])
    }
    //根据随机数模拟市场不确定性
    const uncertaintyFactor = Math.random()
    if (uncertaintyFactor < 0.1) {
      //5%的概率触发黑天鹅事件(价格下跌1%)
      this.price = this.price * 0.01
      console.log('Black Swan Event: Price Drop to 1%')
    } else if (uncertaintyFactor > 0.9) {
      //5%的概率触发大牛市事件(价格上涨150%)
      this.price = this.price * 1.5
      console.log('Big Bull Market: Price Up to 150%')
    }
  }
}
