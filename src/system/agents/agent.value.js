import { Agent } from './agent.base.js'

//基于基本agent的价值策略类
export class ValueAgent extends Agent {
  constructor(id, type = 'value', initialCash = 10000) {
    super(id, type, initialCash)
  }
  //价值策略决策,简单版本
  decide(price) {
    if (price < 50) {
      //如果当前股票价格低于50,则买入股票
      //计算可购买的股票数量,方法为:购买数=(现金/当前股票价格)(向下取整)
      return Math.floor(this.cash / price)
    }
    if (price > 150) {
      //如果当前股票价格高于150,则卖出所有股票的一半
      //计算可卖出的股票数量,方法为:卖出数=(股票数量/2)(向下取整)
      return -Math.floor(this.stock / 2)
    }
    //如果当前股票价格在50到150之间,根据噪声决定买或不买
    if (this.noiseOffset > 0.5) {
      //如果噪声大于0.5,则买入股票
      //计算可购买的股票数量,方法为:购买数=(现金的20%的整数部分/当前股票价格)(向下取整)
      return Math.floor(Math.floor(this.cash * 0.2) / price)
    } else {
      //如果噪声小于等于0.5,则不购买股票
      return 0
    }
  }
}
