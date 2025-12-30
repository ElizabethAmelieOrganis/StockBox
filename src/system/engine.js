import { ValueAgent, TrendAgent, NoiseAgent } from './agents'

//配置基本市场交易引擎
export class StockMarketEngine {
  constructor() {
    //初始化引擎
    this.agents = [] //所有智能体
    this.price = 30 //初始股票价格
    this.priceHistory = [] //股票价格历史记录
    this.day = 0 //当前交易日
  }
  //初始化智能体
  initAgents(agentCount) {
    //按数量初始化智能体
    for (let i = 0; i < agentCount; i++) {
      //传入id与类型,将智能体添加到交易市场中
      this.agents.push(new ValueAgent(`ValueAgent${i}`, 'value'))
      this.agents.push(new TrendAgent(`TrendAgent${i}`, 'trend'))
      this.agents.push(new NoiseAgent(`NoiseAgent${i}`, 'noise'))
    }
  }
  //推进市场
  step() {
    this.day++ //推进交易日程
    //初始化需求与供给
    let totalDemand = 0
    let totalSupply = 0
    //预交易,收集来自智能体的订单
    this.agents.forEach((agent) => {
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
    //根据供需失衡比例，计算价格变化
    //计算方法为:新价格=旧价格*(1+失衡比例*0.1)(向下取整)
    //这里简单取0.1作为调整系数,防止价格过于动荡(可以根据需求调整)
    this.price = Math.floor(Math.max(1, Math.min(300, this.price * (1 + imbalance * 0.1))))
    //将新价格添加到价格历史记录中
    this.priceHistory.push(this.price)

    //执行交易
    const marketPrice = this.price //当前市价
    //遍历所有智能体
    this.agents.forEach((agent) => {
      const tradeVolume = agent.decide(marketPrice, this.priceHistory) //重新计算交易量(根据当前价格与历史记录)
      if (tradeVolume > 0 && agent.cash >= marketPrice * tradeVolume) {
        //当智能体有足够现金时,执行购买
        //当交易量大于0时,为需求,执行购买
        const newQty = agent.stock + tradeVolume //新持仓数量=旧数量+买入数量
        const numerator = agent.averageCost * agent.stock + marketPrice * tradeVolume //加权成本=旧成本*旧数量+买入价*买入数量
        agent.averageCost = newQty > 0 ? numerator / newQty : 0 //新的持仓平均成本=加权成本/新持仓数量
        agent.cash -= marketPrice * tradeVolume
        agent.stock += tradeVolume
      }
      if (tradeVolume < 0 && agent.stock >= -tradeVolume) {
        //当交易量小于0时,为供给,执行卖出
        agent.cash += marketPrice * -tradeVolume
        agent.stock += tradeVolume
        if (agent.stock <= 0) agent.averageCost = 0 //清仓后平均成本归零；部分卖出不改变平均成本
      }
    })
    //根据随机数模拟市场不确定性
    const uncertaintyFactor = Math.random()
    if (uncertaintyFactor < 0.05) {
      //5%的概率触发黑天鹅事件(价格下跌1%)
      this.price = this.price * 0.01
      console.log('Black Swan Event: Price Drop to 1%')
    } else if (uncertaintyFactor > 0.95) {
      //5%的概率触发大牛市事件(价格上涨300%)
      this.price = this.price * 3
      console.log('Big Bull Market: Price Up to 300%')
    }
  }
}
