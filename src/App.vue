<template>
  <div class="AppContainer" style="display: flex; flex-direction: column; align-items: center">
    <div
      class="AppTitle"
      style="display: flex; flex-direction: column; align-items: center; font-family: monospace"
    >
      <h1 class="AppTitleText-h1">StockBox</h1>
      <p class="AppTitleText-p">A stock market simulation game.</p>
    </div>
    <div
      class="AppController"
      style="
        display: flex;
        flex-direction: row;
        align-items: center;
        font-family: monospace;
        justify-content: center;
        gap: 10px;
        margin-bottom: 20px;
      "
    >
      <el-button @click="runStep" :disabled="running">Run A Step</el-button>
      <el-button @click="toggleRun">{{ running ? 'Stop' : 'Start' }}</el-button>
      <span>Price:￥{{ engine.price.toFixed(2) }}</span> |Day
      <span>{{ engine.day }}</span>
    </div>
    <div
      id="chart"
      style="
        width: 100%;
        height: 400px;
        border: 1px solid #ccc;
        display: flex;
        flex-direction: column;
        align-items: center;
      "
    ></div>
    <div style="flex: 1">
      <h3>💰 Agent Asset Rankings</h3>
      <el-table
        :data="sortedAgents"
        stripe
        border
        size="default"
        :fit="true"
        style="width: 100%"
        :max-height="350"
        row-key="id"
      >
        <el-table-column prop="id" label="ID" width="180" />
        <el-table-column label="Type" width="140">
          <template #default="{ row }">
            {{
              row.type === 'value'
                ? '📊 Value'
                : row.type === 'trend'
                  ? '📈 Trend'
                  : row.type === 'noise'
                    ? '🎲 Noise'
                    : '❓ Unknown'
            }}
          </template>
        </el-table-column>
        <el-table-column label="Cash" width="140" align="right">
          <template #default="{ row }">¥{{ row.cash.toFixed(0) }}</template>
        </el-table-column>
        <el-table-column prop="stock" label="Stock" width="120" align="right" />
        <el-table-column label="Total Asset" align="right" width="140">
          <template #default="{ row }"
            >¥{{ (row.cash + row.stock * engine.price).toFixed(0) }}</template
          >
        </el-table-column>
        <el-table-column label="Emotion" width="120" align="right">
          <template #default="{ row }">
            {{ Number.isFinite(row.emotion) ? row.emotion.toFixed(0) : '0' }}
          </template>
        </el-table-column>
      </el-table>
    </div>
  </div>
</template>
<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import * as echarts from 'echarts'
import { StockMarketEngine } from './system/engine'

const engine = ref(new StockMarketEngine())
const running = ref(false)

let timer = null
const chartEl = ref(null)
let chartInstance = null

onMounted(() => {
  chartInstance = echarts.init(document.getElementById('chart'))
  engine.value.initAgents(25)
  updateChart()
})

onUnmounted(() => {
  if (timer) {
    clearInterval(timer)
  }
  if (chartInstance) {
    chartInstance.dispose()
  }
})

function updateChart() {
  const ph = engine.value.priceHistory
  const categories = ph.slice(1).map((_, i) => i + 1)
  const data = ph.map((p, i, arr) => (i === 0 ? null : [i, arr[i - 1], p])).filter(Boolean)
  const renderItem = (params, api) => {
    const xVal = api.value(0)
    const prev = api.value(1)
    const curr = api.value(2)
    const x = api.coord([xVal, 0])[0]
    const w = api.size([1, 0])[0] * 0.7
    const yPrev = api.coord([xVal, prev])[1]
    const yCurr = api.coord([xVal, curr])[1]
    const yTop = Math.min(yPrev, yCurr)
    const h = Math.abs(yCurr - yPrev)
    const color = curr >= prev ? '#e34f4f' : '#3ba272'
    return {
      type: 'rect',
      shape: { x: x - w / 2, y: yTop, width: w, height: h },
      style: api.style({ fill: color }),
    }
  }
  const option = {
    title: { text: 'Stock Price Trend', left: 'center' },
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
      formatter: (items) => {
        const idx = items[0].dataIndex + 1
        const prev = ph[idx - 1]
        const curr = ph[idx]
        const delta = curr - prev
        return `Day ${idx}<br/>Prev: ¥${prev.toFixed(2)}<br/>Curr: ¥${curr.toFixed(2)}<br/>Δ: ${
          delta >= 0 ? '+' : '-'
        }¥${Math.abs(delta).toFixed(2)}`
      },
    },
    xAxis: { type: 'category', data: categories },
    yAxis: { type: 'value' },
    animation: false,
    series: [
      {
        type: 'custom',
        renderItem,
        encode: { x: 0, y: [1, 2] },
        data,
        z: 2,
      },
      {
        type: 'line',
        data: ph.slice(1),
        step: 'end',
        showSymbol: false,
        lineStyle: { color: '#999', width: 1 },
        z: 1,
      },
    ],
  }
  chartInstance.setOption(option)
}
function runStep() {
  engine.value.step()
  updateChart()
}
function toggleRun() {
  running.value = !running.value
  if (running.value) {
    timer = setInterval(runStep, 1000) // 每1000ms运行一步
  } else {
    clearInterval(timer)
  }
}
const sortedAgents = computed(() => {
  return [...engine.value.agents].sort((a, b) => {
    const totalA = a.cash + a.stock * engine.value.price
    const totalB = b.cash + b.stock * engine.value.price
    return totalB - totalA
  })
})
</script>
<style scoped></style>
