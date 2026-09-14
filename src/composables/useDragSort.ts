import { onBeforeUnmount, ref, type Ref } from 'vue'

import { prefersReducedMotion, project, rubberband, runSpring } from '@/utils/spring'

/**
 * 指针驱动的列表排序。
 *
 * 替代 HTML5 拖放：原生 drag 事件只在「进入某个元素」时才给你位置，拿不到连续轨迹，
 * 所以卡片既不能 1:1 跟手，也没法在松手后接着手指的速度走。这里全程用 Pointer Events
 * 自己算，于是三件事都能做到：
 *
 *   1. 按住手柄后卡片贴着手走，且尊重按下时的抓取偏移；
 *   2. 越界时逐级变沉（rubber-band），不是硬停；
 *   3. 松手后用释放速度做动量投影，再就近吸附 —— 轻轻一甩能多走几格。
 *
 * 位置一律在滚动容器的「内容坐标」里算：列表可能比可视区高（模态框里的指令面板最多
 * 20 个元素），指针贴到上下边缘时容器自己滚，滚动量折算成位移 —— 长列表因此能一路
 * 拖到底，而不是拖到窗口边缘就卡住。
 *
 * 键盘用户走另外的路径（每张卡片上的上移 / 下移按钮），不是把拖拽硬塞进键盘。
 */

interface CardMetric {
  top: number
  height: number
  centre: number
}

interface PointerSample {
  y: number
  time: number
}

export interface DragSortOptions {
  /** 卡片所在的容器 */
  container: Ref<HTMLElement | null>
  /** 卡片选择器，用来测量各卡片的位置 */
  selector?: string
  /** 确认换位后回调，在这里真正调整数组顺序 */
  onReorder: (from: number, to: number) => void
}

/** 只保留最近这段时间的轨迹，用来估算释放速度 */
const VELOCITY_WINDOW = 100
/** 指针离滚动容器上下边这么近就开始自动滚 */
const EDGE_ZONE = 72
/** 贴边时每帧最多滚多少像素；平方曲线让刚进边缘区时几乎不动 */
const MAX_SCROLL_STEP = 18

