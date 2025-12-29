import { Agent } from './agent.base.js'

//基于基本agent的纯随机噪声类
export class NoiseAgent extends Agent {
  constructor(id, type = 'trend', initialCash = 10000) {
    super(id, type, initialCash)
  }
  //随机噪声策略，简单版本
  decide() {
    //该策略不受当前价格以及其他因素的影响，随意进行买卖
    //内部噪声(0~1)
    const internalNoise = Math.random()
    if (internalNoise > 0.75) {
      //当内部噪声大于0.75时，买入一定比例的股
      //15%的概率买入1-10股
      return Math.floor(this.noiseOffset * 10) + 1
    }
    if (internalNoise < 0.25) {
      //当内部噪声小于0.25时，卖出一定比例的股
      //15%的概率卖出1-10股
      //负号表示卖出
      return -(Math.floor(this.noiseOffset * 10) + 1)
    }
  }
}
