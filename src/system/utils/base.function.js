function ReLu(x) {
  return Math.max(0, x)
}
function Sigmoid(x) {
  return 1 / (1 + Math.exp(-x))
}
function FillAgentToList(agentList, agent, count) {
  for (let i = 0; i < count; i++) {
    agentList.push(agent)
  }
}

export { ReLu, Sigmoid, FillAgentToList }