export function useDragSort(options: DragSortOptions) {
  const selector = options.selector ?? '[data-drag-item]'

  /** 正在被拖动的卡片下标 */
  const draggingIndex = ref<number | null>(null)
  /** 每张卡片当前的位移。被拖的那张 1:1 跟手，其余的是「让位」 */
  const offsets = ref<number[]>([])

  let pointerId = -1
  let fromIndex = 0
  let targetIndex = 0
  /** 按下时指针的视口位置 */
  let startY = 0
  /** 测量时滚动容器的 scrollTop，与 startY 一起构成内容坐标的基准 */
  let startScroll = 0
  let grip: HTMLElement | null = null
  let metrics: CardMetric[] = []
  let gap = 0
  /** 被拖卡片的高度 + 间距：其余卡片让位时需要移动的距离 */
  let draggedExtent = 0
  let minOffset = 0
  let maxOffset = 0
  let samples: PointerSample[] = []
  let measured = false
  let cancelSpring: (() => void) | null = null
  /** 回弹动画还在飞、但尚未提交的落位 */
  let pendingLanding: number | null = null

  /** 纵向滚动容器；null 表示滚的是文档本身 */
  let scroller: HTMLElement | null = null
  /** 内容坐标 → 视口坐标的换算基准，拖动期间固定 */
  let hostTop = 0
  /** 最近一次指针的视口位置：自动滚动时没有新事件，只能靠它重算 */
  let lastClientY = 0
  let autoScrollFrame = 0

  function setOffset(value: number) {
    const next = [...offsets.value]
    next[fromIndex] = value
    offsets.value = next
  }

  function scrollTop(): number {
    return scroller ? scroller.scrollTop : (document.scrollingElement?.scrollTop ?? 0)
  }

  function scrollBy(step: number) {
    if (scroller) scroller.scrollTop += step
    else window.scrollBy(0, step)
  }

  /**
   * 找最近的纵向滚动容器。列表在模态框里时滚的是 `.modal__body`，
   * 在页面里时滚的是文档 —— 两者用同一套换算，不区分对待。
   */
  function findScroller(): HTMLElement | null {
    let node = options.container.value?.parentElement ?? null
    while (node && node !== document.body) {
      const overflowY = getComputedStyle(node).overflowY
      if (
        (overflowY === 'auto' || overflowY === 'scroll') &&
        node.scrollHeight > node.clientHeight + 1
      ) {
        return node
      }
      node = node.parentElement
    }
    return null
  }

  /** 某张卡片在当前换位状态下的视觉中心 */
  function slotCentre(index: number): number {
    const metric = metrics[index]
    if (!metric) return 0
    if (index > fromIndex && index <= targetIndex) return metric.centre - draggedExtent
    if (index < fromIndex && index >= targetIndex) return metric.centre + draggedExtent
    return metric.centre
  }

  /** 按当前 targetIndex 重算每张卡片的让位位移 */
  function applyShifts() {
    const current = offsets.value[fromIndex] ?? 0
    offsets.value = metrics.map((_, index) => {
      // 被拖的卡片不加过渡，直接跟手
      if (index === fromIndex) return current
      if (index > fromIndex && index <= targetIndex) return -draggedExtent
      if (index < fromIndex && index >= targetIndex) return draggedExtent
      return 0
    })
  }

  /** 卡片从原位置移动到第 landing 个槽位所需的位移 */
  function offsetForSlot(landing: number): number {
    if (landing === fromIndex) return 0
    let total = 0
    if (landing > fromIndex) {
      for (let i = fromIndex + 1; i <= landing; i += 1) total += (metrics[i]?.height ?? 0) + gap
    } else {
      for (let i = landing; i < fromIndex; i += 1) total -= (metrics[i]?.height ?? 0) + gap
    }
    return total
  }

  function releaseVelocity(): number {
    const first = samples[0]
    const last = samples.at(-1)
    if (!first || !last) return 0
    const elapsed = last.time - first.time
    if (elapsed <= 0) return 0
    return ((last.y - first.y) / elapsed) * 1000
  }

  function clearDragState() {
    detach()
    grip = null
    draggingIndex.value = null
    offsets.value = []
    document.documentElement.classList.remove('is-reordering')
  }

  /** 落位并提交换位 */
  function commit(landing: number) {
    const from = fromIndex
    cancelSpring = null
    pendingLanding = null
    clearDragState()
    if (landing !== from) options.onReorder(from, landing)
  }

  /**
   * 上一次的回弹还没落位就被新的拖拽打断：立刻把它落实。
   * 不这么做的话，被中断的那次换位会静默丢失，顺序与用户看到的不一致。
   */
  function flushPending() {
    if (!cancelSpring) return
    cancelSpring()
    cancelSpring = null
    const landing = pendingLanding
    if (landing === null) clearDragState()
    else commit(landing)
  }

  /** 测量各卡片的位置。延迟到第一次移动时做，避免读到尚未刷新的 DOM */
  function measure() {
    const host = options.container.value
    if (!host) return
    const cards = Array.from(host.querySelectorAll<HTMLElement>(selector))
    if (cards.length < 2) return

    scroller = findScroller()
    hostTop = scroller ? scroller.getBoundingClientRect().top : 0
    startScroll = scrollTop()
    // 内容坐标 = 视口坐标 - hostTop + scrollTop；容器再怎么滚，它都不变
    const base = hostTop - startScroll

    metrics = cards.map((node) => {
      const rect = node.getBoundingClientRect()
      const top = rect.top - base
      return { top, height: rect.height, centre: top + rect.height / 2 }
    })

    const measuredGap = Number.parseFloat(getComputedStyle(host).rowGap)
    gap = Number.isFinite(measuredGap) ? measuredGap : 0

    const self = metrics[fromIndex]
    const first = metrics[0]
    const last = metrics.at(-1)
    if (!self || !first || !last) return

    draggedExtent = self.height + gap
    // 卡片的上下边最多能走到列表的头 / 尾
    minOffset = first.top - self.top
    maxOffset = last.top + last.height - (self.top + self.height)
    offsets.value = metrics.map(() => 0)
    measured = true
  }

  /** 按指针位置重算位移与让位。指针不动但容器滚了时，也靠它把卡片拉回来 */
  function updateFromPointer(clientY: number) {
    if (!measured) return
    lastClientY = clientY

    // 内容坐标里的位移 = 指针走了多少 + 容器滚了多少
    const raw = clientY - startY + (scrollTop() - startScroll)
    // 越界部分只按阻尼跟随，读起来是「到头了」而不是「卡住了」
    let offset = raw
    if (raw < minOffset) offset = minOffset + rubberband(raw - minOffset, draggedExtent)
    else if (raw > maxOffset) offset = maxOffset + rubberband(raw - maxOffset, draggedExtent)

    setOffset(offset)

    const origin = metrics[fromIndex]
    if (!origin) return
    const centre = origin.centre + offset
    while (targetIndex > 0 && centre < slotCentre(targetIndex - 1)) targetIndex -= 1
    while (targetIndex < metrics.length - 1 && centre > slotCentre(targetIndex + 1))
      targetIndex += 1
    applyShifts()
  }

  /** 指针贴在上下边缘时每帧该滚多少；越靠边越快，中间是 0 */
  function autoScrollStep(): number {
    if (!measured) return 0
    const top = scroller ? scroller.getBoundingClientRect().top : 0
    const bottom = scroller ? top + scroller.clientHeight : window.innerHeight

    if (lastClientY < top + EDGE_ZONE) {
      const ratio = Math.min(1, (top + EDGE_ZONE - lastClientY) / EDGE_ZONE)
      return -Math.ceil(ratio * ratio * MAX_SCROLL_STEP)
    }
    if (lastClientY > bottom - EDGE_ZONE) {
      const ratio = Math.min(1, (lastClientY - (bottom - EDGE_ZONE)) / EDGE_ZONE)
      return Math.ceil(ratio * ratio * MAX_SCROLL_STEP)
    }
    return 0
  }

  /**
   * 自动滚动循环。指针停在边缘不动就不会再有 pointermove，
   * 所以滚完必须自己按指针当前位置重算一次位移，卡片才会贴着手继续走。
   */
  function autoScrollTick() {
    autoScrollFrame = 0
    if (pointerId === -1) return
    const step = autoScrollStep()
    if (!step) return
    scrollBy(step)
    updateFromPointer(lastClientY)
    autoScrollFrame = requestAnimationFrame(autoScrollTick)
  }

  /** 进入边缘区才起循环，离开就自然停下 */
  function ensureAutoScroll() {
    if (autoScrollFrame || pointerId === -1) return
    if (!autoScrollStep()) return
    autoScrollFrame = requestAnimationFrame(autoScrollTick)
  }

  /**
   * 事件监听挂在 window 上，而不是挂在手柄上。
   *
   * 挂手柄看着更「局部」，但依赖指针捕获一直生效：Chromium 在按下目标（手柄里的
   * svg）被显式捕获接管后，会在第一个 pointermove 就把捕获丢掉，此时挂在手柄上的
   * 监听再也收不到事件，拖动会「按住不动」。挂 window 不依赖捕获 —— 只要指针还在
   * 文档里，事件一定会经过这里；捕获因此只作为「指针移出窗口也还能收事件」的加成。
   */
  function detach() {
    if (autoScrollFrame) {
      cancelAnimationFrame(autoScrollFrame)
      autoScrollFrame = 0
    }
    window.removeEventListener('pointermove', onPointerMove)
    window.removeEventListener('pointerup', onPointerUp)
    window.removeEventListener('pointercancel', onPointerUp)
    window.removeEventListener('blur', endDrag)
  }

  /** 收尾：释放捕获、摘监听，再决定落到哪一格 */
  function endDrag() {
    const pid = pointerId
    const handle = grip
    pointerId = -1
    grip = null
    detach()

    if (handle && pid !== -1) {
      try {
        if (handle.hasPointerCapture(pid)) handle.releasePointerCapture(pid)
      } catch {
        // 指针可能已经失效，捕获也就无从谈起
      }
    }

    const origin = metrics[fromIndex]
    if (!origin) {
      commit(fromIndex)
      return
    }

    // 用释放速度推算真正想去的槽位，而不是从松手位置就近吸附
    const velocity = releaseVelocity()
    const current = offsets.value[fromIndex] ?? 0
    const projectedCentre = origin.centre + current + project(velocity)
    let landing = targetIndex
    while (landing > 0 && slotCentre(landing - 1) > projectedCentre) landing -= 1
    while (landing < metrics.length - 1 && slotCentre(landing + 1) < projectedCentre) landing += 1

    const destination = offsetForSlot(landing)

    // 减少动效时直接落位：位置一样准确，只是不做位移动画
    if (prefersReducedMotion() || Math.abs(destination - current) < 1) {
      commit(landing)
      return
    }

    pendingLanding = landing
    cancelSpring = runSpring({
      from: current,
      to: destination,
      velocity,
      damping: 1,
      response: 0.34,
      onUpdate: setOffset,
      onComplete: () => commit(landing),
    })
  }

  function onPointerMove(event: PointerEvent) {
    if (event.pointerId !== pointerId) return
    // 位置在第一次移动时才测量：此刻 DOM 一定已经刷成最新顺序了
    if (!measured) measure()
    if (!measured) return

    samples.push({ y: event.clientY, time: event.timeStamp })
    const cutoff = event.timeStamp - VELOCITY_WINDOW
    while (samples.length > 2 && (samples[0]?.time ?? 0) < cutoff) samples.shift()

    updateFromPointer(event.clientY)
    ensureAutoScroll()
  }

  function onPointerUp(event: PointerEvent) {
    if (event.pointerId !== pointerId) return
    endDrag()
  }

  /** 挂到拖拽手柄的 pointerdown 上 */
  function onGripPointerDown(event: PointerEvent, index: number) {
    if (event.button !== 0) return

    const host = options.container.value
    // 从事件目标自己找手柄与卡片，这样谁来绑监听都行
    const source = event.target as HTMLElement | null
    const handle = source?.closest<HTMLElement>('[data-drag-handle]')
    const element = source?.closest<HTMLElement>(selector)
    if (!host || !handle || !element) return

    // 打断上一次回弹前，先把它落到该在的位置
    flushPending()
    if (pointerId !== -1) return

    // 阻止原生拖放与文本选择，避免和自定义手势打架
    event.preventDefault()

    try {
      handle.setPointerCapture(event.pointerId)
    } catch {
      // 没有活动指针时（例如合成事件）捕获会失败，但不影响 window 上的监听
    }

    pointerId = event.pointerId
    grip = handle
    fromIndex = index
    targetIndex = index
    startY = event.clientY
    lastClientY = event.clientY
    measured = false
    samples = [{ y: event.clientY, time: event.timeStamp }]

    // 按下就抬起卡片，反馈不等松手
    offsets.value = []
    draggingIndex.value = index
    document.documentElement.classList.add('is-reordering')

    window.addEventListener('pointermove', onPointerMove)
    window.addEventListener('pointerup', onPointerUp)
    window.addEventListener('pointercancel', onPointerUp)
    window.addEventListener('blur', endDrag)
  }

  onBeforeUnmount(() => {
    if (cancelSpring) {
      cancelSpring()
      cancelSpring = null
    }
    detach()
    document.documentElement.classList.remove('is-reordering')
  })

  return { draggingIndex, offsets, onGripPointerDown }
}
