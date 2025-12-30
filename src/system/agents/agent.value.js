import { Agent } from './agent.base.js'

//基于基本agent的价值策略类
export class ValueAgent extends Agent {
  constructor(id, type = 'value', initialCash = 1000) {
    super(id, type, initialCash)
  }
  //价值策略决策,简单版本
  //策略强化参数:strategyReinforcement,默认值为false,表示不强化策略
  decide(price, priceHistory, strategyReinforcement = true) {
    if (strategyReinforcement) {
      //强化策略：开仓使用价格回撤信号；持仓使用平均成本计算盈亏率
      if (this.stock == 0 && priceHistory.length >= 5) {
        //开仓条件：最近5天最高价相对当前价的回撤>10%
        const maxPrice = Math.max(...priceHistory.slice(-5)) //最近5天最高价
        const priceDrop = (maxPrice - price) / maxPrice //回撤比例=(最高价-现价)/最高价
        if (priceDrop > 0.1) {
          return Math.floor((this.cash * (0.1 + this.noiseOffset)) / price) //以(10%+噪声偏移)*现金开仓
        }
        return 0
      } else if (this.stock > 0 && priceHistory.length >= 2) {
        //持仓阶段：根据平均持仓成本计算盈亏率
        const costBasis = this.averageCost * this.stock //成本基准=平均成本*持仓数量
        if (costBasis <= 0) return 0 //无有效成本基准则不操作
        const currentValue = price * this.stock //当前市值=现价*持仓数量
        const pnl = (currentValue - costBasis) / costBasis //盈亏率=(当前市值-成本基准)/成本基准
        if (pnl > 0.2) {
          return -Math.floor(this.stock / 2) //利润>20%：止盈卖出50%
        }
        if (pnl > 0.1 && pnl < 0.2) {
          return -Math.floor(this.stock / 4) //10%<利润<20%：止盈卖出25%
        }
        if (pnl < -0.1) {
          return Math.floor((this.cash * 0.1) / price) //亏损<-10%：用10%现金加仓摊薄
        }
        return 0
      }
    } else {
      if (price < 80) {
        //如果当前股票价格低于50,则买入股票
        //计算可购买的股票数量,方法为:购买数=(现金/当前股票价格)(向下取整)
        return Math.floor(this.cash / price)
      }
      if (price > 100) {
        //如果当前股票价格高于150,则卖出所有股票的一半
        //计算可卖出的股票数量,方法为:卖出数=(股票数量/2)(向下取整)
        return -Math.floor(this.stock / 2)
      }
      //如果当前股票价格在50到150之间,根据噪声决定买或不买
      if (this.noiseOffset > 0.5) {
        //如果噪声大于0.5,则买入股票
        //计算可购买的股票数量,方法为:购买数=(现金的20%的整数部分/当前股票价格)(向下取整)
        return Math.floor(Math.floor(this.cash * 0.1) / price)
      } else {
        //如果噪声小于等于0.5,则不购买股票
        return 0
      }
    }
  }
}
