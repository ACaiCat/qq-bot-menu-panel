/**
 * 弹簧积分器。
 *
 * 参数用的是 Apple《Designing Fluid Interfaces》里的 damping ratio + response，
 * 而不是质量 / 刚度 / 阻尼那三个物理量 —— 后者对设计意图没有直接映射。
 *
 * 为什么不用 CSS transition：拖拽松手后动画必须「接着手指的速度继续走」，
 * 而 transition 既接不住初速度，也没法在中途被重新定向。所以这里按帧积分，
 * 每次都从元素当前的真实位置起步。
 */

export interface SpringOptions {
  /** 起始值。必须是元素此刻在屏幕上的实际值，传目标值会导致可见的跳变 */
  from: number
  to: number
  /** 初速度，px/s */
  velocity?: number
  /** 阻尼比：1 为临界阻尼（不过冲），小于 1 会回弹 */
  damping?: number
  /** 响应时间（秒），越小越跟手。它不是 duration —— 弹簧没有固定时长 */
  response?: number
  onUpdate: (value: number) => void
  onComplete?: () => void
}

/** 静止判据：位移和速度都足够小就收工 */
const REST_DISPLACEMENT = 0.15
const REST_VELOCITY = 0.5

/** 固定子步长，掉帧时积分也不会发散 */
const SUBSTEP = 1 / 240
/** 标签页切回来时单帧可能很长，钳一下免得一次性跳过去 */
const MAX_FRAME = 1 / 30

/**
 * 启动一个弹簧动画。
 * @returns 取消函数；再次调用会从当前位置重新起算（这就是可中断性）
 */
export function runSpring(options: SpringOptions): () => void {
  const damping = options.damping ?? 1
  const response = options.response ?? 0.3

  // 由阻尼比与响应时间反推刚度与阻尼系数（质量取 1）
  const omega = (2 * Math.PI) / response
  const stiffness = omega * omega
  const dampingCoefficient = 2 * omega * damping

  let value = options.from
  let velocity = options.velocity ?? 0
  let lastTime = performance.now()
  let frame = 0
  let cancelled = false

  function tick(now: number) {
    if (cancelled) return

    let elapsed = (now - lastTime) / 1000
    lastTime = now
    if (elapsed > MAX_FRAME) elapsed = MAX_FRAME

    // 半隐式欧拉，固定子步长
    let remaining = elapsed
    while (remaining > 0) {
      const step = Math.min(SUBSTEP, remaining)
      remaining -= step
      const acceleration = -stiffness * (value - options.to) - dampingCoefficient * velocity
      velocity += acceleration * step
      value += velocity * step
    }

    if (Math.abs(value - options.to) < REST_DISPLACEMENT && Math.abs(velocity) < REST_VELOCITY) {
      options.onUpdate(options.to)
      options.onComplete?.()
      return
    }

    options.onUpdate(value)
    frame = requestAnimationFrame(tick)
  }

  frame = requestAnimationFrame(tick)

  return () => {
    cancelled = true
    cancelAnimationFrame(frame)
  }
}

/**
 * 动量投影：用松手瞬间的速度推算元素「本来会滑到哪里」，再就近吸附。
 *
 * 这是 Apple 实际使用的指数衰减形式，不是教科书里的 `v² / (2 · decel)`。
 * `decelerationRate` 取 0.998 是正常滚动的手感，0.99 更利落。
 */
export function project(velocity: number, decelerationRate = 0.998): number {
  return ((velocity / 1000) * decelerationRate) / (1 - decelerationRate)
}

/**
 * 越界阻尼。拖过头时逐级变沉，而不是硬停 ——
 * 硬停读起来是「冻住了」，渐进的阻力读起来是「到头了，但还在响应」。
 */
export function rubberband(overshoot: number, dimension: number, constant = 0.55): number {
  return (overshoot * dimension * constant) / (dimension + constant * Math.abs(overshoot))
}

/** 用户是否要求减少动效 */
export function prefersReducedMotion(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}
