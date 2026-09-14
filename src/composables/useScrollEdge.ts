import { onBeforeUnmount, onMounted, ref } from 'vue'

/**
 * 页面是否已经离开顶部。
 *
 * 页栏的材质只在「有内容从它下面经过」时才有存在的理由 —— 停在顶部时，那层半透明
 * 只是一道没来由的灰底。所以把「滚没滚」交给样式去决定：材质只在真的压住内容之后
 * 才浮现。
 */
export function useScrollEdge(threshold = 4) {
  const scrolled = ref(false)

  function update() {
    const top = document.scrollingElement?.scrollTop ?? window.scrollY
    scrolled.value = top > threshold
  }

  onMounted(() => {
    update()
    window.addEventListener('scroll', update, { passive: true })
  })

  onBeforeUnmount(() => {
    window.removeEventListener('scroll', update)
  })

  return scrolled
}
