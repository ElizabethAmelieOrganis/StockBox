import { Sigmoid } from './base.function.js'

function independentEmotionUpdate(preValue, newValue, emotion) {
  //独立情感更新
  //根据资产变化百分比更新情感状态
  const returnChangePercent = (newValue - preValue) / preValue //资产变化百分比,在[-1,1]之间
  const emotionChange = Sigmoid(returnChangePercent) - 0.5 //情感变化,在[-1.05,1.05]之间
  return (emotion += emotionChange) //更新情感状态
}
function BehavioralEmotionUpdate(behavioralList, emotion) {
  //行为情感更新
  //根据行为变化更新情感状态
  let buyCount = 0
  let sellCount = 0
  behavioralList.forEach((behavior) => {
    //统计买卖数量
    if (behavior === 'buy') {
      buyCount++
    } else if (behavior === 'sell') {
      sellCount++
    }
  })
  //根据买卖数量更新情感状态
  if (buyCount + sellCount === 0) return emotion //如果没有买卖行为,则情感状态不变
  const behaviorChange = (buyCount - sellCount) / (buyCount + sellCount) //行为变化,在[-1,1]之间
  return (emotion += behaviorChange) //更新情感状态
}
//群体情感行为:一维粒子群式更新
function collectiveEmotionalOrganization(emotionList, opts = {}) {
  const n = emotionList?.length ?? 0
  if (n === 0) return []
  const w = opts.w ?? 1
  const c1 = opts.c1 ?? 0.2
  const c2 = opts.c2 ?? 0.3
  const sigma = opts.sigma ?? 0.05
  const min = opts.min ?? -2
  const max = opts.max ?? 2
  const sum = emotionList.reduce((acc, e) => acc + e, 0)
  const mean = sum / n
  let leader = emotionList[0]
  for (let i = 1; i < n; i++) {
    const e = emotionList[i]
    if (Math.abs(e) > Math.abs(leader)) leader = e
  }
  const updated = new Array(n)
  for (let i = 0; i < n; i++) {
    const e = emotionList[i]
    const r1 = Math.random()
    const r2 = Math.random()
    const towardMean = mean - e
    const towardLeader = leader - e
    const noise = (Math.random() - 0.5) * 2 * sigma
    const delta = c1 * r1 * towardMean + c2 * r2 * towardLeader + noise
    updated[i] = clampEmotion(e + w * delta, min, max)
  }
  return updated
}
//从情感向行动概率映射
//当情感偏移0越大,agent越倾向于做出改变
function emotionToProbability(emotion) {
  //根据情感状态映射到行动概率
  const p = Sigmoid(Math.abs(emotion)) //在[0,1]之间
  const randomValue = Math.random() //生成0到1之间的随机数
  return randomValue < p ? 1 : 0 //根据随机数判断是否执行行动
}
function clampEmotion(emotion, min = -2, max = 2) {
  return Math.min(max, Math.max(min, emotion))
}
export {
  independentEmotionUpdate,
  BehavioralEmotionUpdate,
  emotionToProbability,
  clampEmotion,
  collectiveEmotionalOrganization,
}
