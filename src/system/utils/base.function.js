function ReLu(x) {
  return Math.max(0, x)
}
function Sigmoid(x) {
  return 1 / (1 + Math.exp(-x))
}
export { ReLu, Sigmoid }
