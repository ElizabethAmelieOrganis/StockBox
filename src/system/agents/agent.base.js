export class Agent {
  //agent类
  constructor(id, type, initialCash = 100) {
    this.id = id //id:agent的唯一标识符
    this.type = type //type:agent使用的策略类型
    this.cash = initialCash //cash:agent使用的现金,开始时为初始资金initialCash
    this.stock = 0 //stock:agent持有的股票,初始为0
    this.noiseOffset = Math.random() //noiseOffset:同类型agent的随机偏移量,用于增加agent个体差异
    this.averageCost = 0 //averageCost:持仓平均成本(加权平均),用于计算盈亏率
    this.emotion = 0 //emotion:情感状态(数值)，用于影响行动概率
    this.prevValue = 0
  }
  //agent决策
  decide(price, priceHistory) {
    return 0
  }
}
