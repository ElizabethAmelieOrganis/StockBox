import { Agent } from './agent.base.js' // 引入基础智能体类，财团继承自它
import { emotionToProbability } from '../utils/emotion.js' // 引入情感映射函数，用于将情感转换为行动概率

export class Consortium extends Agent {
  // 定义财团类，作为一种特殊智能体参与市场
  constructor(id, type = 'consortium', initialCash = 200000) {
    // 构造函数，设定ID、类型与初始资金
    super(id, type, initialCash) // 调用父类构造，将参数写入基础字段
    this.members = [] // 成员列表：存放内部的策略型智能体（value/trend/noise/risk等）
    this.minCashRatio = 0.2
    this.maxPositionRatio = 0.8
    this.peakValue = this.cash
  }
  addMember(agent) {
    // 添加一个成员到财团中
    this.members.push(agent) // 将传入的智能体加入成员数组
  }
  decide(price, priceHistory) {
    // 财团的决策函数，输出交易量（正数买入，负数卖出）
    if (!this.members.length) return 0 // 若没有任何成员，无法决策，返回不交易
    for (const m of this.members) {
      m.cash = this.cash
      m.stock = this.stock
      m.averageCost = this.averageCost
      m.prevValue = this.prevValue
    }

    const counts = {} // 统计各类型智能体数量的字典
    for (const m of this.members) counts[m.type] = (counts[m.type] || 0) + 1 // 遍历成员，按类型累加数量
    const types = Object.keys(counts) // 抽取所有出现的类型作为候选
    const total = types.reduce((s, t) => s + counts[t], 0) // 计算总成员数，用于加权随机

    let r = Math.random() * total // 生成[0,total)的随机数，作为加权选择的游标
    let chosenType = types[0] // 默认选中的类型（占位）
    for (const t of types) {
      // 遍历类型，按数量进行“轮盘赌”加权选择
      if (r < counts[t]) {
        // 若游标落在当前类型的数量范围内，选择该类型
        chosenType = t // 设置被选中的类型
        break // 退出循环
      }
      r -= counts[t] // 游标减去当前类型的权重，继续向后偏移
    }

    const candidates = this.members.filter((m) => m.type === chosenType) // 在被选中的类型中筛选所有候选成员
    let strategist = candidates[Math.floor(Math.random() * candidates.length)] // 在候选中随机选择一个具体成员作为当步“决策者”
    const ctx = {
      // 构造集团上下文，传给成员的决策函数，用于未来扩展策略感知集团信息
      consortiumCash: this.cash, // 财团当前现金
      consortiumStock: this.stock, // 财团当前持仓股数
      memberCount: this.members.length, // 财团成员总数
      typeWeights: counts, // 各类型成员数量（话语权）
    }
    let baseVol = strategist.decide(price, priceHistory, ctx) || 0 // 调用决策者的策略，得到基础交易量；若为空用0
    let attempts = 0 // 记录重试次数
    while (baseVol === 0 && attempts < 3) {
      // 若该成员给出不交易（0），最多重试三次以避免本步毫无动作
      strategist = candidates[Math.floor(Math.random() * candidates.length)] // 换另一个同类型成员
      baseVol = strategist.decide(price, priceHistory, ctx) || 0 // 再次决策
      attempts++ // 累加重试次数
    }

    let delta = Math.trunc(baseVol) // 初始交易量直接采用成员给出的量（不再按资金比例缩放），取整
    const p = emotionToProbability(this.emotion) // 将财团的情感值映射到行动概率p∈{0,1}

    if (delta > 0) {
      // 买入方向
      delta = Math.trunc(delta * p) // 用情感概率门控买入规模：情感越积极，越可能执行买入
    } else if (delta < 0) {
      // 卖出方向
      const sellScale = 0.5 + 0.5 * p // 卖出使用更宽容的比例，低情感时仍保留一定卖出（防御性）
      delta = Math.trunc(delta * sellScale) // 按比例缩放卖出规模
      if (delta === 0 && baseVol < 0) delta = -1 // 若缩放后卖出为0但原始意图为卖出，则至少卖出1股兜底
    }

    const noiseScale = 0.8 + 0.4 * this.noiseOffset // 引入财团级噪声扰动（[0.8,1.2]），避免同类财团全同
    delta = Math.trunc(delta * noiseScale) // 交易量再乘以噪声系数并取整
    const value = this.cash + this.stock * price
    if (value > this.peakValue) this.peakValue = value
    const drawdown = this.peakValue > 0 ? (value - this.peakValue) / this.peakValue : 0
    const prevPrice = priceHistory?.length >= 2 ? priceHistory[priceHistory.length - 2] : price
    const momentum = prevPrice > 0 ? (price - prevPrice) / prevPrice : 0
    if (delta < 0) {
      const sellAmplify = momentum < -0.05 ? Math.min(1.5, 1 - momentum) : 1
      delta = Math.trunc(delta * sellAmplify)
      if (drawdown < -0.15 && delta > -1) delta = -Math.max(1, Math.abs(delta))
    }

    if (delta > 0) {
      // 买入约束：不得超过可用现金能买的最大股数
      const affordable = Math.floor(this.cash / price) // 以当前价格计算最大可买股数
      const reserveCap = Math.max(0, Math.floor((this.cash - this.minCashRatio * value) / price))
      const maxBuy = Math.min(affordable, reserveCap)
      delta = Math.min(delta, maxBuy) // 裁剪到可买与现金留存上限
    } else if (delta < 0) {
      // 卖出约束：不得超过持仓股数，同时保持最大仓位比例
      const stockCap = Math.floor((this.maxPositionRatio * value) / price)
      const requiredSell = this.stock > stockCap ? this.stock - stockCap : 0
      const sellQty = Math.min(-delta, this.stock)
      delta = -Math.max(sellQty, requiredSell)
    }

    return delta // 返回最终交易量
  }
}
