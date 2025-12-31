import { Agent } from './agent.base.js'
import { emotionToProbability } from '../utils/emotion.js'
//基于基本智能体的风险平价智能体
export class RiskAgent extends Agent {
  constructor(id, type = 'risk', initialCash = 5000) {
    super(id, type, initialCash)
    //EWMA参数：用于估计资产价格的波动率（单资产）
    this.lambda = 0.94 //衰减系数，越大越平滑
    this.ewmaVar = 0 //EWMA方差估计（r^2的加权平均）
    //目标风险与仓位约束
    this.targetVol = 0.02 //目标波动率（每步口径），用于决定目标仓位
    this.wMin = 0.1 //仓位下限（占资产净值的比例）
    this.wMax = 1.5 //仓位上限（占资产净值的比例）
    this.maxStepQty = 50 //单步最大调仓股数，避免频繁剧烈交易
    this.minTradeQty = 1 //最小交易单位（小于该值不交易）
    //情感耦合：将emotion映射为风险偏好调整
    this.emotionK = 0.3 //emotion对目标风险的线性影响系数
    //回撤控制：根据净值回撤分级降低仓位
    this.peakValue = this.cash //历史最高净值，用于计算最大回撤
  }
  //风险平价，简单版本
  decide(price, priceHistory) {
    const p = emotionToProbability(this.emotion)
    //当价格历史不足两条时，不进行交易
    if (!priceHistory || priceHistory.length < 2) return 0
    const prevPrice = priceHistory[priceHistory.length - 2]
    const r = (price - prevPrice) / prevPrice //使用价格收益近似资产风险
    //EWMA方差更新：σ_t^2 = λ·σ_{t-1}^2 + (1−λ)·r_t^2
    if (this.ewmaVar === 0) {
      this.ewmaVar = r * r
    } else {
      this.ewmaVar = this.lambda * this.ewmaVar + (1 - this.lambda) * r * r
    }
    const estVol = Math.sqrt(this.ewmaVar) //估计波动率
    //计算当前净值与更新峰值（用于回撤控制）
    const value = this.cash + this.stock * price
    if (value > this.peakValue) this.peakValue = value
    const drawdown = this.peakValue > 0 ? (value - this.peakValue) / this.peakValue : 0
    //情感对目标风险的影响：emotion>0提高风险偏好，emotion<0降低
    const emotionScale = 1 + (this.emotion ?? 0) * this.emotionK
    const sigmaTargetEff = this.targetVol * Math.max(0.5, Math.min(1.5, emotionScale))
    //回撤分级降低仓位（示例：>10%与>20%两级）
    let riskAdj = 1
    if (drawdown < -0.2) riskAdj = 0.5
    else if (drawdown < -0.1) riskAdj = 0.7
    //目标仓位比例：w = σ* / σ_est（裁剪到[wMin,wMax]）
    const noiseScale = 0.8 + 0.4 * this.noiseOffset
    const wRaw = estVol > 1e-8 ? sigmaTargetEff / estVol : this.wMax
    const w = Math.max(this.wMin, Math.min(this.wMax, wRaw * riskAdj * noiseScale))
    //目标持仓股数：q* = floor((w × 净值) / 价格)
    const qTarget = Math.floor((w * value) / price)
    let delta = qTarget - this.stock //期望调仓量（>0买入，<0卖出）
    //限制单步最大调仓量
    const maxStep = Math.max(
      this.minTradeQty,
      Math.floor(
        this.maxStepQty *
          (0.5 + this.noiseOffset) *
          (0.5 + Math.min(1, Math.abs(this.emotion ?? 0))),
      ),
    )
    if (delta > maxStep) delta = maxStep
    if (delta < -maxStep) delta = -maxStep
    //约束买入不超过可用现金、卖出不超过持仓
    if (delta > 0) {
      const affordable = Math.floor(this.cash / price)
      delta = Math.min(delta, affordable)
    } else if (delta < 0) {
      delta = -Math.min(-delta, this.stock)
    }
    //情感概率门控
    delta = Math.trunc(delta * p)
    //过滤过小的调仓
    if (Math.abs(delta) < this.minTradeQty) return 0
    return Math.trunc(delta)
  }
}
