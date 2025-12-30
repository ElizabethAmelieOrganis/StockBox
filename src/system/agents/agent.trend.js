import { Agent } from './agent.base.js'
import { emotionToProbability } from '../utils/emotion.js'
//基于基本agent的趋势策略类
export class TrendAgent extends Agent {
  constructor(id, type = 'trend', initialCash = 10000) {
    super(id, type, initialCash)
  }
  //趋势价值策略,简单版本
  decide(price, priceHistory) {
    //设置一个趋势观察窗口,默认为5天
    const observationWindow = 5
    //根据情感状态映射到行动概率
    const p = emotionToProbability(this.emotion)
    //基本判断,当观察不足5天时,不能进行任何操作
    if (priceHistory.length < observationWindow) {
      return 0
    }
    //获取最近5天的股市价格
    const priceRecent = priceHistory.slice(-5)
    //计算5天的价格变化趋势,方法为:(最近价格的第五条-最近价格第一条)/(最近价格第一条)
    const priceTrend = (priceRecent[priceRecent.length - 1] - priceRecent[0]) / priceRecent[0]
    //根据价格变化趋势决定是否购买股票
    //当价格变化率大于0.05时,用一定比例的现金购买股票,该比例受噪声影响
    //购买股票的现金=当前现金*噪声(0~0.5)
    if (priceTrend > 0.05) {
      return p * Math.floor((this.cash * (this.noiseOffset / 2)) / price)
    }
    //当价格变化率小于-0.05时,卖出一定比例的股票,该比例受噪声影响
    //卖出的股票数量=当前股票数*噪声(0~1)
    if (priceTrend < -0.05) {
      //负号代表卖出
      return p * -Math.floor(this.stock * this.noiseOffset)
    }
    //变化率过小,随机卖出收回成本(0~0.2)
    if (priceTrend < 0.05 && priceTrend > -0.05) {
      //负号代表卖出
      return p * -Math.floor(this.stock * (this.noiseOffset / 5))
    }
    return 0
  }
}
